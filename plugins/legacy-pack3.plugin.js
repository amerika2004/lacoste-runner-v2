(function (global) {
    'use strict';
    global.LacosteEngine.registerPlugin({
        id: 'legacy.progression-biomes-achievements',
        version: '1.0.0',
        minEngineVersion: '2.0.0',
        dependencies: ['legacy.powerups-weather-inventory'],
        metadata: { type: 'compatibility-adapter', domain: ['daily-goals', 'achievements', 'biomes', 'music'] },
        setup: async function (api) {
            await api.loadScript('js/pack3.js');
            api.logger.info('Legacy Pack 3 attached through the plugin boundary');
            return { dispose: function () { api.logger.info('Pack 3 adapter disposed'); } };
        }
    });
})(window);
