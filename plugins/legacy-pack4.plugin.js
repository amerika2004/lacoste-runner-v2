(function (global) {
    'use strict';
    global.LacosteEngine.registerPlugin({
        id: 'legacy.economy-shop-ufo',
        version: '1.0.0',
        minEngineVersion: '2.0.0',
        dependencies: ['legacy.progression-biomes-achievements'],
        metadata: { type: 'compatibility-adapter', domain: ['economy', 'shop', 'skins', 'missions', 'ufo', 'promo'] },
        setup: async function (api) {
            await api.loadScript('js/pack4.js');
            api.logger.info('Legacy Pack 4 attached through the plugin boundary');
            return { dispose: function () { api.logger.info('Pack 4 adapter disposed'); } };
        }
    });
})(window);
