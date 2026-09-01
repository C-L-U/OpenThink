export type ProviderId = string;

/**
 * A debate participant: "provider:model". Model ids never contain ':',
 * so the first colon is a safe separator. Several participants may share
 * one provider with different models (e.g. "xai:grok-4.5" vs "xai:grok-4.6").
 */
export type ParticipantId = string;

export const makeParticipant = (provider: ProviderId, model: string): ParticipantId =>
  `${provider}:${model}`;

export function parseParticipant(pid: ParticipantId): { provider: ProviderId; model: string } {
  const idx = pid.indexOf(':');
  return idx === -1 ? { provider: pid, model: '' } : { provider: pid.slice(0, idx), model: pid.slice(idx + 1) };
}

/** Short label for a model id: strips gateway prefixes ("anthropic/claude-sonnet-5" → "claude-sonnet-5"). */
export const shortModel = (model: string): string => model.split('/').pop() ?? model;

export interface ModelResponse {
  model: ParticipantId;
  content: string;
  durationMs?: number;
  error?: string;
  /** Debate rounds only: "CONCEDED to X" | "MAINTAINED" | "REVISED". */
  stance?: string;
}

export interface DebateRound {
  round: number;
  kind: 'initial' | 'debate';
  responses: ModelResponse[];
  evaluation?: { consensus: boolean; reason: string; judge?: ParticipantId };
}

export type DebateStatus = 'idle' | 'running' | 'done' | 'error';

/** Shape returned by GET /api/providers. */
export interface ProviderInfo {
  id: ProviderId;
  name: string;
  default_model: string;
  models: string[];
}

/** Brand colors live client-side; unknown provider ids get a neutral zinc. */
export const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97757',
  google: '#4285f4',
  xai: '#a0a0a0',
  moonshot: '#8b5cf6',
  zhipu: '#06b6d4',
  deepseek: '#4D6BFE',
  mistral: '#FF7000',
  groq: '#F55036',
  openrouter: '#6366F1',
};

export const FALLBACK_PROVIDER_COLOR = '#71717a';

/**
 * Static fallback registry, used until/unless GET /api/providers succeeds.
 * Kept in sync with the backend's provider list.
 */
export const PROVIDERS: ProviderInfo[] = [
  { id: 'openai', name: 'ChatGPT', default_model: 'gpt-5.6-luna', models: ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.4-mini'] },
  { id: 'anthropic', name: 'Claude', default_model: 'claude-haiku-4-5', models: ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5', 'claude-fable-5'] },
  { id: 'google', name: 'Gemini', default_model: 'gemini-3.5-flash-lite', models: ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.1-pro-preview'] },
  { id: 'xai', name: 'Grok', default_model: 'grok-4.3', models: ['grok-4.3', 'grok-4.6', 'grok-4.5', 'grok-4.20-non-reasoning', 'grok-build-0.1'] },
  { id: 'moonshot', name: 'Kimi', default_model: 'kimi-k2.6', models: ['kimi-k2.6', 'kimi-k3', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed'] },
  { id: 'zhipu', name: 'GLM', default_model: 'glm-4.7-flash', models: ['glm-4.7-flash', 'glm-4.7', 'glm-5.2', 'glm-5.3-flash', 'glm-5.3'] },
  { id: 'deepseek', name: 'DeepSeek', default_model: 'deepseek-v4-flash', models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
  { id: 'mistral', name: 'Mistral', default_model: 'mistral-small-latest', models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest', 'magistral-medium-latest'] },
  { id: 'groq', name: 'Groq', default_model: 'openai/gpt-oss-20b', models: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.6-27b'] },
  { id: 'openrouter', name: 'OpenRouter', default_model: 'openai/gpt-5-nano', models: ['openai/gpt-5-nano', 'anthropic/claude-sonnet-5', 'anthropic/claude-opus-5', 'openai/gpt-5.6-terra', 'google/gemini-3.1-pro-preview', 'deepseek/deepseek-v4-pro'] },
];

/** Registry-aware lookup over a provider list; falls back gracefully for unknown ids. */
export function lookupProvider(providers: ProviderInfo[], id: ProviderId): ProviderInfo {
  return (
    providers.find((p) => p.id === id) ?? {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      default_model: '',
      models: [],
    }
  );
}

export const providerColor = (id: ProviderId): string =>
  PROVIDER_COLORS[id] ?? FALLBACK_PROVIDER_COLOR;
