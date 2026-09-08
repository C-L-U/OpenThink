import { useStore } from '../store';
import { useT } from '../i18n';
import { lookupProvider, parseParticipant, shortModel } from '../types';
import ProviderLogo from './ProviderLogo';

/**
 * The debate roster as chips: one chip per participant (provider + model).
 * Clicking a chip removes that participant; the dashed "+" chip opens the
 * settings drawer to add more (including several models of one provider).
 */
export default function ModelChips({ compact }: { compact?: boolean }) {
  const participants = useStore((s) => s.participants);
  const providers = useStore((s) => s.providers);
  const toggleParticipant = useStore((s) => s.toggleParticipant);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const status = useStore((s) => s.status);
  const running = status === 'running';
  const t = useT();

  return (
    <div className={`flex flex-wrap items-center justify-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {participants.map((pid) => {
        const { provider, model } = parseParticipant(pid);
        const p = lookupProvider(providers, provider);
        return (
          <button
            key={pid}
            onClick={() => toggleParticipant(provider, model)}
            disabled={running}
            title={t('chips.remove', { name: p.name, model })}
            className={`group flex items-center gap-1.5 rounded-full border border-edge bg-raised/70 font-medium text-strong transition hover:border-red-900/70 hover:text-strong active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${
              compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
            }`}
          >
            <ProviderLogo id={provider} name={p.name} size={compact ? 12 : 14} bare />
            {!compact && <span className="text-muted">{p.name}</span>}
            <span className="font-mono">{shortModel(model)}</span>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="text-faint transition group-hover:text-red-400"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        );
      })}
      <button
        onClick={() => setSettingsOpen(true)}
        disabled={running}
        title={t('chips.addTitle')}
        className={`flex items-center gap-1 rounded-full border border-dashed border-edge font-medium text-muted transition hover:border-faint hover:text-strong active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t('chips.add')}
      </button>
      {participants.length === 0 && (
        <span className="text-xs text-amber-400/80">{t('chips.noneSelected')}</span>
      )}
    </div>
  );
}
