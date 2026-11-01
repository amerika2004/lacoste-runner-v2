# HUD UX update v2.1.3

## Changes
- HUD scale anchor moved to the top-right corner (`transform-origin: top right`).
- Inventory buttons compacted into a slim centered bottom bar.
- Combo indicator moved to the right side, away from food/vitals.
- Center notifications constrained to a compact stack.
- Frequent food bonus and HP feedback routed to a discreet side rail; important notifications remain central.
- Mobile HUD spacing and control sizes reduced.

## Validation
- `npm test`: 7/7 passed.
- `npm run check`: passed.

Visual validation on desktop/mobile browsers remains necessary.
