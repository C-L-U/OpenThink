import { memo, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import type { DebateRound, ModelResponse } from '../types';
import { lookupProvider, parseParticipant } from '../types';
import ProviderLogo from './ProviderLogo';

const ModelCard = memo(function ModelCard({ response }: { response: ModelResponse }) {
  const [expanded, setExpanded] = useState(false);
  const providers = useStore((s) => s.providers);
  const isError = Boolean(response.error);
  const t = useT();

  const { provider, model } = parseParticipant(response.model);
  const name = lookupProvider(providers, provider).name;
  const stance = response.stance?.toLowerCase();
  const stanceClass = stance?.includes('conced')
    ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
    : stance?.includes('revis')
      ? 'border-amber-800/60 bg-amber-950/40 text-amber-300'
      : 'border-edge bg-inset text-muted';

  return (
    <div
      className={`rounded-xl border p-4 ${
        isError ? 'border-red-900/60 bg-red-950/20' : 'border-edge bg-panel'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-strong">
          <ProviderLogo id={provider} name={name} size={26} />
          <span className="truncate">{name}</span>
          {model && (
            <span
              className="hidden shrink-0 rounded-md border border-edge bg-inset px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline"
              title={model}
            >
              {model}
            </span>
          )}
          {response.stance && (
            <span
              className={`max-w-44 shrink-0 truncate rounded-md border px-1.5 py-0.5 text-[10px] ${stanceClass}`}
              title={response.stance}
            >
              {response.stance}
            </span>
          )}
        </span>
        {response.durationMs !== undefined && (
          <span className="shrink-0 rounded-full border border-edge bg-inset px-2 py-0.5 text-[10px] text-muted">
            {(response.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      {isError ? (
        <p className="text-sm text-red-400">⚠ {response.error}</p>
      ) : (
        <>
          {/* Plain-text rendering: React escapes all content (XSS-safe). */}
          <div
            className={`overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-muted ${
              expanded ? 'max-h-72' : 'max-h-[9rem]'
            }`}
          >
            {response.content}
          </div>
          {response.content.split('\n').length > 6 || response.content.length > 400 ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 text-xs text-muted transition hover:text-strong"
            >
              {t(expanded ? 'timeline.showLess' : 'timeline.showMore')}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
});

/** Verdict block: who judged, what they ruled, and why. */
function JudgeVerdict({ evaluation }: { evaluation: NonNullable<DebateRound['evaluation']> }) {
  const providers = useStore((s) => s.providers);
  const t = useT();
  const judge = evaluation.judge ? parseParticipant(evaluation.judge) : null;
  const judgeName = judge ? lookupProvider(providers, judge.provider).name : null;
  return (
    <div
      className={`flex items-start gap-3 border-t px-4 py-3 ${
        evaluation.consensus
          ? 'border-emerald-900/40 bg-emerald-950/20'
          : 'border-amber-900/40 bg-amber-950/15'
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
          evaluation.consensus
            ? 'border-emerald-800/60 bg-emerald-950/60'
            : 'border-amber-800/60 bg-amber-950/60'
        }`}
      >
        {/* Scales icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={evaluation.consensus ? '#34d399' : '#fbbf24'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={`font-semibold ${evaluation.consensus ? 'text-emerald-300' : 'text-amber-300'}`}>
            {t(evaluation.consensus ? 'timeline.consensusReached' : 'timeline.noConsensus')}
          </span>
          {judge && (
            <span className="flex items-center gap-1 text-muted">
              {t('timeline.judgedBy')}
              <ProviderLogo id={judge.provider} name={judgeName ?? ''} size={14} />
              <span className="text-muted">
                {judgeName}
                {judge.model ? ` (${judge.model})` : ''}
              </span>
            </span>
          )}
          {!judge && <span className="text-muted">{t('timeline.positionMatch')}</span>}
        </p>
        <p className="mt-1 text-xs italic leading-5 text-muted">“{evaluation.reason}”</p>
      </div>
    </div>
  );
}

const RoundSection = memo(function RoundSection({
  round,
  defaultOpen,
  isLast,
}: {
  round: DebateRound;
  defaultOpen: boolean;
  isLast: boolean;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  const t = useT();
  const open = override ?? defaultOpen;
  const title =
    round.kind === 'initial'
      ? t('timeline.roundInitial', { n: round.round })
      : t('timeline.roundDebate', { n: round.round });

  return (
    <div className="flex gap-3">
      {/* Timeline rail */}
      <div className="flex w-6 shrink-0 flex-col items-center">
        <span
          className={`z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${
            round.kind === 'initial'
              ? 'border-edge bg-panel text-muted'
              : 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300'
          }`}
        >
          {round.round}
        </span>
        {!isLast && <span className="w-px flex-1 bg-edge" />}
      </div>

      {/* Round card */}
      <div className="min-w-0 flex-1 rounded-xl border border-edge/70 animate-rise">
        <button
          onClick={() => setOverride(!open)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-muted transition hover:text-strong"
        >
          <span>{title}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-3 px-4 pb-4">
              {round.responses.map((r) => (
                <ModelCard key={r.model} response={r} />
              ))}
              {round.responses.length === 0 && (
                <p className="text-xs text-faint">{t('timeline.waiting')}</p>
              )}
            </div>
          </div>
        </div>
        {round.evaluation && <JudgeVerdict evaluation={round.evaluation} />}
      </div>
    </div>
  );
});

export default function DebateTimeline() {
  const rounds = useStore((s) => s.rounds);
  const moderatorInvoked = useStore((s) => s.moderatorInvoked);
  const t = useT();
  const latest = rounds.length > 0 ? rounds[rounds.length - 1].round : 0;

  if (rounds.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
        {t('timeline.history')}
      </h3>
      <div className="space-y-3">
        {rounds.map((r, i) => (
          <RoundSection
            key={r.round}
            round={r}
            defaultOpen={r.round === latest}
            isLast={i === rounds.length - 1 && !moderatorInvoked}
          />
        ))}
        {moderatorInvoked && (
          <div className="flex gap-3">
            <div className="flex w-6 shrink-0 flex-col items-center">
              <span className="z-10 flex h-6 w-6 items-center justify-center rounded-full border border-amber-900/60 bg-amber-950/40 text-amber-300">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
                </svg>
              </span>
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-400/90 animate-rise">
              {t('timeline.moderatorInvoked')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
