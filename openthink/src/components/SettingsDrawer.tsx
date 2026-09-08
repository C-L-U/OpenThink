import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store';
import { useT } from '../i18n';
import type { Language, Theme } from '../store';
import {
  makeParticipant,
  parseParticipant,
  providerColor,
  shortModel,
  type ProviderId,
} from '../types';
import ProviderLogo from './ProviderLogo';

/** Renders `**bold**` markers inside a translated string as <strong>. */
function renderBold(text: string, strongClass: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className={strongClass}>
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

/** Two-option segmented switch used for theme and language. */
function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <span className="flex shrink-0 gap-0.5 rounded-lg border border-edge bg-inset p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition active:scale-95 ${
            value === opt.value ? 'bg-raised text-strong' : 'text-muted hover:text-strong'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </span>
  );
}

function SunIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/** Theme (light/dark) and UI language pickers. */
function AppearanceSection() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const language = useStore((s) => s.language);
  const setLanguage = useStore((s) => s.setLanguage);
  const t = useT();

  return (
    <div className="space-y-2.5 rounded-xl border border-edge bg-panel px-4 py-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
        {t('settings.appearance')}
      </h3>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{t('settings.theme')}</span>
        <SegmentedControl<Theme>
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: (<><SunIcon />{t('settings.light')}</>) },
            { value: 'dark', label: (<><MoonIcon />{t('settings.dark')}</>) },
          ]}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{t('settings.language')}</span>
        <SegmentedControl<Language>
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
    </div>
  );
}

/** Round pill switch (same style as the provider toggle) with a fixed accent. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-emerald-500' : 'bg-faint'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/** Chad mode switch: blunt, definitive final verdicts. */
function ChadSection() {
  const chadMode = useStore((s) => s.chadMode);
  const setChadMode = useStore((s) => s.setChadMode);
  const t = useT();

  return (
    <div className="rounded-xl border border-edge bg-panel px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-strong">{t('settings.chadMode')}</span>
        <Toggle checked={chadMode} onChange={setChadMode} label={t('settings.chadMode')} />
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-muted">{t('settings.chadModeDesc')}</p>
    </div>
  );
}

/** Collapsible 6-step explanation of the debate flow (same pattern as SecurityNotice). */
function HowItWorks() {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <div className="rounded-xl border border-edge bg-panel px-4 py-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-muted">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          {t('settings.howTitle')}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-[11px] leading-4 text-muted animate-rise">
          <li>{t('settings.howStep1')}</li>
          <li>{t('settings.howStep2')}</li>
          <li>{t('settings.howStep3')}</li>
          <li>{t('settings.howStep4')}</li>
          <li>{t('settings.howStep5')}</li>
          <li>{t('settings.howStep6')}</li>
        </ol>
      )}
    </div>
  );
}

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
    useShallow((s) => s.participants.filter((pid) => parseParticipant(pid).provider === id)),
  );
  const toggleParticipant = useStore((s) => s.toggleParticipant);
  const toggleProvider = useStore((s) => s.toggleProvider);
  const validation = useStore((s) => s.keyValidation[id]);
  const testing = useStore((s) => Boolean(s.keyTesting[id]));
  const testApiKey = useStore((s) => s.testApiKey);
  const [showKey, setShowKey] = useState(false);
  const t = useT();

  const enabled = activeModelIds.length > 0;
  const statusColor = validation ? (validation.ok ? 'bg-emerald-400' : 'bg-red-400') : 'bg-faint';
  const statusTitle = validation
    ? validation.ok
      ? t('settings.lastTestConnected')
      : t('settings.lastTestFailed')
    : t('settings.untested');

  return (
    <div
      className={`rounded-xl border border-edge bg-panel p-4 transition-opacity duration-200 ${
        enabled ? '' : 'opacity-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <ProviderLogo id={id} name={provider.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold tracking-tight text-strong">
              {provider.name}
            </span>
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`}
              title={statusTitle}
            />
          </div>
          <p className="truncate text-xs text-muted">
            {enabled
              ? t('settings.modelsInDebate', {
                  a: activeModelIds.length,
                  m: provider.models.length,
                })
              : t('settings.notInDebate')}
          </p>
        </div>
        <button
          onClick={() => toggleProvider(id)}
          role="switch"
          aria-checked={enabled}
          aria-label={t(enabled ? 'settings.removeFromDebate' : 'settings.addToDebate', {
            name: provider.name,
          })}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
            enabled ? '' : 'bg-faint'
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
                title={`${m}${isDefault ? ` ${t('settings.defaultModel')}` : ''} — ${t(active ? 'settings.pillRemove' : 'settings.pillAdd')}`}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] transition active:scale-95 ${
                  active
                    ? 'border-faint bg-raised/60 text-strong'
                    : 'border-edge bg-inset text-muted hover:border-faint hover:text-strong'
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
                    title={t('settings.defaultModel')}
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
            placeholder={t('settings.apiKeyPlaceholder', { name: provider.name })}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-edge bg-inset px-3 py-2 pr-9 text-sm text-strong placeholder-faint outline-none transition-colors focus:border-faint"
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            aria-label={t(showKey ? 'settings.hideKey' : 'settings.showKey')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint transition hover:text-muted"
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
          className="flex h-[34px] min-w-[64px] items-center justify-center rounded-lg border border-edge px-3 text-xs font-medium text-strong transition hover:border-faint active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        >
          {testing ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-faint border-t-strong" />
          ) : (
            t('settings.test')
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
              {t('settings.connected', { ms: validation.latencyMs })}
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
  const t = useT();
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
          {t('settings.securityTitle')}
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
          {(['settings.securityStep1', 'settings.securityStep2', 'settings.securityStep3', 'settings.securityStep4'] as const).map(
            (key) => (
              <li key={key}>{renderBold(t(key), 'text-emerald-200/90')}</li>
            ),
          )}
        </ol>
      )}
    </div>
  );
}

function ClearAllButton() {
  const clearApiKeys = useStore((s) => s.clearApiKeys);
  const [confirming, setConfirming] = useState(false);
  const t = useT();

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-muted">{t('settings.clearConfirm')}</span>
        <button
          onClick={() => {
            clearApiKeys();
            setConfirming(false);
          }}
          className="rounded-md bg-red-950/60 px-2.5 py-1.5 font-medium text-red-400 transition hover:bg-red-950 active:scale-95"
        >
          {t('settings.clearYes')}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md px-2.5 py-1.5 text-muted transition hover:text-strong active:scale-95"
        >
          {t('settings.clearCancel')}
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md px-2.5 py-1.5 text-xs text-red-400/90 transition hover:bg-red-950/40 active:scale-95"
    >
      {t('settings.clearAll')}
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
  const t = useT();

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
        aria-label={t('settings.title')}
        className={`absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-edge bg-panel shadow-2xl outline-none transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-start justify-between px-5 pb-4 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-strong">
              {t('settings.title')}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">{t('settings.subtitle')}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label={t('settings.close')}
            className="rounded-lg p-1.5 text-muted transition hover:bg-raised hover:text-strong active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="space-y-2.5 border-y border-edge/70 px-5 py-2.5">
          <AppearanceSection />
          <ChadSection />
          <HowItWorks />
          <SecurityNotice />
          <p className="text-xs text-muted">
            {t('settings.modelsCount', {
              n: participantCount,
              models: t(participantCount === 1 ? 'common.model' : 'common.models'),
              m: activeProviderCount,
              providers: t(activeProviderCount === 1 ? 'common.provider' : 'common.providers'),
            })}
          </p>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('settings.filterPlaceholder')}
            className="w-full rounded-lg border border-edge bg-inset px-3 py-1.5 text-xs text-strong placeholder-faint outline-none transition-colors focus:border-faint"
          />
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto scroll-smooth px-5 py-4">
          {visible.map((p) => (
            <ProviderCard key={p.id} id={p.id} />
          ))}
          {visible.length === 0 && (
            <p className="pt-4 text-center text-xs text-faint">
              {t('settings.noMatch', { filter })}
            </p>
          )}
        </div>

        <footer className="border-t border-edge px-5 py-4">
          <div className="flex justify-start">
            <ClearAllButton />
          </div>
          <p className="mt-3 text-center text-[11px] text-faint">
            OpenThink · crafted by C-L-U
          </p>
        </footer>
      </aside>
    </div>
  );
}
