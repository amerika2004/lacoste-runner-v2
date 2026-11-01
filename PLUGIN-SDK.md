# Lacoste Engine Plugin SDK

This document is the contract for all new gameplay and platform modules.

## Minimal plugin

```js
(function (global) {
  'use strict';
  global.LacosteEngine.registerPlugin({
    id: 'gameplay.my-feature',
    version: '1.0.0',
    minEngineVersion: '2.0.0',
    dependencies: ['gameplay.player'],
    setup(api) {
      const off = api.events.on('player:jump', payload => {
        // Feature-specific reaction.
      });
      api.registerSystem({
        id: 'my-feature-update',
        priority: 20,
        update(dt, context, engine) {
          // dt is fixed-step seconds.
        },
        render(ctx, scene, engine) {
          // Optional canvas overlay.
        }
      });
      api.onCleanup(off);
      return {
        start() {},
        stop() {},
        dispose() {}
      };
    }
  });
})(window);
```

## API surface

- `api.events.on(event, callback, { once, priority })` / `api.events.emit(event, payload)`
- `api.state.get(path, fallback)` / `set(path, value)` / `update(path, fn)` / `transaction(fn)` / `subscribe(fn)`
- `api.clock` — fixed-step game clock (seconds in update callbacks)
- `api.input.isDown(code)` / `bind(action, codes)` / `isActionDown(action)`
- `api.assets.image(path)` / `api.assets.audio(path, options)`
- `api.storage.get(key, fallback)` / `getJSON` / `set` / `setJSON` / `remove` (automatically namespaced)
- `api.registerSystem({ id, priority, update, render })`
- `api.registerService(name, service)` / `api.getService(name)`
- `api.registerFeature(name, descriptor)`
- `api.registerUI(ReactComponent, { id })` or `api.ui.register(...)`
- `api.on(event, callback)` / `api.emit(event, payload)` / `api.onCleanup(fn)`
- `api.logger` / `api.config` / `api.plugin` / `api.engine`

## State ownership

A plugin owns its own domain state. It must not write directly to another plugin's storage keys or private fields. Cross-domain changes are expressed as events or a documented service. For example:

- `food` emits `food:collected`.
- `scoring` listens and updates run score.
- `economy` listens for `economy:reward-requested` and applies a validated transaction.
- `shop` requests a purchase; `economy` validates affordability and emits `economy:transaction-committed`.

## Module boundaries (target architecture)

| Plugin | Owns | Must not own |
|---|---|---|
| `gameplay.player` | Player physics, jump, animation, health, player input | Food, shop, biomes |
| `world.scene` | World clock, scrolling, layers, spawn timeline | Player physics, score rules |
| `gameplay.obstacles` | Hazards, collision definitions, obstacle lifecycle | Player health storage, currency |
| `gameplay.food` | Food types, spawn, collision, collection event | Score totals, shop rewards |
| `gameplay.powerups` | Powerup pickups/effects and effect lifecycle | Inventory purchase UI |
| `gameplay.abilities` | Dash, double jump, charges, ability cooldowns | Player movement implementation details |
| `gameplay.scoring` | Distance, score, combo and score multipliers | Currency persistence |
| `economy.wallet` | Currency ledger, validated transaction API | Shop catalog and presentation |
| `meta.shop` | Offers, prices presentation, purchase UX | Wallet internals |
| `meta.cosmetics` | Skin catalog, ownership, equip and unlock | Score or obstacle behavior |
| `meta.missions` | Mission objectives, progress, claims | Achievements and daily calendar |
| `meta.achievements` | Achievement criteria, unlocks and claims | Mission progression |
| `world.biomes-weather` | Biome transitions, weather and environment effects | Core scene lifecycle |
| `world.ufo-event` | UFO arrival, beam, food abduction, coin drops, catch reward | Food spawning or wallet internals |
| `platform.audio` | Sound buses, settings, asset playback, pause/resume | Gameplay rules |
| `platform.ads` | SDK integration, consent, ad lifecycle | Game reward logic; rewards are requested through a validated bridge |
| `ui.hud` | HUD layout and widgets | Game-state authority |

A feature may depend on public services/events from another plugin, but its code and state must remain in its owning plugin. Do not put one feature's logic in multiple plugins.
