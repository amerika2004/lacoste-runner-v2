window.GameEvents = window.GameEvents || {
    listeners: {},
    on(event, cb) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(cb); },
    emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => { try { cb(data); } catch(e) { console.error(e); } }); }
};
window.PackUIs = window.PackUIs || [];

/* ==================================================================
   PACK 3 — Biomes, Achievements, Daily Goals, Dynamic Music
   v2.0 — cumulative distance goal, throttling, audio guards, rewards
   ================================================================== */
(function () {
    'use strict';

    const PREFERS_REDUCED_MOTION = (() => {
        try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false; }
        catch { return false; }
    })();

    const P3_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.pack3) || {
        biomes: [{ id: 'forest', name: 'Forest', distance: 0, dayImg: 'source/landscape.jpg', nightImg: 'source/landscape_n.jpg', obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'] }],
        music: { layers: [], maxTempoRate: 1.15, tempoDistance: 2000 },
        achievements: [],
        dailyGoals: [],
    };

    // Defensive defaults
    if (!Array.isArray(P3_CONFIG.biomes) || !P3_CONFIG.biomes.length) {
        P3_CONFIG.biomes = [{ id: 'forest', name: 'Forest', distance: 0, dayImg: 'source/landscape.jpg', nightImg: 'source/landscape_n.jpg', obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'] }];
    }
    if (!P3_CONFIG.music || typeof P3_CONFIG.music !== 'object') {
        P3_CONFIG.music = { maxTempoRate: 1.15, tempoDistance: 2000 };
    }
    if (!Array.isArray(P3_CONFIG.achievements)) P3_CONFIG.achievements = [];
    if (!Array.isArray(P3_CONFIG.dailyGoals)) P3_CONFIG.dailyGoals = [];

    const Pack3State = {
        currentBiome: P3_CONFIG.biomes[0],
        nextBiome: null,
        musicAudios: [],
        musicLayers: [],
        settings: null,
        unlockedAchievements: (() => {
            try { return JSON.parse(localStorage.getItem('lacosteAchievements') || '{}') || {}; }
            catch (e) { return {}; }
        })(),
        dailyGoal: null,
        dailyGoalProgress: 0,
        dailyGoalClaimed: false,
        runStats: { distance: 0, jumps: 0, foodEaten: 0, lastHitDistance: 0, maxCombo: 0 },
        uiListeners: [],
        // internals
        lastTickDistance: 0,
        lastAchievementCheck: 0,
        dailyCheckTimer: 0,
        whooshAudio: null,
        achievementAudio: null,
        reducedMotion: PREFERS_REDUCED_MOTION,
    };

    window.Pack3State = Pack3State;

    // === UTIL ===
    function vibrate(pattern) {
        const s = Pack3State.settings;
        if (s && s.vibrateEnabled === false) return;
        if (Pack3State.reducedMotion) {
            if (Array.isArray(pattern)) pattern = pattern.map(v => Math.min(20, v));
            else if (typeof pattern === 'number') pattern = Math.min(20, pattern);
        }
        if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
    }

    function safePlay(audio, rate = 1.0, volMult = 1.0) {
        const s = Pack3State.settings;
        if (!audio || !s || !s.soundEnabled) return;
        try {
            if (audio.readyState >= 1) audio.currentTime = 0;
            audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
            audio.volume = Math.max(0, Math.min(1,
                (s.sfxVolume ?? 0.7) * (s.masterVolume ?? 1.0) * volMult
            ));
            audio.play().catch(() => {});
        } catch (e) {}
    }

    function showToast(text, type = 'success') {
        if (window.GameEvents) window.GameEvents.emit('pack3_toast', { text, type });
    }

    // Все пути к музыке и звукам задаются только в config.js -> GAME_CONFIG.audio.
    const AUDIO_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.audio) || {};
    const AUDIO_SFX = AUDIO_CONFIG.sfx || {};
    function makeConfiguredAudio(path, loop = false) {
        if (typeof path !== 'string' || !path.trim() || typeof Audio === 'undefined') return null;
        try { const audio = new Audio(path.trim()); audio.preload = 'auto'; if (loop) audio.loop = true; return audio; }
        catch (e) { return null; }
    }
    function initAudio() {
        if (Pack3State.musicAudios.length === 0) {
            const layers = Array.isArray(AUDIO_CONFIG.music?.layers) ? AUDIO_CONFIG.music.layers : [];
            layers.forEach(layer => {
                const audio = makeConfiguredAudio(layer?.file, true);
                if (!audio) return;
                audio.volume = 0;
                Pack3State.musicAudios.push(audio);
                Pack3State.musicLayers.push({ minDistance: Math.max(0, Number(layer.minDistance) || 0) });
            });
        }
        if (!Pack3State.whooshAudio) Pack3State.whooshAudio = makeConfiguredAudio(AUDIO_SFX.whoosh);
        if (!Pack3State.achievementAudio) Pack3State.achievementAudio = makeConfiguredAudio(AUDIO_SFX.achievement);
    }
    initAudio();

    // === DAILY GOALS ===
    function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

    function initDailyGoal() {
        if (!Pack3State.settings?.dailyGoalsEnabled) return;
        if (!P3_CONFIG.dailyGoals.length) return;
        try {
            const today = todayStr();
            const saved = JSON.parse(localStorage.getItem('lacosteDailyGoal') || 'null');
            if (saved && saved.date === today) {
                Pack3State.dailyGoal = P3_CONFIG.dailyGoals.find(g => g.id === saved.goalId) || P3_CONFIG.dailyGoals[0];
                Pack3State.dailyGoalProgress = Math.max(0, Math.min(Pack3State.dailyGoal.target, Number(saved.progress) || 0));
                Pack3State.dailyGoalClaimed = !!saved.claimed;
            } else {
                const goal = P3_CONFIG.dailyGoals[Math.floor(Math.random() * P3_CONFIG.dailyGoals.length)];
                Pack3State.dailyGoal = goal;
                Pack3State.dailyGoalProgress = 0;
                Pack3State.dailyGoalClaimed = false;
                localStorage.setItem('lacosteDailyGoal', JSON.stringify({ date: today, goalId: goal.id, progress: 0, claimed: false }));
            }
            if (Pack3State.dailyGoal && Pack3State.dailyGoalProgress >= Pack3State.dailyGoal.target && !Pack3State.dailyGoalClaimed) claimDailyReward();
        } catch (e) { console.warn('[pack3] daily goal init error', e); }
    }

    function saveDailyProgress() {
        if (!Pack3State.dailyGoal) return;
        try {
            localStorage.setItem('lacosteDailyGoal', JSON.stringify({
                date: todayStr(),
                goalId: Pack3State.dailyGoal.id,
                progress: Pack3State.dailyGoalProgress,
                claimed: Pack3State.dailyGoalClaimed,
            }));
        } catch (e) {}
    }

    function parseReward(reward) {
        // Supports: string ("Shield", "Magnet +1"), or object { kind, count }
        if (!reward) return [];
        if (typeof reward === 'object') return [reward];
        const out = [];
        const map = { 'shield': 'shield', 'magnet': 'magnet', 'sprint': 'sprint', 'slowmo': 'slowmo' };
        for (const [token, kind] of Object.entries(map)) {
            if (reward.toLowerCase().includes(token)) out.push({ kind, count: 1 });
        }
        return out;
    }

    function grantReward(reward) {
        if (!window.Pack4State?.addInventory) {
            showToast('Награда временно недоступна: хранилище инвентаря не загружено', 'danger');
            return false;
        }
        const rewards = parseReward(reward);
        if (!rewards.length) return false;
        rewards.forEach(r => window.Pack4State.addInventory(r.kind, r.count || 1));
        return true;
    }

    function claimDailyReward() {
        if (Pack3State.dailyGoalClaimed || !Pack3State.dailyGoal) return false;
        if (Pack3State.dailyGoalProgress < Pack3State.dailyGoal.target) return false;
        if (!grantReward(Pack3State.dailyGoal.reward)) return false;
        Pack3State.dailyGoalClaimed = true;
        saveDailyProgress();
        showToast(`🎁 Награда получена: ${Pack3State.dailyGoal.reward}`, 'success');
        return true;
    }

    function updateDailyProgress(amount) {
        if (!Pack3State.settings?.dailyGoalsEnabled) return;
        if (!Pack3State.dailyGoal) return;
        if (Pack3State.dailyGoalProgress >= Pack3State.dailyGoal.target) return;
        if (!(amount > 0)) return;

        Pack3State.dailyGoalProgress += amount;
        if (Pack3State.dailyGoalProgress > Pack3State.dailyGoal.target) {
            Pack3State.dailyGoalProgress = Pack3State.dailyGoal.target;
        }
        saveDailyProgress();
        Pack3State.uiListeners.forEach(fn => { try { fn(); } catch (e) {} });

        if (Pack3State.dailyGoalProgress >= Pack3State.dailyGoal.target && !Pack3State.dailyGoalClaimed) {
            showToast(`🎯 DAILY GOAL COMPLETE: ${typeof Pack3State.dailyGoal.reward === 'string' ? Pack3State.dailyGoal.reward : Pack3State.dailyGoal.title || 'reward'}`, 'success');
            claimDailyReward();
            safePlay(Pack3State.achievementAudio, 1.2, 1.0);
            vibrate([30, 40, 30]);
        }
    }

    // === ACHIEVEMENTS ===
    function isAchievementUnlocked(ach, snap) {
        // Generic: ach.type + ach.value
        if (ach.type) {
            switch (ach.type) {
                case 'distance':     return (snap.distance || 0) >= ach.value;
                case 'max_combo':    return (snap.maxCombo || 0) >= ach.value;
                case 'combo':        return (snap.combo || snap.maxCombo || 0) >= ach.value;
                case 'jumps':        return (snap.jumps || 0) >= ach.value;
                case 'food':         return (snap.foodEaten || 0) >= ach.value;
                case 'no_damage':    return (snap.distance || 0) - (snap.lastHitDistance || 0) >= ach.value;
                default:             return false;
            }
        }
        // Legacy hardcoded IDs
        if (ach.id === 'dist_1000' && snap.distance >= 1000) return true;
        if (ach.id === 'dist_3000' && snap.distance >= 3000) return true;
        if (ach.id === 'no_damage_500' && snap.distance - snap.lastHitDistance >= 500) return true;
        if (ach.id === 'food_50' && snap.foodEaten >= 50) return true;
        if (ach.id === 'jumps_100' && snap.jumps >= 100) return true;
        if (ach.id === 'combo_10') {
            const c = Math.max(snap.combo || 0, snap.maxCombo || 0);
            return c >= 20;
        }
        return false;
    }

    function snapshotStats(data) {
        return {
            distance: data?.distance ?? Pack3State.runStats.distance,
            jumps: Pack3State.runStats.jumps,
            foodEaten: Pack3State.runStats.foodEaten,
            lastHitDistance: Pack3State.runStats.lastHitDistance,
            maxCombo: Pack3State.runStats.maxCombo,
            combo: data?.combo || 0,
        };
    }

    function checkAchievements(data, force = false) {
        if (!Pack3State.settings?.achievementsEnabled) return;

        const now = Date.now();
        if (!force && now - Pack3State.lastAchievementCheck < 500) return;
        Pack3State.lastAchievementCheck = now;

        const snap = snapshotStats(data);
        let changed = false;

        for (const ach of P3_CONFIG.achievements) {
            if (Pack3State.unlockedAchievements[ach.id]) continue;
            let ok = false;
            try { ok = isAchievementUnlocked(ach, snap); }
            catch (e) { console.error('[pack3] ach check', ach.id, e); }

            if (ok) {
                Pack3State.unlockedAchievements[ach.id] = true;
                changed = true;
                showToast(`🏆 ACHIEVEMENT: ${ach.title || ach.id}`, 'success');
                if (window.RenderEngine && !Pack3State.reducedMotion) {
                    window.RenderEngine.flash('255,215,0', 0.5);
                }
                safePlay(Pack3State.achievementAudio, 1.4, 0.9);
                vibrate([20, 30, 20, 30, 50]);
            }
        }
        if (changed) {
            try { localStorage.setItem('lacosteAchievements', JSON.stringify(Pack3State.unlockedAchievements)); }
            catch (e) {}
        }
    }

    // === MUSIC ===
    function startMusic() {
        if (!Pack3State.settings?.dynamicMusicEnabled) return;
        Pack3State.musicAudios.forEach((a, i) => {
            try {
                if (a.readyState >= 1) a.currentTime = 0;
                a.volume = i === 0 ? musicVolume() : 0;
                a.play().catch(() => {});
            } catch (e) {}
        });
    }

    function musicVolume() {
        const s = Pack3State.settings || {};
        if (!s.soundEnabled) return 0;
        return Math.max(0, Math.min(1,
            (s.ambientVolume ?? 0.25) * (s.masterVolume ?? 1.0) * 0.8
        ));
    }

    function updateMusic(distance) {
        if (!Pack3State.musicAudios.length) return;
        if (!Pack3State.settings?.dynamicMusicEnabled) {
            Pack3State.musicAudios.forEach(a => { a.volume = 0; });
            return;
        }
        const base = P3_CONFIG.music;
        const tempoRate = 1.0 + Math.min((distance || 0) / (base.tempoDistance || 2000), 1.0) * ((base.maxTempoRate || 1.15) - 1.0);
        const maxVol = musicVolume();

        Pack3State.musicAudios.forEach((audio, index) => {
            const layer = Pack3State.musicLayers[index];
            if (!layer) return;
            try {
                audio.playbackRate = tempoRate;
                if (audio.paused && Pack3State.settings?.dynamicMusicEnabled) audio.play().catch(() => {});
            } catch (e) {}
            const targetVolume = (distance || 0) >= (layer.minDistance || 0) ? maxVol : 0;
            audio.volume += (targetVolume - audio.volume) * 0.05;
        });
    }

    // === BIOMES ===
    function detectBiome(distance) {
        let result = P3_CONFIG.biomes[0];
        for (let i = P3_CONFIG.biomes.length - 1; i >= 0; i--) {
            if ((distance || 0) >= P3_CONFIG.biomes[i].distance) { result = P3_CONFIG.biomes[i]; break; }
        }
        return result;
    }

    // === LIFECYCLE ===
    window.GameEvents.on('start', (data) => {
        Pack3State.settings = data?.settings || Pack3State.settings;
        initAudio();
        initDailyGoal();

        Pack3State.currentBiome = P3_CONFIG.biomes[0];
        Pack3State.nextBiome = null;
        Pack3State.runStats = { distance: 0, jumps: 0, foodEaten: 0, lastHitDistance: 0, maxCombo: 0 };
        Pack3State.lastTickDistance = 0;
        Pack3State.lastAchievementCheck = 0;
        Pack3State.dailyCheckTimer = 0;

        startMusic();
    });

    // === TICK ===
    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack3State.settings = data.settings;
        Pack3State.runStats.distance = data.distance || 0;

        // Combined combo (Pack1 OR game.js comboRef)
        const comboNow = Math.max(data.combo || 0, window.Pack1State?.combo || 0);
        if (comboNow > Pack3State.runStats.maxCombo) Pack3State.runStats.maxCombo = comboNow;

        // 1. Biome detection
        if (Pack3State.settings?.biomesEnabled) {
            const newBiome = detectBiome(data.distance);
            if (Pack3State.currentBiome.id !== newBiome.id && Pack3State.nextBiome?.id !== newBiome.id) {
                Pack3State.nextBiome = newBiome;
                safePlay(Pack3State.whooshAudio, 1.0, 1.0);
                vibrate(8);
            }
        }

        // 2. Music
        updateMusic(data.distance || 0);

        // 3. Daily goal: distance (cumulative)
        if (Pack3State.settings?.dailyGoalsEnabled && Pack3State.dailyGoal?.type === 'distance') {
            const d = data.distance || 0;
            if (d > Pack3State.lastTickDistance) {
                updateDailyProgress(d - Pack3State.lastTickDistance);
            }
            Pack3State.lastTickDistance = d;
        }

        // 3b. Cross-midnight daily goal refresh (once per ~10s)
        Pack3State.dailyCheckTimer++;
        if (Pack3State.dailyCheckTimer > 600) {
            Pack3State.dailyCheckTimer = 0;
            try {
                const saved = JSON.parse(localStorage.getItem('lacosteDailyGoal') || 'null');
                if (!saved || saved.date !== todayStr()) initDailyGoal();
            } catch (e) {}
        }

        // 4. Achievements (throttled)
        checkAchievements(data);
    });

    window.GameEvents.on('jump', () => {
        Pack3State.runStats.jumps++;
        if (Pack3State.dailyGoal?.type === 'jumps') updateDailyProgress(1);
    });

    window.GameEvents.on('eat', () => {
        Pack3State.runStats.foodEaten++;
        if (Pack3State.dailyGoal?.type === 'food') updateDailyProgress(1);
    });

    window.GameEvents.on('hit', (data) => {
        Pack3State.runStats.lastHitDistance = data?.distance || 0;
    });

    window.GameEvents.on('gameover', () => {
        Pack3State.musicAudios.forEach(a => { try { a.pause(); } catch (e) {} });
        checkAchievements({ distance: Pack3State.runStats.distance, combo: Pack3State.runStats.maxCombo }, true);
        Pack3State.lastTickDistance = 0;
    });

    // === UI: Daily goal panel (also exposed as a menu tab) ===
    function renderDailyGoals() {
        const [, force] = React.useReducer(x => x + 1, 0);
        React.useEffect(() => { Pack3State.uiListeners.push(force); return () => { Pack3State.uiListeners = Pack3State.uiListeners.filter(fn => fn !== force); }; }, []);
        const goal = Pack3State.dailyGoal;
        if (!Pack3State.settings?.dailyGoalsEnabled) return React.createElement('div', { className: 'ms-empty' }, 'Ежедневные задания отключены в настройках.');
        if (!goal) return React.createElement('div', { className: 'ms-empty' }, 'Ежедневное задание появится при следующем запуске.');
        const progress = Math.min(goal.target, Pack3State.dailyGoalProgress);
        return React.createElement('div', null,
            React.createElement('div', { className: 'ms-section-title' }, '🎯 DAILY GOAL'),
            React.createElement('div', { className: 'ms-card', style: { alignItems: 'stretch', maxWidth: '520px' } },
                React.createElement('div', { className: 'ms-card-name' }, goal.title),
                React.createElement('div', { className: 'ms-card-sub' }, `${progress} / ${goal.target}`),
                React.createElement('div', { className: 'ms-progress' }, React.createElement('div', { className: 'ms-progress-bar', style: { width: `${(progress / goal.target) * 100}%` } })),
                React.createElement('div', { className: 'ms-card-sub' }, `Награда: ${goal.reward}`),
                React.createElement('div', { className: 'ms-card-sub', style: { color: Pack3State.dailyGoalClaimed ? '#00ffb4' : '#ffd700' } }, Pack3State.dailyGoalClaimed ? '✓ Награда сохранена в постоянном инвентаре' : progress >= goal.target ? 'Цель выполнена — награда будет получена автоматически' : 'Продолжайте играть — прогресс сохраняется между забегами')
            )
        );
    }
    window.Pack3Render = window.Pack3Render || {};
    window.Pack3Render.daily = renderDailyGoals;

    // === UI: Toast ===
    function Pack3ToastSystem() {
        const [toasts, setToasts] = React.useState([]);
        React.useEffect(() => {
            const listener = (data) => {
                const id = Date.now() + Math.random();
                setToasts(prev => [...prev, { id, ...data }]);
                setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);
            };
            window.GameEvents.on('pack3_toast', listener);
            return () => {
                if (window.GameEvents.listeners['pack3_toast']) {
                    window.GameEvents.listeners['pack3_toast'] = window.GameEvents.listeners['pack3_toast'].filter(cb => cb !== listener);
                }
            };
        }, []);
        return React.createElement('div', { className: 'pack3-toast-container', style: { pointerEvents: 'none' } },
            toasts.map(t => React.createElement('div', { key: t.id, className: `pack3-toast ${t.type}` }, t.text))
        );
    }

    // === UI: Achievements menu ===
    function Pack3AchievementsMenu() {
        const [visible, setVisible] = React.useState(false);
        React.useEffect(() => {
            const show = () => setVisible(true);
            window.GameEvents.on('show_achievements', show);
            return () => {
                if (window.GameEvents.listeners['show_achievements']) {
                    window.GameEvents.listeners['show_achievements'] = window.GameEvents.listeners['show_achievements'].filter(cb => cb !== show);
                }
            };
        }, []);
        if (!visible) return null;
        return React.createElement('div', { className: 'pack3-overlay' },
            React.createElement('div', { className: 'pack3-panel' },
                React.createElement('div', { className: 'pack3-title' }, '🏆 ACHIEVEMENTS'),
                React.createElement('div', { className: 'pack3-ach-grid' },
                    P3_CONFIG.achievements.map(ach => {
                        const unlocked = !!Pack3State.unlockedAchievements[ach.id];
                        return React.createElement('div', { key: ach.id, className: `pack3-ach-card ${unlocked ? 'unlocked' : ''}` },
                            React.createElement('div', { className: 'pack3-ach-icon' }, unlocked ? (ach.icon || '✅') : '🔒'),
                            React.createElement('div', { className: 'pack3-ach-info' },
                                React.createElement('div', { className: 'pack3-ach-name' }, ach.title || ach.id),
                                React.createElement('div', { className: 'pack3-ach-desc' }, ach.desc || '')
                            )
                        );
                    })
                ),
                React.createElement('button', { className: 'pack3-close-btn', onClick: () => setVisible(false) }, 'CLOSE')
            )
        );
    }

    if (window.PackUIs) {
        window.PackUIs.push(Pack3ToastSystem);
        window.PackUIs.push(Pack3AchievementsMenu);
    } else {
        window.PackUIs = [Pack3ToastSystem, Pack3AchievementsMenu];
    }

    console.log('%c🌍 PACK 3 (Biomes, Achievements, Music v2) loaded', 'color:#FFD700;font-weight:bold;font-size:14px');
})();
