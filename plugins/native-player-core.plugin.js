/* Native Player Core contract. The legacy movement/collision implementation is
 * still the authoritative simulation during migration; this plugin owns the
 * stable player service and lifecycle/event boundary used by future modules. */
(function (global) {
  'use strict';
  global.LacosteEngine.registerPlugin({
    id: 'native.player-core', version: '1.0.0', minEngineVersion: '2.0.0',
    dependencies: ['legacy.combo-abilities-audio','legacy.powerups-weather-inventory','legacy.progression-biomes-achievements','legacy.economy-shop-ufo'],
    metadata: { type: 'native-core', domain: ['player-state','player-events'] },
    setup: function (api) {
      let snapshot = Object.freeze({ active: false, x: 0, y: 0, width: 0, height: 0, velocityY: 0, isJumping: false, isTripping: false, health: 0, maxHealth: 0 });
      let lastFrame = -1;
      const player = {
        getSnapshot: () => snapshot,
        isActive: () => snapshot.active,
        publish: data => {
          if (!data || typeof data !== 'object') return snapshot;
          snapshot = Object.freeze({ ...snapshot, ...data });
          api.state.set('player', snapshot);
          api.emit('player:snapshot', snapshot);
          return snapshot;
        }
      };
      api.registerService('player.core', player);
      api.on('game:player:update', data => { if (data && data.frame !== lastFrame) { lastFrame = data.frame; player.publish(data); } });
      api.on('game:start', () => { snapshot = Object.freeze({ ...snapshot, active: true }); api.state.set('player', snapshot); });
      api.on('game:over', () => { snapshot = Object.freeze({ ...snapshot, active: false }); api.state.set('player', snapshot); });
      api.on('game:state', data => { if (data && data.current !== 'playing') snapshot = Object.freeze({ ...snapshot, active: false }); else if (data) snapshot = Object.freeze({ ...snapshot, active: true }); api.state.set('player', snapshot); });
      api.logger.info('Player Core contract ready');
    }
  });
})(window);
