# Native module migration — phase 1

## Added
- `native.player-core`: a stable `player.core` service, immutable player snapshots, state-store publishing, and lifecycle events.
- `native.world-core`: a stable `world.core` service, immutable world snapshots, and world event routing.
- The runtime publishes player/world snapshots after the existing authoritative simulation update.
- Both modules are manifest-loaded and dependency-managed; the base runtime explicitly depends on them.
- Future modules can read the services or subscribe to `player:snapshot` / `world:snapshot` without editing `engine/core.js`.

## Migration boundary (important)
This is the first extraction phase, not a claim that all gameplay simulation has already moved out of `game.js`. Legacy movement, collision resolution, spawning, and rendering remain authoritative for compatibility. The native services establish the contracts and event boundary; subsequent phases can move those algorithms behind these services incrementally.

## Verification
- `npm test`: 7/7 tests passed.
- `npm run check`: passed; 18 JavaScript files and manifest paths checked.
- Browser visual and device QA remain separate release gates.
