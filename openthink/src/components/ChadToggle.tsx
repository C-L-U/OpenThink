import { useStore } from '../store';
import { useT } from '../i18n';

/**
 * Inline Chad Mode status + quick toggle for the main chat, so the user can
 * see (and flip) the mode without opening the settings drawer. Amber and
 * pulsing when active; muted when off.
 */
export default function ChadToggle() {
  const chadMode = useStore((s) => s.chadMode);
  const setChadMode = useStore((s) => s.setChadMode);
  const t = useT();

  return (
    <button
      onClick={() => setChadMode(!chadMode)}
      aria-pressed={chadMode}
      title={t('chad.toggleTitle')}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition active:scale-95 ${
        chadMode
          ? 'border-amber-700/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
          : 'border-edge bg-panel text-faint hover:border-faint hover:text-muted'
      }`}
    >
      <span aria-hidden>⚡</span>
      {t('chad.label')}
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          chadMode ? 'bg-amber-400 animate-pulse' : 'bg-faint'
        }`}
      />
      <span className={chadMode ? 'font-semibold' : ''}>
        {chadMode ? t('chad.on') : t('chad.off')}
      </span>
    </button>
  );
}
