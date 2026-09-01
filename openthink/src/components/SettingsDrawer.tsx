import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import {
  makeParticipant,
  parseParticipant,
  providerColor,
  shortModel,
  type ProviderId,
} from '../types';
import ProviderLogo from './ProviderLogo';

function ProviderCard({ id }: { id: ProviderId }) {
  const providers = useStore((s) => s.providers);
  const provider = providers.find((p) => p.id === id) ?? {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    default_model: '',
    models: [] as string[],
  };
  const apiKey = useStore((s) => s.apiKeys[id] ?? '');
  const setApiKey = useStore((s) => s.setApiKey);
  // Participants belonging to this provider (several models may be active).
  const activeModelIds = useStore(
    (s) => s.participants.filter((pid) => parseParticipant(pid).provider === id),
  );
  const toggleParticipant = useStore((s) => s.toggleParticipant);
  const toggleProvider = useStore((s) => s.toggleProvider);
  const validation = useStore((s) => s.keyValidation[id]);
  const testing = useStore((s) => Boolean(s.keyTesting[id]));
  const testApiKey = useStore((s) => s.testApiKey);
  const [showKey, setShowKey] = useState(false);

  const enabled = activeModelIds.length > 0;
  const statusColor = validation ? (validation.ok ? 'bg-emerald-400' : 'bg-red-400') : 'bg-zinc-600';
  const statusTitle = validation
    ? validation.ok
      ? 'Last test: connected'
      : 'Last test: failed'
    : 'Untested';

  return (
    <div
      className={`rounded-xl border border-neutral-800 bg-[#1b1b1b] p-4 transition-opacity duration-200 ${
        enabled ? '' : 'opacity-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <ProviderLogo id={id} name={provider.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold tracking-tight text-zinc-200">
              {provider.name}
            </span>
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`}
              title={statusTitle}
            />
          </div>
          <p className="truncate text-xs text-zinc-500">
            {enabled
              ? `${activeModelIds.length} of ${provider.models.length} models in debate`
              : 'not in debate'}
          </p>
        </div>
        <button
          onClick={() => toggleProvider(id)}
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? 'Remove' : 'Add'} ${provider.name} ${enabled ? 'from' : 'to'} the debate`}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
            enabled ? '' : 'bg-zinc-700'
          }`}
          style={enabled ? { backgroundColor: providerColor(id) } : undefined}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
              enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Multi-model picker: every active pill is one debate participant. */}
      {provider.models.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {provider.models.map((m) => {
            const active = activeModelIds.includes(makeParticipant(id, m));
            const isDefault = m === provider.default_model;
            return (
              <button
                key={m}
                onClick={() => toggleParticipant(id, m)}
                aria-pressed={active}
                title={`${m}${isDefault ? ' (default)' : ''} — ${active ? 'remove from' : 'add to'} debate`}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] transition active:scale-95 ${
                  active
                    ? 'border-neutral-500 bg-neutral-700/60 text-zinc-100'
                    : 'border-neutral-800 bg-[#141414] text-zinc-500 hover:border-neutral-600 hover:text-zinc-300'
                }`}
              >
                {active && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {shortModel(m)}
                {isDefault && (
                  <span
                    className="h-1 w-1 rounded-full bg-emerald-400"
                    title="Default model"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(id, e.target.value)}
            placeholder={`${provider.name} API key`}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-neutral-800 bg-[#141414] px-3 py-2 pr-9 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-neutral-600"
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-600 transition hover:text-zinc-400"
          >
            {showKey ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <path d="m1 1 22 22" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        <button
          onClick={() => void testApiKey(id)}
          disabled={testing || !apiKey.trim()}
          className="flex h-[34px] min-w-[64px] items-center justify-center rounded-lg border border-neutral-700 px-3 text-xs font-medium text-zinc-300 transition hover:border-neutral-500 hover:text-zinc-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        >
          {testing ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
          ) : (
            'Test'
          )}
        </button>
      </div>

      {validation && !testing && (
        <p
          className={`mt-2 flex items-center gap-1.5 truncate text-xs ${
            validation.ok ? 'text-emerald-400' : 'text-red-400'
          }`}
          title={validation.ok ? undefined : validation.error}
        >
          {validation.ok ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Connected · {validation.latencyMs}ms
            </>
          ) : (
            <span className="truncate">{validation.error}</span>
          )}
        </p>
      )}
    </div>
  );
}

/** Explains exactly how API keys flow through the app — the trust centerpiece. */
function SecurityNotice() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 px-4 py-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-emerald-300/90">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Your keys never leave this machine
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-emerald-400/60 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-[11px] leading-4 text-emerald-200/60 animate-rise">
          <li>Keys live <strong className="text-emerald-200/90">only in this tab's memory</strong> — never in localStorage, cookies, or any file.</li>
          <li>They travel as request headers <strong className="text-emerald-200/90">only to your own local backend</strong> (localhost:8000).</li>
          <li>The backend holds them in memory for the request and forwards them <strong className="text-emerald-200/90">only to each provider's official API</strong> to authenticate.</li>
          <li>Never logged, never stored, no telemetry, no third parties. <strong className="text-emerald-200/90">Closing the tab erases them.</strong></li>
        </ol>
      )}
    </div>
  );
}

function ClearAllButton() {
  const clearApiKeys = useStore((s) => s.clearApiKeys);
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-zinc-500">Clear all keys?</span>
        <button
          onClick={() => {
            clearApiKeys();
            setConfirming(false);
          }}
          className="rounded-md bg-red-950/60 px-2.5 py-1.5 font-medium text-red-400 transition hover:bg-red-950 active:scale-95"
        >
          Yes, clear
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md px-2.5 py-1.5 text-zinc-400 transition hover:text-zinc-200 active:scale-95"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md px-2.5 py-1.5 text-xs text-red-400/90 transition hover:bg-red-950/40 active:scale-95"
    >
      Clear all keys
    </button>
  );
}

export default function SettingsDrawer() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const participantCount = useStore((s) => s.participants.length);
  const activeProviderCount = useStore(
    (s) => new Set(s.participants.map((pid) => parseParticipant(pid).provider)).size,
  );
  const providers = useStore((s) => s.providers);
  const [filter, setFilter] = useState('');
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const q = filter.trim().toLowerCase();
  const visible = q
    ? providers.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    : providers;

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Settings"
        className={`absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-neutral-800 bg-[#1e1e1e] shadow-2xl outline-none transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-start justify-between px-5 pb-4 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Settings</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Add keys for the providers you want in the debate — any subset works.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-neutral-800 hover:text-zinc-300 active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="space-y-2.5 border-y border-neutral-800/70 px-5 py-2.5">
          <SecurityNotice />
          <p className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-300">{participantCount}</span> model
            {participantCount === 1 ? '' : 's'} from{' '}
            <span className="font-medium text-zinc-300">{activeProviderCount}</span> provider
            {activeProviderCount === 1 ? '' : 's'} in the debate
          </p>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter models…"
            className="w-full rounded-lg border border-neutral-800 bg-[#141414] px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-neutral-600"
          />
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto scroll-smooth px-5 py-4">
          {visible.map((p) => (
            <ProviderCard key={p.id} id={p.id} />
          ))}
          {visible.length === 0 && (
            <p className="pt-4 text-center text-xs text-zinc-600">No providers match "{filter}".</p>
          )}
        </div>

        <footer className="border-t border-neutral-800 px-5 py-4">
          <div className="flex justify-start">
            <ClearAllButton />
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-600">
            OpenThink · crafted by C-L-U
          </p>
        </footer>
      </aside>
    </div>
  );
}
