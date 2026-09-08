import { translate, type Lang } from './i18n';

const TWEET_LIMIT = 280;

/** Strip the markdown bits the consensus renderer supports: ``` fences, ###, "- " bullets, **bold**. */
function cleanMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/```/g, '')
    .replace(/^#{1,6}\s.*$/gm, '') // drop heading lines entirely
    .replace(/^- /gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1');
}

/** First non-empty paragraph, capped at ~2 lines, whitespace-collapsed. */
function excerpt(text: string): string {
  const firstParagraph =
    cleanMarkdown(text)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .find(Boolean) ?? '';
  return firstParagraph.split('\n').slice(0, 2).join(' ').replace(/\s+/g, ' ').trim();
}

/** First non-empty line (Chad verdicts lead with a punchy one-liner). */
function firstLine(text: string): string {
  const line = cleanMarkdown(text)
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  return (line ?? '').replace(/\s+/g, ' ');
}

/** Truncate to maxLen on a word boundary when possible, ending with an ellipsis. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  if (maxLen <= 1) return '…';
  const cut = text.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen / 2 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

/**
 * Fit two segments into a shared char budget. The shorter side keeps its full
 * length; the longer side absorbs whatever remains. Result: a+b ≤ budget.
 */
function fitPair(a: string, b: string, budget: number): [string, string] {
  if (a.length + b.length <= budget) return [a, b];
  const half = Math.floor(budget / 2);
  if (a.length <= half) return [a, truncate(b, budget - a.length)];
  if (b.length <= half) return [truncate(a, budget - b.length), b];
  return [truncate(a, half), truncate(b, budget - half)];
}

export interface ShareInput {
  query: string;
  content: string;
  converged: boolean;
  roundsUsed: number;
  participantCount: number;
  chadMode: boolean;
  lang: Lang;
}

/**
 * Build the tweet text for a finished debate. Layout:
 *   "question"\n\nexcerpt\n\ntail
 * Guaranteed ≤ 280 chars: the tail length is reserved up front and the rest
 * of the budget is split between question and excerpt.
 */
export function buildShareText({
  query,
  content,
  converged,
  roundsUsed,
  participantCount,
  chadMode,
  lang,
}: ShareInput): string {
  const key = chadMode
    ? converged
      ? 'share.chadUnanimous'
      : 'share.chadVerdict'
    : converged
      ? 'share.normalConsensus'
      : 'share.normalCompromise';
  const tail = translate(lang, key, { n: participantCount, r: roundsUsed });
  const question = query.trim();
  const body = chadMode ? firstLine(content) : excerpt(content);
  // Fixed overhead: the two quotes around the question + two blank-line separators.
  const budget = TWEET_LIMIT - tail.length - 6;
  const [q, b] = fitPair(question, body, Math.max(budget, 2));
  return `"${q}"\n\n${b}\n\n${tail}`;
}
