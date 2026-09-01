import { useState } from 'react';
import { providerColor } from '../types';

interface Props {
  id: string;
  name: string;
  /** Tile size in px (the logo inside is ~62% of it). */
  size?: number;
  /** bare: just the glyph, no tile border/background (for chips and inline use). */
  bare?: boolean;
}

/**
 * Brand logo served from /providers/<id>.svg (bundled locally — works
 * offline and under the strict CSP). Falls back to a colored monogram if the
 * asset is missing.
 */
export default function ProviderLogo({ id, name, size = 36, bare = false }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
        style={{ width: size, height: size, backgroundColor: providerColor(id), fontSize: size * 0.4 }}
        aria-label={name}
      >
        {name.charAt(0)}
      </span>
    );
  }

  if (bare) {
    return (
      <img
        src={`/providers/${id}.svg`}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-[#141414]"
      style={{ width: size, height: size }}
      title={name}
    >
      <img
        src={`/providers/${id}.svg`}
        alt={name}
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
