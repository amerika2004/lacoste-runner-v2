# Modular Engine Migration Roadmap

## Milestone 1 — Engine boundary (delivered in this build)

- Plugin registry and dependency graph.
- Lifecycle (`setup/start/stop/dispose`) and enable/disable.
- Event bus with listener cleanup and legacy callback-array compatibility.
- State store, fixed-step game clock, input facade and asset cache.
- Update/render systems and plugin UI registration.
- Fail-fast boot loader and fatal startup UI.
- Existing gameplay attached through compatibility adapters.
- Node tests and source checks.

## Milestone 2 — Native gameplay plugins (next)

Migrate one bounded domain at a time; preserve the current visuals and compare behavior against the legacy build.

1. `gameplay.player` — extract player model/physics/input/animation/health.
2. `world.scene` — extract world scrolling, spawn schedule and render scene contract.
3. `gameplay.obstacles` — obstacle factories and collision events.
4. `gameplay.food` — food spawn, types and collection events.
5. `gameplay.scoring` — distance/score/combo, with explicit rule configuration.
6. `gameplay.abilities` — Dash, Double Jump, charges and shield.
7. `gameplay.powerups` — pickup and timed effects.
8. `world.ufo-event` — move UFO state machine out of `game.js` and pack4.
9. `economy.wallet` + `meta.shop` + `meta.cosmetics`.
10. `meta.missions` + `meta.achievements` + daily goal.
11. `world.biomes-weather` + `platform.audio`.
12. `ui.hud` and menu panels.

At the end of each extraction, delete the corresponding legacy code only after parity tests pass. Do not leave two competing sources of truth.

## Milestone 3 — Production hardening

- Pin/self-host React and fonts; establish reproducible production build.
- Add schema validation for config and plugin manifests.
- Add deterministic seeded random for tests/replays.
- Add browser E2E tests for start, jump, collect, hit, pause, restart, game over, shop, save/load.
- Add frame-time/memory/performance budgets and mobile touch QA.
- Add versioned save migrations.
- Add error reporting and analytics adapter.

## Milestone 4 — Commercial platform modules

- Separate platform SDK plugin(s) from gameplay.
- Add consent and privacy policy integration.
- Add rewarded-ad flow with reward verification and pause/resume.
- Add platform-specific build profiles rather than shipping all SDKs at once.
- Add telemetry for retention, session length, rewarded opt-in, ad fill, and monetization.

## Acceptance gates

- New feature plugin can be added by adding one script to `plugins/manifest.json`; engine files remain unchanged.
- No feature writes another plugin's private state.
- Plugin can be disabled and re-enabled without stale listeners/systems.
- Required dependency failures stop boot with an actionable error.
- No fatal console errors during core play loop.
- Regression suite passes before and after each domain extraction.
- Existing design, player controls, shop, and UFO behavior remain visually/functionally equivalent unless a deliberate change is approved.
