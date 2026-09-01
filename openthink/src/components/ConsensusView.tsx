import { memo, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { lookupProvider, parseParticipant } from '../types';
import ProviderLogo from './ProviderLogo';

/** Tiny markdown-ish renderer: paragraphs, **bold**, `-` bullets, `###` headings. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-zinc-100">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  // Split out fenced code blocks first; code is rendered verbatim.
  // All interpolation goes through React's escaping — no dangerouslySetInnerHTML.
  const segments: { code: boolean; content: string }[] = text
    .split('```')
    .map((content, i) => ({
      code: i % 2 === 1,
      content: i % 2 === 1 ? content.replace(/^[^\n]*\n/, '') : content,
    }))
    .filter((s) => s.code || s.content.trim() !== '');

  return (
    <div className="space-y-3">
      {segments.map((seg, s) => {
        if (seg.code) {
          return (
            <pre
              key={s}
              className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-neutral-800 bg-[#111111] p-3.5 font-mono text-[13px] leading-6 text-zinc-300"
            >
              {seg.content.replace(/\n$/, '')}
            </pre>
          );
        }
        const blocks = seg.content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
        return blocks.map((block, i) => {
          const key = `${s}-${i}`;
          if (block.startsWith('###')) {
            return (
              <h3 key={key} className="pt-1 text-base font-semibold tracking-tight text-zinc-100">
                {renderInline(block.replace(/^#{1,6}\s*/, ''))}
              </h3>
            );
          }
          const lines = block.split('\n').map((l) => l.trim());
          if (lines.every((l) => l.startsWith('- '))) {
            return (
              <ul key={key} className="list-disc space-y-1 pl-5">
                {lines.map((l, j) => (
                  <li key={j} className="text-[15px] leading-6 text-zinc-300">
                    {renderInline(l.slice(2))}
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={key} className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-300">
              {renderInline(block)}
            </p>
          );
        });
      })}
    </div>
  );
});

export default function ConsensusView() {
  const status = useStore((s) => s.status);
  const consensus = useStore((s) => s.consensus);
  const rounds = useStore((s) => s.rounds);
  const providers = useStore((s) => s.providers);
  const reset = useStore((s) => s.reset);
  const requestInputFocus = useStore((s) => s.requestInputFocus);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (status === 'running' && !consensus) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-[#212121] p-6 animate-rise">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-neutral-800" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-neutral-800" />
            <div className="h-3 w-20 animate-pulse rounded bg-neutral-800" />
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="h-3.5 w-full animate-pulse rounded bg-neutral-800" />
          <div className="h-3.5 w-11/12 animate-pulse rounded bg-neutral-800" />
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-neutral-800" />
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-neutral-800" />
        </div>
      </div>
    );
  }

  if (!consensus) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(consensus.content);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  const newDebate = () => {
    reset();
    requestInputFocus();
  };

  const converged = consensus.converged;
  const accent = converged ? 'text-emerald-400' : 'text-amber-400';
  // Models that stood behind the final answer (answered in the last round).
  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const finalists = lastRound
    ? lastRound.responses.filter((r) => !r.error).map((r) => r.model)
    : [];
  // One logo per provider even when several of its models participated.
  const finalistProviders = [...new Set(finalists.map((pid) => parseParticipant(pid).provider))];

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br p-px animate-rise ${
        converged
          ? 'from-emerald-500/60 via-emerald-900/20 to-transparent shadow-[0_0_55px_-12px_rgba(16,185,129,0.4)]'
          : 'from-amber-500/50 via-amber-900/20 to-transparent shadow-[0_0_55px_-12px_rgba(245,158,11,0.3)]'
      }`}
    >
      <div className="rounded-[15px] bg-[#1c1c1c] p-6">
        {/* Header: icon + verdict + actions */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                converged
                  ? 'border-emerald-800/60 bg-emerald-950/50'
                  : 'border-amber-800/60 bg-amber-950/50'
              }`}
            >
              {converged ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
                </svg>
              )}
            </span>
            <div>
              <h2 className={`text-lg font-semibold tracking-tight ${accent}`}>
                {converged ? 'Consensus' : 'Best Compromise'}
              </h2>
              <p className="text-xs text-zinc-500">
                {converged
                  ? `unanimous agreement · ${consensus.roundsUsed} round${consensus.roundsUsed === 1 ? '' : 's'}`
                  : `no unanimous agreement after ${consensus.roundsUsed} rounds — moderated`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => void copy()}
              aria-label="Copy consensus"
              title="Copy consensus"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-neutral-800 hover:text-zinc-200 active:scale-90"
            >
              {copied ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
            <button
              onClick={newDebate}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-neutral-500 hover:text-zinc-100 active:scale-95"
            >
              New debate
            </button>
          </div>
        </div>

        {/* The winning answer */}
        <Markdown text={consensus.content} />

        {/* Footer: the minds behind this answer */}
        {finalists.length > 0 && (
          <div className="mt-5 flex items-center gap-2 border-t border-neutral-800/70 pt-4">
            <span className="text-[11px] text-zinc-600">
              {converged ? 'Agreed by' : 'Final positions from'} {finalists.length} model
              {finalists.length === 1 ? '' : 's'}
            </span>
            <span className="flex -space-x-1.5">
              {finalistProviders.map((id) => (
                <span key={id} className="rounded-lg ring-2 ring-[#1c1c1c]">
                  <ProviderLogo id={id} name={lookupProvider(providers, id).name} size={22} />
                </span>
              ))}
            </span>
            <span className="text-[11px] text-zinc-500">
              {finalistProviders.map((id) => lookupProvider(providers, id).name).join(' · ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
