import { useEffect, useRef } from 'react';
import InputBar from './components/InputBar';
import ModelChips from './components/ModelChips';
import SettingsDrawer from './components/SettingsDrawer';
import ConsensusView from './components/ConsensusView';
import LoadingState from './components/LoadingState';
import DebateTimeline from './components/DebateTimeline';
import ChadToggle from './components/ChadToggle';
import { useStore } from './store';
import { useMessages, useT } from './i18n';
import { lookupProvider, parseParticipant } from './types';

function ErrorBanner() {
  const error = useStore((s) => s.error);
  const dismissError = useStore((s) => s.dismissError);
  const query = useStore((s) => s.query);
  const status = useStore((s) => s.status);
  const startDebate = useStore((s) => s.startDebate);
  const t = useT();
  if (!error) return null;
  return (
    <div className="mx-auto mb-4 flex w-full max-w-3xl items-start justify-between gap-3 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 animate-rise">
      <p className="text-sm text-red-300">{error}</p>
      <span className="flex shrink-0 items-center gap-1">
        {query && status !== 'running' && (
          <button
            onClick={() => void startDebate(query)}
            className="rounded-md border border-red-800/70 px-2.5 py-1 text-xs font-medium text-red-300 transition hover:bg-red-900/30 hover:text-red-200 active:scale-95"
          >
            {t('app.retry')}
          </button>
        )}
        <button
          onClick={dismissError}
          aria-label={t('app.dismissError')}
          className="rounded-md p-1 text-red-400 transition hover:text-red-200 active:scale-90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>
  );
}

/** Red inline notice when the backend is unreachable, with one-click retry. */
function OfflineBanner() {
  const backendOnline = useStore((s) => s.backendOnline);
  const loadProviders = useStore((s) => s.loadProviders);
  const t = useT();
  if (backendOnline !== false) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-300/90 animate-rise">
      <span>
        {t('app.offlineBanner')}{' '}
        <code className="rounded bg-red-950/60 px-1.5 py-0.5 font-mono text-xs">
          uvicorn app.main:app --port 8000
        </code>
      </span>
      <button
        onClick={() => void loadProviders()}
        className="shrink-0 rounded-md border border-red-800/70 px-2.5 py-1 text-xs font-medium text-red-300 transition hover:bg-red-900/30 hover:text-red-200 active:scale-95"
      >
        {t('app.offlineReconnect')}
      </button>
    </div>
  );
}

/** Amber inline notice when some active providers have no API key configured. */
function MissingKeysNotice() {
  const participants = useStore((s) => s.participants);
  const apiKeys = useStore((s) => s.apiKeys);
  const providers = useStore((s) => s.providers);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const t = useT();
  const missing = [...new Set(participants.map((pid) => parseParticipant(pid).provider))].filter(
    (id) => !apiKeys[id]?.trim(),
  );
  if (missing.length === 0) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-300/90">
      {t('app.missingKeys', {
        names: missing.map((id) => lookupProvider(providers, id).name).join(', '),
      })}{' '}
      <button
        onClick={() => setSettingsOpen(true)}
        className="font-medium underline decoration-amber-500/50 underline-offset-2 transition hover:text-amber-200"
      >
        {t('app.openSettings')}
      </button>{' '}
      {t('app.missingKeysSuffix')}
    </div>
  );
}

/** Small colored dot reflecting backend connectivity. */
function BackendStatusDot() {
  const backendOnline = useStore((s) => s.backendOnline);
  const t = useT();
  const color =
    backendOnline === null ? 'bg-faint' : backendOnline ? 'bg-emerald-400' : 'bg-red-400';
  const label =
    backendOnline === null
      ? t('app.backendChecking')
      : backendOnline
        ? t('app.backendOnline')
        : t('app.backendOffline');
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={`h-2 w-2 shrink-0 rounded-full ${color} ${backendOnline === null ? 'animate-pulse' : ''}`}
    />
  );
}

export default function App() {
  const status = useStore((s) => s.status);
  const query = useStore((s) => s.query);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const requestInputFocus = useStore((s) => s.requestInputFocus);
  const hasKeys = useStore((s) => Object.values(s.apiKeys).some((k) => k.trim().length > 0));
  const theme = useStore((s) => s.theme);
  const language = useStore((s) => s.language);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const rounds = useStore((s) => s.rounds);
  const consensus = useStore((s) => s.consensus);
  const loadProviders = useStore((s) => s.loadProviders);
  const startDebate = useStore((s) => s.startDebate);
  const reset = useStore((s) => s.reset);
  const t = useT();
  const suggestions = useMessages()['app.suggestions'];

  const idle = status === 'idle' && rounds.length === 0;

  // Apply the persisted theme to <html> (the `light` class flips the CSS
  // variables) and keep the document language in sync for assistive tech.
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Fetch the dynamic provider registry from the backend once on mount
  // (falls back to the static registry and flags offline mode if it fails).
  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  // Keep the timeline pinned to the bottom as events stream in — but never
  // yank the view down while the user has scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [rounds, consensus, status]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Global keyboard shortcuts: "/" or Ctrl+K focus input, Ctrl+, opens settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        requestInputFocus();
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        requestInputFocus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestInputFocus, setSettingsOpen]);

  const newDebate = () => {
    reset();
    requestInputFocus();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="z-10 flex items-center justify-between gap-4 border-b border-edge/60 bg-base/80 px-5 py-3 backdrop-blur">
        <span className="flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-tight text-strong">
          Open<span className="text-emerald-400">Think</span>
          <BackendStatusDot />
        </span>
        {!idle && (
          <div className="hidden min-w-0 flex-1 justify-center overflow-hidden sm:flex">
            <ModelChips compact />
          </div>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {!idle && (
            <button
              onClick={newDebate}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-faint hover:text-strong active:scale-95"
            >
              {t('app.newDebate')}
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label={t('app.openSettings')}
            title={`${t('settings.title')} (Ctrl+,)`}
            className="relative rounded-lg p-2 text-muted transition hover:bg-raised hover:text-strong active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {hasKeys && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        </span>
      </header>

      {idle ? (
        /* ---- Idle: centered hero ---- */
        <main className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-16 pt-10">
          {/* Soft glow backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-[36rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl"
          />
          <h1 className="mb-2 text-4xl font-semibold tracking-tight text-strong">
            Open<span className="text-emerald-400">Think</span>
          </h1>
          <p className="mb-8 text-muted">{t('app.tagline')}</p>
          <OfflineBanner />
          <InputBar centered />
          <p className="mt-3 text-center text-xs text-faint">
            {t('app.pressToFocus')}{' '}
            <kbd className="rounded border border-edge px-1 py-0.5 font-sans text-[10px] text-muted">/</kbd>{' '}
            {t('app.pressToFocusAfter')}
          </p>
          <div className="mt-5">
            <ModelChips />
          </div>
          <div className="mt-4">
            <ChadToggle />
          </div>
          <div className="mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => void startDebate(s)}
                className="rounded-full border border-edge bg-panel px-3.5 py-1.5 text-xs text-muted transition hover:border-faint hover:text-strong active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="absolute bottom-4 text-[11px] text-faint">crafted by C-L-U</p>
        </main>
      ) : (
        /* ---- Running / done: scrollable column + sticky input ---- */
        <>
          <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="mx-auto w-full max-w-3xl pt-3">
              <ErrorBanner />
              <OfflineBanner />
              <MissingKeysNotice />
              {query && (
                <div className="mb-6 flex justify-end animate-rise">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-sm border border-edge/60 bg-raised px-4 py-2.5 text-[15px] leading-6 text-strong">
                    {query}
                  </p>
                </div>
              )}
              <div className="space-y-6">
                <ConsensusView />
                <LoadingState />
                <DebateTimeline />
              </div>
            </div>
          </div>
          <div className="border-t border-edge bg-base px-4 py-3">
            <InputBar />
            <div className="mx-auto mt-2 flex w-full max-w-3xl items-center gap-2">
              <ChadToggle />
              <div className="flex-1 sm:hidden">
                <ModelChips />
              </div>
            </div>
          </div>
        </>
      )}

      <SettingsDrawer />
    </div>
  );
}
