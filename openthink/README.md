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

The frontend connects by default to `https://engine.openthink.clu.run`. The backend must allow the exact frontend origin through CORS, including `http://localhost:5173` when developing locally.

For separate Coolify deployments, set the frontend build-time variable
`VITE_BACKEND_URL=https://backend.example.com` to the public backend origin
(without `/api`), then rebuild and redeploy the frontend. Set the backend
variable `OPENTHINK_CORS_ORIGINS=https://frontend.example.com` to the exact
public frontend origin and redeploy the backend. Multiple allowed origins can
be separated by commas. Verify `https://backend.example.com/api/health` returns
`{"status":"ok"}`. Set `VITE_BACKEND_URL` to an empty string for same-origin deployments.

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
`localStorage` and are sent solely as request headers to the configured backend.

## License

MIT — see [../LICENSE](../LICENSE).
