import { useStore } from '../store';
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
            title={`Remove ${p.name} · ${model}`}
            className={`group flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800/70 font-medium text-neutral-300 transition hover:border-red-900/70 hover:text-neutral-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${
              compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
            }`}
          >
            <ProviderLogo id={provider} name={p.name} size={compact ? 12 : 14} bare />
            {!compact && <span className="text-neutral-400">{p.name}</span>}
            <span className="font-mono">{shortModel(model)}</span>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="text-neutral-600 transition group-hover:text-red-400"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        );
      })}
      <button
        onClick={() => setSettingsOpen(true)}
        disabled={running}
        title="Add models to the debate"
        className={`flex items-center gap-1 rounded-full border border-dashed border-neutral-700 font-medium text-neutral-500 transition hover:border-neutral-500 hover:text-neutral-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add
      </button>
      {participants.length === 0 && (
        <span className="text-xs text-amber-400/80">No models selected — add at least one</span>
      )}
    </div>
  );
}
