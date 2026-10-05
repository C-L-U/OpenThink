import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchProviders, streamDebate, validateKey, type DebateEvent } from './api';
import type { DebateRound, DebateStatus, ModelResponse, ParticipantId, ProviderId, ProviderInfo, RoundSnapshot } from './types';
import { PROVIDERS, lookupProvider, makeParticipant, parseParticipant } from './types';

const ALL_PROVIDERS: ProviderId[] = PROVIDERS.map((p) => p.id);
/** Default roster: every provider's default model, one participant each. */
const defaultParticipants = (): ParticipantId[] =>
  PROVIDERS.map((p) => makeParticipant(p.id, p.default_model));

const emptyKeys = (): Record<ProviderId, string> =>
  Object.fromEntries(ALL_PROVIDERS.map((id) => [id, '']));

export type Theme = 'dark' | 'light';
export type Language = 'es' | 'en';
/** Detect the browser's preferred language once (Spanish vs. English). */
const detectLanguage = (): Language =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es')
    ? 'es'
    : 'en';

interface SettingsState {
  apiKeys: Record<ProviderId, string>;
  /** Debate roster: "provider:model" entries; several may share a provider. */
  participants: ParticipantId[];
  settingsOpen: boolean;
  theme: Theme;
  language: Language;
  /** Chad mode: final answers become blunt, definitive verdicts. */
  chadMode: boolean;
  setApiKey: (id: ProviderId, key: string) => void;
  clearApiKeys: () => void;
  /** Toggle one participant (provider + model variant) in/out of the debate. */
  toggleParticipant: (provider: ProviderId, model: string) => void;
  /** Master switch: disabling removes all of the provider's participants;
   *  enabling adds its default model back. */
  toggleProvider: (id: ProviderId) => void;
  setSettingsOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setChadMode: (on: boolean) => void;
}
interface RegistryState {
  /** Dynamic provider registry (starts as the static fallback). */
  providers: ProviderInfo[];
  providersLoaded: boolean;
  /** null = not checked yet, true = backend reachable, false = offline. */
  backendOnline: boolean | null;
  loadProviders: () => Promise<void>;
}
interface DebateState {
  status: DebateStatus;
  query: string;
  rounds: DebateRound[];
  currentRound: number;
  maxRounds: number;
  consensus: { content: string; converged: boolean; roundsUsed: number } | null;
  moderatorInvoked: boolean;
  error: string | null;
  /** In-flight stream abort handle (ephemeral, never persisted). */
  abortController: AbortController | null;
  /** Set by pauseDebate() so the abort is settled as 'paused' instead of 'done'. */
  pauseIntent: boolean;
  startDebate: (query: string) => Promise<void>;
  /** Aborts the in-flight debate stream; partial results stay on screen. */
  stopDebate: () => void;
  /** Pauses the in-flight debate, keeping progress for a later resume. */
  pauseDebate: () => void;
  /** Continues a paused debate from its completed rounds (re-runs only the
   *  interrupted one). */
  resumeDebate: () => Promise<void>;
  /** Internal shared stream driver used by startDebate/resumeDebate. */
  _runStream: (query: string, controller: AbortController, resumeFrom?: RoundSnapshot[]) => Promise<void>;
  applyEvent: (event: DebateEvent) => void;
  reset: () => void;
  dismissError: () => void;
}
export type KeyValidation =
  | { ok: true; latencyMs: number; model: string }
  | { ok: false; error: string };

interface UiState {
  /** Ephemeral (non-persisted) last validation result per provider. */
  keyValidation: Partial<Record<ProviderId, KeyValidation>>;
  /** Providers currently being tested. */
  keyTesting: Partial<Record<ProviderId, boolean>>;
  /** Monotonic token; InputBar focuses its textarea whenever this changes. */
  inputFocusToken: number;
  testApiKey: (id: ProviderId) => Promise<void>;
  requestInputFocus: () => void;
}
type OpenThinkState = SettingsState & DebateState & UiState & RegistryState;
const initialDebateState = {
  status: 'idle' as DebateStatus,
  query: '',
  rounds: [] as DebateRound[],
  currentRound: 0,
  maxRounds: 3,
  consensus: null,
  moderatorInvoked: false,
  error: null as string | null,
  abortController: null as AbortController | null,
  pauseIntent: false,
};

/** Merge an incoming response over an existing one (e.g. a re-run round after a
 *  resume): a fresh success clears any previous error, and a fresh error drops
 *  stale content/stance. */
function mergeResponse(prev: ModelResponse, next: ModelResponse): ModelResponse {
  const merged: ModelResponse = { ...prev, ...next };
  if (next.error) {
    merged.content = '';
    delete merged.stance;
  } else {
    delete merged.error;
    if (!next.stance) delete merged.stance;
  }
  return merged;
}
function upsertResponse(
  rounds: DebateRound[],
  roundNum: number,
  response: ModelResponse,
): DebateRound[] {
  const idx = rounds.findIndex((r) => r.round === roundNum);
  if (idx === -1) return rounds; // round_start should have created it; ignore strays
  const round = rounds[idx];
  const rIdx = round.responses.findIndex((r) => r.model === response.model);
  const responses =
    rIdx === -1
      ? [...round.responses, response]
      : round.responses.map((r, i) => (i === rIdx ? mergeResponse(r, response) : r));
  const next = rounds.slice();
  next[idx] = { ...round, responses };
  return next;
}
export const useStore = create<OpenThinkState>()(
  persist(
    (set, get) => ({
      // ---- persisted settings slice ----
      apiKeys: emptyKeys(),
      participants: defaultParticipants(),
      settingsOpen: false,
      theme: 'dark',
      language: detectLanguage(),
      chadMode: false,
      setApiKey: (id, key) =>
        set((s) => {
          // Editing a key invalidates its previous test result.
          const keyValidation = { ...s.keyValidation };
          delete keyValidation[id];
          return { apiKeys: { ...s.apiKeys, [id]: key }, keyValidation };
        }),
      clearApiKeys: () => set({ apiKeys: emptyKeys(), keyValidation: {} }),
      toggleParticipant: (provider, model) =>
        set((s) => {
          const pid = makeParticipant(provider, model);
          return {
            participants: s.participants.includes(pid)
              ? s.participants.filter((p) => p !== pid)
              : [...s.participants, pid],
          };
        }),
      toggleProvider: (id) =>
        set((s) => {
          const hasAny = s.participants.some((pid) => parseParticipant(pid).provider === id);
          if (hasAny) {
            return {
              participants: s.participants.filter((pid) => parseParticipant(pid).provider !== id),
            };
          }
          const model = lookupProvider(s.providers, id).default_model;
          return { participants: [...s.participants, makeParticipant(id, model)] };
        }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setChadMode: (on) => set({ chadMode: on }),
      // ---- provider registry slice ----
      providers: PROVIDERS,
      providersLoaded: false,
      backendOnline: null,
      loadProviders: async () => {
        try {
          const providers = await fetchProviders();
          set((s) => {
            // Drop participants whose provider/model no longer exists.
            const participants = s.participants.filter((pid) => {
              const { provider, model } = parseParticipant(pid);
              const p = providers.find((x) => x.id === provider);
              return p && p.models.includes(model);
            });
            return { providers, providersLoaded: true, backendOnline: true, participants };
          });
        } catch {
          // Keep the static fallback registry and flag the backend as offline.
          set({ providersLoaded: true, backendOnline: false });
        }
      },

      // ---- ephemeral debate slice ----
      ...initialDebateState,

      startDebate: async (query) => {
        const { participants, status } = get();
        const trimmed = query.trim();
        if (!trimmed || status === 'running' || participants.length === 0) return;
        const controller = new AbortController();
        set({ ...initialDebateState, status: 'running', query: trimmed, abortController: controller });
        await get()._runStream(trimmed, controller);
      },

      stopDebate: () => {
        get().abortController?.abort();
      },

      pauseDebate: () => {
        if (get().status !== 'running') return;
        set({ pauseIntent: true });
        get().abortController?.abort();
      },

      resumeDebate: async () => {
        const { status, query, participants, rounds } = get();
        if (status !== 'paused' || !query || participants.length === 0) return;
        // Only fully evaluated rounds are safe to seed; the interrupted round
        // re-runs and its incoming events upsert over what's on screen.
        const resumeFrom: RoundSnapshot[] = rounds
          .filter((r) => r.evaluation)
          .map((r) => ({
            round: r.round,
            kind: r.kind,
            responses: r.responses
              .filter((x) => !x.error)
              .map((x) => ({ model: x.model, content: x.content })),
          }));
        const controller = new AbortController();
        set({
          status: 'running',
          error: null,
          pauseIntent: false,
          moderatorInvoked: false,
          abortController: controller,
        });
        await get()._runStream(query, controller, resumeFrom);
      },

      // Shared stream driver for startDebate/resumeDebate: consumes events into
      // the store and settles the final status (paused/done/error).
      _runStream: async (query, controller, resumeFrom) => {
        const { participants, apiKeys, chadMode } = get();
        const payload = participants.map((pid) => parseParticipant(pid));
        try {
          await streamDebate(
            query,
            payload,
            apiKeys,
            (event) => get().applyEvent(event),
            controller.signal,
            chadMode,
            resumeFrom,
          );
          // Stream ended; if we never saw done/consensus, close out gracefully.
          set((s) => (s.status === 'running' ? { status: s.pauseIntent ? 'paused' : 'done' } : s));
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            // User stopped or paused the debate: keep whatever arrived on screen.
            set((s) => (s.status === 'running' ? { status: s.pauseIntent ? 'paused' : 'done' } : s));
          } else {
            set({
              status: 'error',
              error: err instanceof Error ? err.message : 'An unknown error occurred.',
            });
          }
        } finally {
          set({ abortController: null, pauseIntent: false });
        }
      },

      applyEvent: (event) =>
        set((s) => {
          switch (event.type) {
            case 'round_start': {
              const exists = s.rounds.some((r) => r.round === event.round);
              const rounds = exists
                ? s.rounds
                : [...s.rounds, { round: event.round, kind: event.kind, responses: [] }];
              return {
                rounds,
                currentRound: event.round,
                maxRounds: event.max_rounds,
              };
            }
            case 'model_response': {
              return {
                rounds: upsertResponse(s.rounds, event.round, {
                  model: event.model,
                  content: event.content,
                  durationMs: event.duration_ms,
                  ...(event.stance ? { stance: event.stance } : {}),
                }),
              };
            }
            case 'model_error': {
              return {
                rounds: upsertResponse(s.rounds, event.round, {
                  model: event.model,
                  content: '',
                  error: event.error,
                }),
              };
            }
            case 'evaluation': {
              const rounds = s.rounds.map((r) =>
                r.round === event.round
                  ? {
                    ...r,
                    evaluation: {
                      consensus: event.consensus,
                      reason: event.reason,
                      ...(event.judge ? { judge: event.judge } : {}),
                    },
                  }
                  : r,
              );
              return { rounds };
            }
            case 'moderator_start': {
              return { moderatorInvoked: true };
            }
            case 'consensus': {
              return {
                consensus: {
                  content: event.content,
                  converged: event.converged,
                  roundsUsed: event.rounds_used,
                },
              };
            }
            case 'done': {
              return { status: 'done' };
            }
            case 'error': {
              return { status: 'error', error: event.message };
            }
            default:
              return s;
          }
        }),

      reset: () => set({ ...initialDebateState }),
      dismissError: () => set({ error: null }),

      // ---- ephemeral UI slice (never persisted) ----
      keyValidation: {},
      keyTesting: {},
      inputFocusToken: 0,
      requestInputFocus: () => set((s) => ({ inputFocusToken: s.inputFocusToken + 1 })),
      testApiKey: async (id) => {
        const s0 = get();
        const key = s0.apiKeys[id]?.trim();
        if (!key || s0.keyTesting[id]) return;
        // Test with the provider's first selected participant model, else its default.
        const first = s0.participants
          .map((pid) => parseParticipant(pid))
          .find((p) => p.provider === id);
        const model = first?.model || lookupProvider(s0.providers, id).default_model || undefined;
        set((s) => ({ keyTesting: { ...s.keyTesting, [id]: true } }));
        try {
          const result = await validateKey(id, key, model);
          set((s) => ({
            keyValidation: {
              ...s.keyValidation,
              [id]: result.ok
                ? { ok: true, latencyMs: result.latency_ms, model: result.model }
                : { ok: false, error: result.error },
            },
          }));
        } catch (err) {
          set((s) => ({
            keyValidation: {
              ...s.keyValidation,
              [id]: {
                ok: false,
                error: err instanceof Error ? err.message : 'Validation request failed.',
              },
            },
          }));
        } finally {
          set((s) => ({ keyTesting: { ...s.keyTesting, [id]: false } }));
        }
      },
    }),
    {
      name: 'openthink-settings',
      version: 2,
      // API keys are session-only: never written to nor restored from localStorage.
      partialize: (s) => ({
        participants: s.participants,
        theme: s.theme,
        language: s.language,
        chadMode: s.chadMode,
      }),
      migrate: (persisted, version) => {
        // v0 -> v1: {activeModels: ProviderId[], selectedModels: {id: model}}
        // becomes {participants: ParticipantId[]}.
        if (version === 0 && persisted && typeof persisted === 'object') {
          const old = persisted as {
            activeModels?: string[];
            selectedModels?: Record<string, string>;
          };
          if (Array.isArray(old.activeModels)) {
            const participants = old.activeModels
              .map((id) => {
                const p = PROVIDERS.find((x) => x.id === id);
                if (!p) return null;
                const sel = old.selectedModels?.[id];
                const model = sel && p.models.includes(sel) ? sel : p.default_model;
                return makeParticipant(id, model);
              })
              .filter((x): x is ParticipantId => Boolean(x));
            return { participants };
          }
        }
        // v1 -> v2: persisted data gained theme/language; keep participants and
        // let the merge below fill the new fields with their defaults.
        return persisted as { participants: ParticipantId[] };
      },
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<OpenThinkState>),
        apiKeys: emptyKeys(),
      }),
    },
  ),
);
