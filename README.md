# DevToolkit — All-in-One Developer Utilities

A browser-based toolkit for developers who frequently need to inspect, transform, and validate data. Everything runs client-side; nothing is sent to a server.

| Tool | What it does |
| --- | --- |
| **JSON** | Format / minify (2, 4 or tab indent), sort keys, validate with line/column errors, structural diff with JSONPath-style paths |
| **JWT Decoder** | Decode header & payload, color-coded segments, claim descriptions, live expiry status (`exp` / `nbf` / `iat`), `alg: none` warning |
| **URL / Base64** | `encodeURIComponent` / `encodeURI`, form-style `+` decoding, UTF-8 safe Base64 and Base64URL, URL & query-param breakdown |
| **Regex Tester** | Live highlighting, flag toggles, match table with numbered/named groups, replace preview, quick reference |
| **Timestamp** | Live clock, auto-detects seconds / ms / µs / ns or date strings, ISO 8601 / HTTP / any IANA time zone, relative time |
| **UUID** | Bulk v4 & v7 generation (uppercase / hyphens / braces), validator that reports version, variant and v7 embedded time |
| **Cron Helper** | Plain-English description, per-field breakdown, next 10 run times, presets, `@daily`-style macros |

## Stack

React 18 · TypeScript · Tailwind CSS v4 · Vite 6 · Vitest

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run unit tests |
| `npm run typecheck` | Type-check only |

## Project layout

```
src/
  App.tsx            Shell: sidebar, hash routing (#/json, #/cron …), theme toggle
  components/ui.tsx  Shared UI primitives (Panel, TextArea, Segmented, CopyButton …)
  hooks/useNow.ts    Ticking clock hook
  lib/               Pure, framework-free logic (+ lib.test.ts)
    json.ts  jwt.ts  base64.ts  time.ts  uuid.ts  cron.ts
  tools/             One component per tool + index.ts registry
```

### Adding a tool

1. Put any non-UI logic in `src/lib/<name>.ts` and cover it in `lib.test.ts`.
2. Create `src/tools/<Name>Tool.tsx` (default export, no props).
3. Register it in `src/tools/index.ts` — the sidebar and routing pick it up automatically.

## Notes

- The JWT decoder does **not** verify signatures; it is an inspection tool.
- Cron uses standard 5-field (Vixie) semantics: when both day-of-month and day-of-week are restricted, a day matches if either does. Times are shown in your local zone.
- Each tool keeps its state while you switch between tools (until the page is reloaded).
