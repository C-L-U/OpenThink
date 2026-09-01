# OpenThink Frontend

React 19 + TypeScript + Vite + Tailwind CSS v3 + Zustand — the web client for the
OpenThink Multi-Agent Consensus Engine. See the [root README](../README.md) for the
full project documentation.

## Commands

```bash
pnpm install      # install dependencies
pnpm dev          # dev server on http://localhost:5173 (proxies /api → :8000)
pnpm build        # type-check + production build to dist/
pnpm lint         # oxlint
pnpm preview      # preview the production build
```

The dev server expects the FastAPI backend running on `localhost:8000`
(see `backend/`). In production the backend serves `dist/` directly, same-origin.

## Structure

```
src/
├── main.tsx              # React root
├── index.css             # Tailwind entry + global styles
├── types.ts              # Provider/Debate types + static provider fallback registry
├── api.ts                # SSE-over-fetch client (/api/debate, /api/validate, /api/providers)
├── store.ts              # Zustand store: settings (persisted), debate reducer, UI state
└── components/
    ├── InputBar.tsx          # Query input with autogrow + shortcuts
    ├── ModelChips.tsx        # Provider toggle chips
    ├── SettingsDrawer.tsx    # API keys, model variants, key testing
    ├── ConsensusView.tsx     # Final answer card (XSS-safe mini Markdown renderer)
    ├── DebateTimeline.tsx    # Collapsible rounds, STANCE pills, judge verdicts
    └── LoadingState.tsx      # Per-model progress during the debate
```

API keys live only in memory for the browser session — they are never written to
`localStorage` and are sent solely as request headers to your local backend.

## License

MIT — see [../LICENSE](../LICENSE).
