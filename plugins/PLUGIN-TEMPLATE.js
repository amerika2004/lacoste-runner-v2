(function (global) {
    'use strict';
    global.LacosteEngine.registerPlugin({
        id: 'vendor.feature-name',
        version: '1.0.0',
        minEngineVersion: '2.0.0',
        dependencies: [],
        metadata: { description: 'Describe this plugin and its ownership boundary.' },
        setup: function (api) {
            const state = { active: false };
            const off = api.events.on('game:start', function () { state.active = true; });
            api.registerSystem({
                id: 'feature-update',
                priority: 0,
                update: function (dt, context) {
                    if (!state.active) return;
                    // Keep feature logic here; do not add it to engine/core.js.
                }
            });
            api.onCleanup(off);
            return {
                start: function () { api.logger.info('Feature plugin started'); },
                dispose: function () { state.active = false; }
            };
        }
    });
})(window);
