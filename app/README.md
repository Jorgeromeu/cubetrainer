# app

The web host: it builds every tool's view into one app. The tools themselves live in
`tools/<id>/app/`, the shared UI in `packages/ui/`; this folder only holds:

| Path | What |
|---|---|
| `src/tools.ts` | The registry: every tool, in menu order (the first is where `#/` goes). |
| `src/main.tsx` | Mounts the shell (`packages/ui/shell/App.tsx`) with the registry, loads `packages/ui/ui.css`. |
| `index.html` | The page the app mounts into. |
| `vite.config.ts` | Proxies `/api` to the server (`API_URL`, default `http://localhost:3001`). |

```sh
npm run dev      # from the repo root: http://localhost:5173 (run `npm run server` too)
npm run build    # from the repo root: type checks, import check, then static files in app/dist
```

A tool's catalog JSON (`tools/<id>/catalog/*.json`) is bundled at build time, so cases and algs never come
from the server. Without the server the app keeps working read-only: tools hide what needs
stored data, show a "No server" notice and keep retrying (also on window focus).
