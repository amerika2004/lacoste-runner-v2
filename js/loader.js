/* Engine bootstrap: plugins are loaded and validated before the game starts. */
(function () {
    'use strict';
    const engine = window.LacosteEngine;
    if (!engine || typeof engine.boot !== 'function') {
        console.error('[Bootstrap] Lacoste Engine core was not loaded.');
        showFatal('Не удалось запустить движок', 'Проверьте наличие engine/core.js и перезагрузите игру.');
        return;
    }

    function showFatal(title, message) {
        const root = document.getElementById('root') || document.body;
        const panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#080711;color:#fff;font:16px system-ui;padding:24px;text-align:center';
        panel.innerHTML = `<div style="max-width:560px"><h1 style="color:#ff5c7a">${escapeHTML(title)}</h1><p>${escapeHTML(message)}</p><button onclick="location.reload()" style="padding:12px 22px;border:0;border-radius:8px;background:#00e5ff;color:#080711;font-weight:800;cursor:pointer">Перезагрузить</button></div>`;
        root.appendChild(panel);
    }
    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    engine.boot('plugins/manifest.json').catch(error => {
        console.error('[Bootstrap] Fatal plugin/engine startup error:', error);
        showFatal('Ошибка запуска модульного движка', error && error.message ? error.message : 'Неизвестная ошибка запуска.');
    });
})();
