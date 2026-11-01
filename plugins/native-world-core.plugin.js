/* Native World Core contract for world snapshots and collision/event routing. */
(function (global) {
  'use strict';
  global.LacosteEngine.registerPlugin({
    id: 'native.world-core', version: '1.0.0', minEngineVersion: '2.0.0',
    dependencies: ['native.player-core'],
    metadata: { type: 'native-core', domain: ['world-state','world-events'] },
    setup: function (api) {
      let snapshot = Object.freeze({ frame: 0, groundY: 0, obstacles: [], foods: [], biome: null, timeOfDay: 'day' });
      const world = {
        getSnapshot: () => snapshot,
        publish: data => {
          if (!data || typeof data !== 'object') return snapshot;
          snapshot = Object.freeze({ ...snapshot, ...data,
            obstacles: Array.isArray(data.obstacles) ? data.obstacles.slice() : snapshot.obstacles,
            foods: Array.isArray(data.foods) ? data.foods.slice() : snapshot.foods });
          api.state.set('world', snapshot);
          api.emit('world:snapshot', snapshot);
          return snapshot;
        }
      };
      api.registerService('world.core', world);
      api.on('game:world:update', world.publish);
      api.on('game:collision', data => api.emit('world:collision', data));
      api.logger.info('World Core contract ready');
    }
  });
})(window);
