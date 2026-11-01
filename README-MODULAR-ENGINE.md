# Lacoste Runner — Modular Engine v2.0.0

This build introduces the plugin-driven runtime foundation while preserving the existing game and visual style.

## Run

Serve this directory through a local HTTP server (do not open `index.html` via `file://`):

```bash
python -m http.server 8000
```

Open `http://localhost:8000/`.

## Verify

Requires Node.js 18+:

```bash
npm test
npm run check
```

## Structure

- `engine/core.js` — game-agnostic engine core.
- `plugins/manifest.json` — plugin entrypoint manifest.
- `plugins/*.plugin.js` — plugin registrations.
- `plugins/legacy-pack*.plugin.js` — compatibility adapters for current gameplay modules.
- `plugins/base-game.plugin.js` — base game boot plugin.
- `plugins/examples/` — example extension.
- `PLUGIN-SDK.md` — plugin API and domain ownership rules.
- `ENGINE-ARCHITECTURE.md` — architecture and lifecycle.
- `ENGINE-ROADMAP.md` — staged migration plan.

## Current migration status

The engine boundary is active. The existing gameplay is intentionally preserved through compatibility adapters so this architectural milestone does not silently rewrite physics, balance, saves, visuals, or economy. Native feature extraction is the next step, domain by domain, with regression tests. New plugins can already be registered and run without editing engine core.
