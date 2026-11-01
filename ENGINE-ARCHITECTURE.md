# Lacoste Modular Engine 2.0

## Design goal
The engine is the stable platform. Game mechanics are plugins. Adding a plugin must not require editing `engine/core.js`, `game.js`, or `index.html`; the developer adds a plugin script to `plugins/manifest.json`, declares dependencies, and implements the plugin contract.

## Runtime layers

1. **Engine core (`engine/core.js`)** — lifecycle, event bus, state store, fixed-step clock, input, asset cache, plugin manager, services, update/render system registries. No game rules or UI markup belong here.
2. **Plugin modules (`plugins/*.plugin.js`)** — independently registered features. Plugins can depend on other plugins, register systems/services, subscribe to events, and dispose resources.
3. **Base-game plugin (`plugins/base-game.plugin.js`)** — bootstraps the current game presentation/runtime after feature adapters have been installed.
4. **Compatibility adapters (`plugins/legacy-pack*.plugin.js`)** — load the existing feature packs behind the new plugin boundary while preserving current game behavior during migration.
5. **Game shell (`game.js`, `menu.js`, `style.css`)** — current React/Canvas implementation. It now forwards lifecycle, fixed-step update and render hooks to the engine.

## Plugin lifecycle

`registered -> installed -> running -> disposed`

- `registerPlugin(definition)` validates ID, setup callback, minimum engine version, and uniqueness.
- `setup(api)` runs after dependency ordering. It may register systems/services and return lifecycle callbacks.
- `start()` runs in dependency order.
- `dispose()` and API cleanup handlers run in reverse order.
- Plugin setup/start failures stop boot and show a fatal overlay. A failed required plugin is not silently skipped.
- Exceptions in update/render systems are isolated and reported as `plugin:error` so one optional extension does not break the main loop.

## Plugin API

```js
window.LacosteEngine.registerPlugin({
  id: 'feature.example',
  version: '1.0.0',
  minEngineVersion: '2.0.0',
  dependencies: ['feature.required'],
  setup(api) {
    const off = api.events.on('game:start', payload => { /* feature state */ });
    api.registerSystem({
      id: 'update',
      priority: 10,
      update(dt, context, engine) { /* deterministic update */ },
      render(ctx, scene, engine) { /* optional canvas overlay */ }
    });
    api.onCleanup(off);
    return {
      start() {},
      dispose() {}
    };
  }
});
```

`api` includes `engine`, `plugin`, `logger`, `events`, `state`, `clock`, `input`, `assets`, `config`, namespaced `storage`, `registerSystem`, `registerService`, `getService`, `loadScript`, `bootGame`, `on`, `emit`, and `onCleanup`.

## Event conventions

Use domain events rather than calling another plugin's private functions:

- `game:start`, `game:over`, `game:state`, `game:pause`, `game:resume`
- `engine:update`, `engine:render`, `plugin:installed`, `plugin:started`, `plugin:error`
- feature events use namespaced names: `player:jump`, `food:collected`, `economy:coins-changed`, `ufo:abduction-started`.

Payloads should be plain objects. Treat event payloads as immutable; consumers should copy before mutation.

## Adding a plugin

1. Add `plugins/my-feature.plugin.js`.
2. Register the plugin with a unique ID and dependencies.
3. Add the script path to `plugins/manifest.json`.
4. Run `npm test` and `npm run check`.
5. Do not edit engine core or the base game to install a plugin.

## Current migration status

The engine/plugin boundary is active and the current game boots through `game.base-runtime`. The existing packs are temporarily exposed through compatibility adapter plugins to protect the current gameplay and visual design. The next migration phase should extract each domain into native plugins—Player, World, Obstacles, Food/Collectibles, Scoring, Abilities, UFO, Economy, Shop/Cosmetics, Missions, Achievements, Biomes/Weather, Audio, HUD/UI—then remove the legacy adapters. Avoid a big-bang rewrite; migrate one domain at a time with parity tests.

## Production principles

- Engine core owns lifecycle and technical services, not game design.
- Features own their own state, events, config schema, UI and tests.
- No feature should require edits to the engine core.
- No cross-plugin private globals; communicate through public events/services.
- All plugin resources must have deterministic cleanup.
- Avoid unbounded listeners, timers, particle collections and storage writes.
- Use engine time for gameplay timers; use wall-clock time only for calendar features.
- Required plugins fail fast; optional plugins may declare an explicit optional policy in future manifest versions.
