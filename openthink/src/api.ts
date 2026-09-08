import type { ProviderId, ProviderInfo } from './types';

export type DebateEvent =
  | { type: 'round_start'; round: number; kind: 'initial' | 'debate'; max_rounds: number }
  | { type: 'model_response'; round: number; model: string; content: string; duration_ms: number; stance?: string }
  | { type: 'model_error'; round: number; model: string; error: string }
  | { type: 'evaluation'; round: number; consensus: boolean; reason: string; judge?: string }
  | { type: 'moderator_start' }
  | { type: 'consensus'; content: string; converged: boolean; rounds_used: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

// Relative base: the Vite dev proxy forwards /api → localhost:8000, and in
// production FastAPI serves the built frontend same-origin.
const API_BASE = '/api';

/** Extracts a readable message from an error response (handles 429 + 422 detail). */
async function errorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === 'string' && data.detail) return data.detail;
    // FastAPI/Pydantic 422s carry a list of {loc, msg} validation errors.
    if (Array.isArray(data.detail)) {
      const messages = data.detail
        .map((item) =>
          item && typeof item === 'object' && 'msg' in item
            ? String((item as { msg: unknown }).msg)
            : null,
        )
        .filter((m): m is string => !!m);
      if (messages.length > 0) return messages.join(' · ');
    }
  } catch {
    /* fall through */
  }
  if (response.status === 429) return 'Rate limit exceeded — wait a minute and try again.';
  return `Backend error ${response.status}`;
}

/** Fetches the dynamic provider registry. Throws on network/HTTP errors. */
export async function fetchProviders(): Promise<ProviderInfo[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/providers`);
  } catch {
    throw new Error('Cannot reach the OpenThink backend.');
  }
  if (!response.ok) throw new Error(await errorMessage(response));
  const data = (await response.json()) as { providers: ProviderInfo[] };
  return data.providers;
}

export type ValidateKeyResult =
  | { ok: true; latency_ms: number; model: string }
  | { ok: false; error: string };

/**
 * Validates a provider API key against the local backend.
 * The endpoint normally returns 200 with an ok/error payload; 429s are mapped
 * to a readable error result instead of throwing.
 */
export async function validateKey(
  provider: ProviderId,
  key: string,
  model?: string,
): Promise<ValidateKeyResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [`x-api-key-${provider}`]: key,
      },
      body: JSON.stringify(model ? { provider, model } : { provider }),
    });
  } catch {
    throw new Error('Cannot reach the OpenThink backend. Is it running?');
  }
  if (!response.ok) {
    return { ok: false, error: await errorMessage(response) };
  }
  return (await response.json()) as ValidateKeyResult;
}

/**
 * Streams a debate via SSE-over-fetch (EventSource can't send custom headers).
 * Parses `data: <json>\n\n` frames incrementally and invokes onEvent per event.
 * Pass an AbortSignal to let the user stop the debate mid-stream.
 */
export async function streamDebate(
  query: string,
  participants: { provider: ProviderId; model: string }[],
  apiKeys: Record<ProviderId, string>,
  onEvent: (event: DebateEvent) => void,
  signal?: AbortSignal,
  chad = false,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // One key per provider, shared by all of its participants.
  for (const id of new Set(participants.map((p) => p.provider))) {
    const key = apiKeys[id];
    if (key && key.trim().length > 0) {
      headers[`x-api-key-${id}`] = key.trim();
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/debate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, participants, chad }),
      signal: signal ?? null,
    });
  } catch (err) {
    // A user-initiated stop must not be relabeled as a connectivity error.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new Error('Cannot reach the OpenThink backend. Is it running?');
  }

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  if (!response.body) {
    throw new Error('Backend returned no stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flushFrame = (frame: string) => {
    const dataLines = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (dataLines.length === 0) return;
    const payload = dataLines.join('\n');
    try {
      onEvent(JSON.parse(payload) as DebateEvent);
    } catch {
      // Skip malformed frames rather than killing the stream.
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by blank lines; keep the partial tail buffered.
    let idx: number;
    while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const frame = buffer.slice(0, idx);
      const sep = buffer.slice(idx).match(/^\r?\n\r?\n/)![0];
      buffer = buffer.slice(idx + sep.length);
      flushFrame(frame);
    }
  }
  if (buffer.trim().length > 0) {
    flushFrame(buffer);
  }
}
