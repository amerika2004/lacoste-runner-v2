(function (global) {
    'use strict';
    global.LacosteEngine.registerPlugin({
        id: 'legacy.powerups-weather-inventory',
        version: '1.0.0',
        minEngineVersion: '2.0.0',
        dependencies: ['legacy.combo-abilities-audio'],
        metadata: { type: 'compatibility-adapter', domain: ['powerups', 'inventory', 'weather', 'visual-effects'] },
        setup: async function (api) {
            await api.loadScript('js/pack2.js');
            api.logger.info('Legacy Pack 2 attached through the plugin boundary');
            return { dispose: function () { api.logger.info('Pack 2 adapter disposed'); } };
        }
    });
})(window);
