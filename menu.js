/* ==================================================================
   menu.js — Universal MenuShell
   Фиксы:
     • Каждая вкладка — отдельный закешированный React-компонент
       → хуки не текут в MenuShell → нет чёрного экрана
     • Все вкладки остаются смонтированными (display:none) →
       состояние Shop/Promo сохраняется при переключении
     • Overlay absolute + panel 100%×100% → меню = игровое поле
     • Компактный CSS: минимум padding/margin — влезает без скролла
       на 1200×600, планшетах и телефонах-ландшафт
   ================================================================== */
(function () {
    'use strict';

    if (!window.React) { console.error('[MenuShell] React not loaded'); return; }

    function MenuShell(props) {
        const { tabs, initialTab, coins, onClose, headerBadge } = props;
        const [activeTab, setActiveTab] = React.useState(
            initialTab || (tabs[0] && tabs[0].id)
        );
        const current = tabs.find(t => t.id === activeTab) || tabs[0];

        const latestTabsRef = React.useRef(tabs);
        latestTabsRef.current = tabs;
        const cacheRef = React.useRef({});

        function getTabComponent(tabId) {
            if (!cacheRef.current[tabId]) {
                cacheRef.current[tabId] = function TabPanelContent() {
                    const latest = latestTabsRef.current.find(t => t.id === tabId);
                    if (!latest || typeof latest.render !== 'function') return null;
                    try {
                        return latest.render();
                    } catch (err) {
                        console.error('[MenuShell] Tab render error:', tabId, err);
                        return React.createElement('div', { className: 'ms-empty' },
                            '⚠️ Ошибка загрузки вкладки: ', String(tabId));
                    }
                };
            }
            return cacheRef.current[tabId];
        }

        return React.createElement('div', { className: 'ms-overlay' },
            React.createElement('div', { className: 'ms-panel' },

                React.createElement('div', { className: 'ms-header' },
                    React.createElement('div', { className: 'ms-title' },
                        React.createElement('span', { className: 'ms-title-icon' }, current?.icon || '🎮'),
                        React.createElement('span', null, current?.title || current?.label || 'MENU')
                    ),
                    React.createElement('div', { className: 'ms-header-right' },
                        coins !== undefined && React.createElement('div', { className: 'ms-coins' }, '💰 ', coins),
                        headerBadge && React.createElement('div', { className: 'ms-badge' }, headerBadge),
                        onClose && React.createElement('button', { className: 'ms-close', onClick: onClose, title: 'Close' }, '✕')
                    )
                ),

                tabs.length > 1 && React.createElement('div', { className: 'ms-tabs' },
                    tabs.map(t => React.createElement('button', {
                        key: t.id,
                        className: `ms-tab ${activeTab === t.id ? 'active' : ''}`,
                        onClick: () => setActiveTab(t.id)
                    },
                        React.createElement('span', { className: 'ms-tab-icon' }, t.icon || ''),
                        React.createElement('span', { className: 'ms-tab-label' }, t.label || t.id)
                    ))
                ),

                React.createElement('div', { className: 'ms-content' },
                    tabs.map(t => {
                        const Comp = getTabComponent(t.id);
                        return React.createElement('div', {
                            key: t.id,
                            className: 'ms-tab-panel' + (activeTab === t.id ? ' active' : '')
                        }, React.createElement(Comp));
                    })
                )
            )
        );
    }

    window.MenuShell = MenuShell;

    // ── CSS (инжектится один раз) ──
    if (!document.getElementById('ms-style')) {
        const css = `
            /* ═══ Оверлей / панель ═══ */
            .ms-overlay {
                position: absolute; inset: 0;
                background: rgba(0, 0, 0, 0.88);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                display: flex; align-items: stretch; justify-content: stretch;
                z-index: 20; padding: 4px; box-sizing: border-box;
                animation: msFadeIn 0.18s ease;
            }
            @keyframes msFadeIn { from { opacity: 0; } to { opacity: 1; } }

            .ms-panel {
                width: 100%; height: 100%;
                background: linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f172a 100%);
                border: 2px solid rgba(255,215,0,0.35);
                border-radius: 10px;
                box-shadow: 0 16px 60px rgba(0,0,0,0.7), inset 0 0 40px rgba(255,215,0,0.04);
                display: flex; flex-direction: column;
                overflow: hidden; box-sizing: border-box;
                padding: 8px 12px;
            }

            /* ═══ Header ═══ */
            .ms-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 4px 8px; margin-bottom: 4px;
                background: linear-gradient(90deg, rgba(255,215,0,0.15), rgba(155,48,255,0.1));
                border-bottom: 1px solid rgba(255,215,0,0.25);
                border-radius: 6px;
                flex-shrink: 0;
            }
            .ms-title {
                display: flex; align-items: center; gap: 5px;
                font-family: 'Rajdhani', 'Montserrat', sans-serif;
                font-weight: 800; font-size: 14px; letter-spacing: 1px;
                color: #FFD700; text-shadow: 0 0 8px rgba(255,215,0,0.4);
                text-transform: uppercase;
            }
            .ms-title-icon { font-size: 16px; }
            .ms-header-right { display: flex; align-items: center; gap: 6px; }
            .ms-coins {
                font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 12px;
                color: #FFD700; background: rgba(0,0,0,0.4);
                padding: 2px 8px; border-radius: 12px;
                border: 1px solid rgba(255,215,0,0.35);
            }
            .ms-badge {
                font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 10px;
                color: #00FFFF; background: rgba(0,255,255,0.1);
                padding: 2px 7px; border-radius: 10px;
                border: 1px solid rgba(0,255,255,0.3);
            }
            .ms-close {
                width: 24px; height: 24px; border-radius: 50%;
                background: rgba(255,0,80,0.15);
                border: 1px solid rgba(255,0,80,0.4);
                color: #FF3333; font-size: 12px; cursor: pointer;
                transition: all 0.15s;
                display: flex; align-items: center; justify-content: center;
            }
            .ms-close:hover { background: rgba(255,0,80,0.35); transform: scale(1.08); }

            /* ═══ Навигация ═══ */
            .ms-tabs {
                display: flex; gap: 3px;
                padding: 3px 4px 0;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                flex-shrink: 0; overflow-x: auto; scrollbar-width: none;
            }
            .ms-tabs::-webkit-scrollbar { display: none; }
            .ms-tab {
                display: flex; align-items: center; gap: 4px;
                padding: 5px 10px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.1);
                border-bottom: none; border-radius: 8px 8px 0 0;
                color: rgba(255,255,255,0.6);
                font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 11px;
                letter-spacing: 0.5px; cursor: pointer; transition: all 0.15s;
                white-space: nowrap;
            }
            .ms-tab:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }
            .ms-tab.active {
                background: linear-gradient(180deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05));
                border-color: rgba(255,215,0,0.5); color: #FFD700;
            }
            .ms-tab-icon { font-size: 12px; }

            /* ═══ Контент ═══ */
            .ms-content { flex: 1; min-height: 0; position: relative; overflow: hidden; }
            .ms-tab-panel {
                display: none;
                position: absolute; inset: 0;
                overflow-y: auto; overflow-x: hidden;
                padding: 8px 10px;
                box-sizing: border-box;
                scrollbar-width: thin;
                scrollbar-color: rgba(255,215,0,0.4) transparent;
            }
            .ms-tab-panel.active { display: block; }
            .ms-tab-panel::-webkit-scrollbar { width: 5px; }
            .ms-tab-panel::-webkit-scrollbar-thumb { background: rgba(255,215,0,0.35); border-radius: 3px; }
            .ms-tab-panel p { margin: 2px 0; font-size: 10px; }

            /* ═══ Section title ═══ */
            .ms-section-title {
                font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 11px;
                letter-spacing: 1px; color: #FFD700; text-transform: uppercase;
                margin-bottom: 4px; padding-bottom: 2px;
                border-bottom: 1px solid rgba(255,215,0,0.2);
            }

            /* ═══ Grid карточек ═══ */
            .ms-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
                gap: 6px;
            }
            .ms-card {
                background: linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 8px; padding: 8px 6px;
                display: flex; flex-direction: column; align-items: center;
                gap: 4px; text-align: center; position: relative;
                transition: all 0.15s;
            }
            .ms-card:hover { transform: translateY(-1px); border-color: rgba(255,215,0,0.35); }
            .ms-card.owned { border-color: rgba(0,255,180,0.35); background: linear-gradient(160deg, rgba(0,255,180,0.08), rgba(0,255,180,0.02)); }
            .ms-card.maxed { border-color: rgba(155,48,255,0.5); background: linear-gradient(160deg, rgba(155,48,255,0.12), rgba(155,48,255,0.03)); }
            .ms-card-icon { font-size: 22px; line-height: 1; }
            .ms-card-name { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 11px; color: #fff; }
            .ms-card-sub { font-size: 9px; opacity: 0.65; margin-bottom: 2px; }
            .ms-card-tier {
                position: absolute; top: 4px; right: 4px;
                padding: 1px 5px; border-radius: 6px;
                font-size: 8px; font-weight: 800; letter-spacing: 0.3px;
            }
            .ms-buy-btn {
                width: 100%; margin-top: auto; padding: 5px 8px; border-radius: 6px;
                border: 1px solid rgba(255,215,0,0.4);
                background: linear-gradient(180deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05));
                color: #FFD700; font-family: 'Rajdhani', sans-serif;
                font-weight: 800; font-size: 10px; letter-spacing: 0.3px;
                cursor: pointer; transition: all 0.15s;
            }
            .ms-buy-btn:hover:not(:disabled) { background: linear-gradient(180deg, rgba(255,215,0,0.3), rgba(255,215,0,0.1)); transform: scale(1.02); }
            .ms-buy-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .ms-buy-btn.equipped { background: linear-gradient(180deg, rgba(0,255,180,0.25), rgba(0,255,180,0.1)); border-color: rgba(0,255,180,0.5); color: #00FFB4; }
            .ms-buy-btn.maxed { background: linear-gradient(180deg, rgba(155,48,255,0.25), rgba(155,48,255,0.1)); border-color: rgba(155,48,255,0.5); color: #C77DFF; }

            /* ═══ Персонажи / время суток / кнопки ═══ */
            .ms-char-tabs { display: flex; gap: 4px; margin-bottom: 6px; flex-wrap: wrap; }
            .ms-char-tab {
                flex: 1; min-width: 80px; padding: 6px 10px; border-radius: 6px;
                border: 1px solid rgba(255,255,255,0.15);
                background: rgba(255,255,255,0.04);
                color: rgba(255,255,255,0.7);
                font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 11px;
                cursor: pointer; display: flex; align-items: center; gap: 5px;
                justify-content: center; transition: all 0.15s;
            }
            .ms-char-tab:hover { background: rgba(255,255,255,0.08); }
            .ms-char-tab.active { border-color: #FFD700; background: linear-gradient(180deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05)); color: #FFD700; }

            .ms-tod { display: flex; gap: 6px; justify-content: flex-start; margin-bottom: 6px; }
            .ms-tod-btn {
                padding: 5px 14px; border-radius: 14px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7);
                font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 11px;
                cursor: pointer;
            }
            .ms-tod-btn.active { border-color: #FFD700; color: #FFD700; background: rgba(255,215,0,0.15); }

            .ms-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
            .ms-btn {
                padding: 7px 14px; border-radius: 8px;
                border: 1px solid rgba(255,215,0,0.4);
                background: linear-gradient(180deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05));
                color: #FFD700; font-family: 'Rajdhani', sans-serif;
                font-weight: 800; letter-spacing: 0.5px; font-size: 12px;
                cursor: pointer; transition: all 0.15s;
            }
            .ms-btn:hover { background: linear-gradient(180deg, rgba(255,215,0,0.35), rgba(255,215,0,0.1)); }
            .ms-btn.primary { background: linear-gradient(180deg, #FFD700, #FF8C00); color: #0a0a1a; border-color: #FFD700; }
            .ms-btn.primary:hover { transform: scale(1.03); box-shadow: 0 4px 16px rgba(255,215,0,0.4); }
            .ms-btn.ghost { background: transparent; border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.75); }

            .ms-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
            .ms-row span { font-size: 12px; }

            /* ═══ Home tab ═══ */
            .ms-home-title {
                font-family: 'Rajdhani', sans-serif; font-weight: 900; font-size: 32px;
                letter-spacing: 4px; text-align: center;
                background: linear-gradient(180deg, #FFD700, #FF8C00);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                margin-bottom: 0; line-height: 1;
            }
            .ms-home-sub {
                text-align: center; font-family: 'Montserrat', sans-serif;
                font-size: 10px; letter-spacing: 3px; opacity: 0.7;
                margin: 2px 0 8px;
            }
            .ms-home-stats {
                text-align: center; font-family: 'Rajdhani', sans-serif;
                font-size: 14px; color: #FFD700; margin: 4px 0 8px;
            }
            .ms-home-start {
                width: 100%; padding: 10px 14px; font-size: 16px;
                letter-spacing: 2px; border-radius: 10px;
            }

            /* ═══ Progress ═══ */
            .ms-progress { width: 100%; height: 4px; border-radius: 2px; background: rgba(0,0,0,0.4); overflow: hidden; margin: 2px 0; }
            .ms-progress-bar { height: 100%; background: linear-gradient(90deg, #00FFFF, #FFD700); transition: width 0.2s; }
            .ms-progress-bar.maxed { background: linear-gradient(90deg, #9B30FF, #FF0080); }

            .ms-empty { text-align: center; padding: 20px 12px; color: rgba(255,255,255,0.5); font-family: 'Rajdhani', sans-serif; font-size: 12px; }

            .ms-input {
                width: 100%; padding: 7px 10px; border-radius: 6px;
                border: 1px solid rgba(255,215,0,0.3);
                background: rgba(0,0,0,0.4); color: #fff;
                font-family: 'Rajdhani', sans-serif; font-size: 12px; letter-spacing: 0.5px;
            }
            .ms-input:focus { outline: none; border-color: rgba(255,215,0,0.7); box-shadow: 0 0 8px rgba(255,215,0,0.2); }

            /* ═══ Promo ═══ */
            .ms-promo-card {
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,215,0,0.2);
                border-radius: 8px; padding: 10px; margin-bottom: 8px;
            }
            .ms-promo-code {
                font-family: 'Courier New', monospace; font-size: 16px; font-weight: 800;
                letter-spacing: 2px; color: #00FFFF;
                text-shadow: 0 0 8px rgba(0,255,255,0.5);
                padding: 6px; background: rgba(0,0,0,0.4); border-radius: 6px;
                text-align: center; user-select: all;
            }
            .ms-promo-hint { font-size: 10px; opacity: 0.6; margin-top: 4px; }

            /* ═══════════════════════════════════════════════════════════
               МОБИЛЬНЫЙ / КОМПАКТНЫЙ РЕЖИМ
               Срабатывает на низких экранах и узких экранах:
                 • phone landscape 800×400  → max-height: 500px
                 • phone portrait  400×200  → max-height: 500px (catches both)
                 • старые ноуты    1024×576 → max-height: 600px
               ═══════════════════════════════════════════════════════════ */
            @media (max-height: 500px), (max-width: 640px) {
                .ms-overlay { padding: 2px; }
                .ms-panel { padding: 4px 8px; border-radius: 8px; border-width: 1px; }

                .ms-header { padding: 3px 5px; margin-bottom: 2px; border-radius: 4px; }
                .ms-title { font-size: 11px; letter-spacing: 0.5px; gap: 4px; }
                .ms-title-icon { font-size: 13px; }
                .ms-coins { font-size: 10px; padding: 1px 6px; border-radius: 8px; }
                .ms-badge { font-size: 9px; padding: 1px 5px; }
                .ms-close { width: 20px; height: 20px; font-size: 10px; }

                .ms-tabs { padding: 2px 3px 0; gap: 2px; }
                .ms-tab { padding: 4px 7px; font-size: 9px; border-radius: 5px 5px 0 0; gap: 3px; }
                .ms-tab-icon { font-size: 10px; }
                .ms-tab-label { display: none; }  /* на компакте — только иконки */

                .ms-tab-panel { padding: 4px 6px; }
                .ms-section-title { font-size: 9px; margin-bottom: 3px; padding-bottom: 1px; letter-spacing: 0.5px; margin-top: 4px !important; }
                .ms-tab-panel p { font-size: 9px; }

                .ms-grid { grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 3px; }
                .ms-card { padding: 4px 3px; gap: 2px; border-radius: 6px; }
                .ms-card-icon { font-size: 18px; }
                .ms-card-name { font-size: 9px; }
                .ms-card-sub { font-size: 7px; }
                .ms-card-tier { font-size: 7px; padding: 1px 4px; top: 2px; right: 2px; }
                .ms-buy-btn { padding: 3px 4px; font-size: 8px; border-radius: 4px; }
                .ms-progress { height: 3px; margin: 1px 0; }

                .ms-char-tabs { gap: 3px; margin-bottom: 4px; }
                .ms-char-tab { padding: 4px 6px; font-size: 9px; min-width: 60px; border-radius: 4px; }
                .ms-tod { gap: 4px; margin-bottom: 4px; }
                .ms-tod-btn { padding: 3px 8px; font-size: 9px; border-radius: 10px; }
                .ms-actions { gap: 3px; margin-top: 4px; }
                .ms-btn { padding: 5px 8px; font-size: 10px; border-radius: 6px; }
                .ms-row { gap: 4px; margin-bottom: 3px; }
                .ms-row span { font-size: 10px; }
                .ms-input { padding: 5px 8px; font-size: 10px; }

                .ms-home-title { font-size: 20px; letter-spacing: 2px; }
                .ms-home-sub { font-size: 8px; letter-spacing: 2px; margin: 0 0 4px; }
                .ms-home-stats { font-size: 11px; margin: 2px 0 4px; }
                .ms-home-start { padding: 6px 10px; font-size: 13px; letter-spacing: 1px; border-radius: 8px; }

                .ms-promo-card { padding: 6px; margin-bottom: 4px; border-radius: 6px; }
                .ms-promo-code { font-size: 12px; letter-spacing: 1px; padding: 4px; }
                .ms-promo-hint { font-size: 8px; margin-top: 2px; }
                .ms-empty { padding: 12px 6px; font-size: 10px; }
            }

            /* ═══ Совсем узкие экраны — 2 колонки для nav не рвём ═══ */
            @media (max-width: 400px) {
                .ms-nav { flex-wrap: nowrap; }
                .ms-tab { flex: 0 0 auto; }
            }
        `;
        const style = document.createElement('style');
        style.id = 'ms-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    console.log('%c🎨 Universal MenuShell (compact) loaded', 'color:#FFD700;font-weight:bold');
})();
