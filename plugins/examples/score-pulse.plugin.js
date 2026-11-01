/* Copy this file into plugins/, add its path to plugins/manifest.json,
   then add dependencies if it consumes another plugin's service. */
(function (global) {
    'use strict';
    global.LacosteEngine.registerPlugin({
        id: 'example.score-pulse',
        version: '1.0.0',
        minEngineVersion: '2.0.0',
        dependencies: [],
        metadata: { author: 'Lacoste Runner', description: 'Example native extension plugin' },
        setup: function (api) {
            let elapsed = 0;
            api.registerSystem({
                id: 'pulse-update',
                priority: 0,
                update: function (dt, context) {
                    elapsed += dt;
                    // Plugin code receives context and services; it does not modify engine/core.js.
                    if (elapsed >= 1) {
                        elapsed = 0;
                        api.events.emit('example:score-pulse', { distance: context.distance || 0 });
                    }
                },
                render: function (ctx, scene) {
                    // Example render hook. Remove this method if the plugin has no visuals.
                    if (!ctx || !scene) return;
                }
            });
            return { start: function () { api.logger.info('Example plugin started'); } };
        }
    });
})(window);
