import { useStore } from '../store';
import { lookupProvider, parseParticipant, providerColor, shortModel } from '../types';

export default function LoadingState() {
  const status = useStore((s) => s.status);
  const currentRound = useStore((s) => s.currentRound);
  const maxRounds = useStore((s) => s.maxRounds);
  const rounds = useStore((s) => s.rounds);
  const participants = useStore((s) => s.participants);
  const providers = useStore((s) => s.providers);
  const moderatorInvoked = useStore((s) => s.moderatorInvoked);
  const stopDebate = useStore((s) => s.stopDebate);

  if (status !== 'running') return null;

  const current = rounds.find((r) => r.round === currentRound);
  const answered = new Set(current?.responses.map((r) => r.model) ?? []);
  const pending = participants.filter((pid) => !answered.has(pid));

  // Phase label: gathering -> debating -> judging -> moderating.
  const awaitingJudge =
    !moderatorInvoked && current !== undefined && pending.length === 0 && !current.evaluation;
  const phase = moderatorInvoked
    ? 'Moderator is synthesizing the best compromise'
    : awaitingJudge
      ? 'Judge is evaluating positions'
      : currentRound <= 1
        ? `Querying ${participants.length} AIs — gathering independent answers`
        : `AIs are debating… Round ${currentRound}/${maxRounds}`;

  const participantLabel = (pid: string) => {
    const { provider, model } = parseParticipant(pid);
    return `${lookupProvider(providers, provider).name} · ${shortModel(model)}`;
  };

  return (
    <div className="flex flex-col items-center gap-3 py-2 animate-rise">
      <p className="flex items-center gap-1.5 text-sm text-zinc-400">
        <span>{phase}</span>
        <span className="inline-flex items-center gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 [animation-delay:300ms]" />
        </span>
      </p>
      {(pending.length > 0 || (current?.responses.length ?? 0) > 0) && !moderatorInvoked && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {pending.map((pid) => {
            const { provider } = parseParticipant(pid);
            return (
              <span
                key={pid}
                className="flex items-center gap-1.5 rounded-full border border-neutral-800 px-2.5 py-1 text-xs text-neutral-500"
              >
                <span
                  className="h-2.5 w-2.5 animate-spin rounded-full border border-neutral-600"
                  style={{ borderTopColor: providerColor(provider) }}
                />
                {participantLabel(pid)}
              </span>
            );
          })}
          {current?.responses.map((r) => (
            <span
              key={r.model}
              className="flex items-center gap-1.5 rounded-full border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {participantLabel(r.model)}
            </span>
          ))}
        </div>
      )}
      <button
        onClick={stopDebate}
        className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-zinc-500 transition hover:border-red-900/70 hover:text-red-300 active:scale-95"
      >
        ■ Stop
      </button>
    </div>
  );
}
