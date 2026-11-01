(function (global) {
    'use strict';
    global.LacosteEngine.registerPlugin({
        id: 'legacy.combo-abilities-audio',
        version: '1.0.0',
        minEngineVersion: '2.0.0',
        metadata: { type: 'compatibility-adapter', domain: ['combo', 'abilities', 'gameplay-audio', 'effects'] },
        setup: async function (api) {
            await api.loadScript('js/pack1.js');
            api.logger.info('Legacy Pack 1 attached through the plugin boundary');
            return { dispose: function () { api.logger.info('Pack 1 adapter disposed'); } };
        }
    });
})(window);
