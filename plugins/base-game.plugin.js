(function (global) {
    'use strict';
    global.LacosteEngine.registerPlugin({
        id: 'game.base-runtime',
        version: '1.0.0',
        minEngineVersion: '2.0.0',
        dependencies: [
            'legacy.combo-abilities-audio',
            'legacy.powerups-weather-inventory',
            'legacy.progression-biomes-achievements',
            'legacy.economy-shop-ufo',
            'native.player-core',
            'native.world-core'
        ],
        metadata: { type: 'base-game-plugin', domain: ['runner-core', 'canvas-renderer', 'react-ui'] },
        setup: function (api) {
            api.logger.info('Base game plugin registered');
            return {
                start: function () {
                    api.bootGame();
                    api.logger.info('Base game boot requested');
                }
            };
        }
    });
})(window);
