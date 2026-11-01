window.GameEvents = window.GameEvents || {
    listeners: {},
    on(event, cb) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(cb); },
    emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => { try { cb(data); } catch(e) { console.error(e); } }); }
};
window.PackUIs = window.PackUIs || [];

/* ==================================================================
   PACK 4 — Economy, Shop (per-char skins), Upgrades, Promo, Social
   v2.1 — UFO patrol + jump-apex altitude, food scan timing,
          UFO catch alignment, SFX/vibration, defensive defaults
   ================================================================== */
(function () {
    'use strict';

    const PREFERS_REDUCED_MOTION = (() => {
        try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false; }
        catch { return false; }
    })();

    const P4_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.pack4) || {
        economy: { coinsPerMeter: 1, bonusCombo: 5, bonusGoldenFood: 50 },
        shop: { buffs: [], consumables: [] },
        skinTiers: {},
        upgrades: { maxLevel: 10, priceBase: 500, priceStep: 250, statBonus: 0.05 },
        promo: { friendPrefix: 'FRIEND-', friendCodeLength: 4, friendRewardCoins: 500, adminCode: '', adminRewardCoins: 10000 },
        missions: [],
        secrets: { goldenCrocDistance: 5000, konami: { code: [], duration: 10000 }, ufoChance: 0.05, ufoCoins: 100 },
    };

    // Defensive defaults
    if (!P4_CONFIG.economy) P4_CONFIG.economy = { coinsPerMeter: 1, bonusCombo: 5, bonusGoldenFood: 50 };
    if (!P4_CONFIG.shop) P4_CONFIG.shop = { buffs: [], consumables: [] };
    if (!Array.isArray(P4_CONFIG.shop.buffs)) P4_CONFIG.shop.buffs = [];
    if (!Array.isArray(P4_CONFIG.shop.consumables)) P4_CONFIG.shop.consumables = [];
    if (!P4_CONFIG.upgrades) P4_CONFIG.upgrades = { maxLevel: 10, priceBase: 500, priceStep: 250, statBonus: 0.05 };
    if (!P4_CONFIG.promo) P4_CONFIG.promo = { friendPrefix: 'FRIEND-', friendCodeLength: 4, friendRewardCoins: 500, adminCode: '', adminRewardCoins: 10000 };
    if (!P4_CONFIG.secrets) P4_CONFIG.secrets = { ufoChance: 0.05, ufoCoins: 100 };
    if (!Array.isArray(P4_CONFIG.missions)) P4_CONFIG.missions = [];

    // Все пути к звукам задаются только в config.js -> GAME_CONFIG.audio.sfx.
    const SFX = (() => {
        const source = (window.GAME_CONFIG && window.GAME_CONFIG.audio && window.GAME_CONFIG.audio.sfx) || {};
        const files = { buy: source.purchase, unlock: source.unlock, equip: source.equip, promo: source.promo, ufo: source.ufoCatch, ufoArrival: source.ufoArrival, ufoBeam: source.ufoBeam, ufoSteal: source.ufoSteal, ufoCoinDrop: source.ufoCoinDrop, ufoCoinCollect: source.ufoCoinCollect, ufoSkinReward: source.ufoSkinReward, error: source.error };
        const audios = {};
        let settings = null;
        for (const [key, path] of Object.entries(files)) {
            if (typeof path !== 'string' || !path.trim()) continue;
            try { const audio = new Audio(path.trim()); audio.preload = 'auto'; audio.volume = 0.7; audios[key] = audio; } catch (e) {}
        }
        function play(key, rate = 1.0, volMult = 1.0) {
            const audio = audios[key];
            if (!audio || !settings || !settings.soundEnabled) return;
            try {
                if (audio.readyState >= 1) audio.currentTime = 0;
                audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
                audio.volume = Math.max(0, Math.min(1, (settings.sfxVolume ?? 0.7) * (settings.masterVolume ?? 1.0) * volMult));
                audio.play().catch(() => {});
            } catch (e) {}
        }
        return { play, setSettings: (value) => { settings = value; } };
    })();

    function vibrate(pattern) {
        if (Pack4State.settings && Pack4State.settings.vibrateEnabled === false) return;
        if (PREFERS_REDUCED_MOTION) {
            if (Array.isArray(pattern)) pattern = pattern.map(v => Math.min(20, v));
            else if (typeof pattern === 'number') pattern = Math.min(20, pattern);
        }
        if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
    }

    // ─── MIGRATION skins ───
    function migrateSkins() {
        const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
        const allSkinIds = new Set();
        const defaultSkinIds = new Set();
        Object.values(chars).forEach(char => {
            (char.skins || []).forEach(s => allSkinIds.add(s.id));
            if (char.skins?.[0]?.id) defaultSkinIds.add(char.skins[0].id);
        });

        const set = new Set(defaultSkinIds);

        let raw = null;
        try { raw = localStorage.getItem('lacosteSkins'); } catch (e) {}
        if (raw) {
            let old = [];
            try { old = JSON.parse(raw); } catch {}
            const legacyMap = { 'gold': 'croc_gold', 'red': 'panda_gold' };
            (Array.isArray(old) ? old : []).forEach(id => {
                if (id === 'default') return;
                const mapped = legacyMap[id];
                if (mapped) {
                    if (allSkinIds.has(mapped)) set.add(mapped);
                    return;
                }
                if (typeof id === 'string' && id.includes('_') && allSkinIds.has(id)) set.add(id);
            });
        }
        return Array.from(set);
    }

    function generateFriendCode() {
        const prefix = P4_CONFIG.promo.friendPrefix || 'FRIEND-';
        const len = P4_CONFIG.promo.friendCodeLength || 4;
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return prefix + code;
    }

    // ─── SAFE STORAGE ───
    function loadJSON(key, fallback, validator = null) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === '') return fallback;
            const value = JSON.parse(raw);
            return (!validator || validator(value)) ? value : fallback;
        } catch (error) {
            console.warn(`[pack4] Invalid saved value for ${key}; using defaults`, error);
            try { localStorage.removeItem(key); } catch (e) {}
            return fallback;
        }
    }
    function loadNumber(key, fallback = 0) {
        try { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) && value >= 0 ? value : fallback; }
        catch (e) { return fallback; }
    }
    function safeSet(key, value) {
        try { localStorage.setItem(key, String(value)); return true; }
        catch (error) { console.warn(`[pack4] Could not save ${key}`, error); return false; }
    }
    function normalizeInventory(value) {
        const result = { shield: 0, magnet: 0, sprint: 0, slowmo: 0 };
        if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
        for (const key of Object.keys(result)) result[key] = Math.max(0, Math.floor(Number(value[key]) || 0));
        return result;
    }

    // ─── STATE ───
    const Pack4State = {
        coins: loadNumber('lacosteCoins', 0),
        inventory: normalizeInventory(loadJSON('lacosteInventory', {}, v => !!v && typeof v === 'object' && !Array.isArray(v))),
        boughtBuffs: loadJSON('lacosteBuffs', [], Array.isArray).filter(v => typeof v === 'string'),
        unlockedSkins: migrateSkins(),
        upgrades: loadJSON('lacosteUpgrades', {}, v => !!v && typeof v === 'object' && !Array.isArray(v)),
        missions: loadJSON('lacosteMissions', [], Array.isArray),
        leaderboard: loadJSON('lacosteLeaderboard', [], Array.isArray).filter(v => v && Number.isFinite(Number(v.score)) && v.date),
        promoUsed: loadJSON('lacostePromoUsed', {}, v => !!v && typeof v === 'object' && !Array.isArray(v)),
        secrets: loadJSON('lacosteSecrets', {}, v => !!v && typeof v === 'object' && !Array.isArray(v)),
        myFriendCode: (() => { try { return localStorage.getItem('lacosteRefCode') || generateFriendCode(); } catch (e) { return generateFriendCode(); } })(),
        cheatInvincible: 0,
        activeUFO: null,
        ufoDrop: null,
        ufoCoins: [],
        runsPlayed: loadNumber('lacosteRunsPlayed', 0),
        settings: null,
        uiListeners: [],
        _missionLastDistance: 0,
        reviveUsed: false,
        _playerPos: null,
        _groundY: 530,
        _canvasWidth: 1200,
    };
    window.Pack4State = Pack4State;
    safeSet('lacosteRefCode', Pack4State.myFriendCode);

    function saveState() {
        safeSet('lacosteCoins', Pack4State.coins);
        safeSet('lacosteInventory', JSON.stringify(Pack4State.inventory));
        safeSet('lacosteBuffs', JSON.stringify(Pack4State.boughtBuffs));
        safeSet('lacosteSkins', JSON.stringify(Pack4State.unlockedSkins));
        safeSet('lacosteUpgrades', JSON.stringify(Pack4State.upgrades));
        safeSet('lacosteMissions', JSON.stringify(Pack4State.missions));
        safeSet('lacosteLeaderboard', JSON.stringify(Pack4State.leaderboard));
        safeSet('lacostePromoUsed', JSON.stringify(Pack4State.promoUsed));
        safeSet('lacosteSecrets', JSON.stringify(Pack4State.secrets));
        safeSet('lacosteRunsPlayed', Pack4State.runsPlayed);
    }

    function updateUI() {
        Pack4State.uiListeners.forEach(fn => { try { fn(); } catch (e) {} });
    }

    function addInventory(kind, count = 1) {
        if (!Object.prototype.hasOwnProperty.call(Pack4State.inventory, kind)) return false;
        const amount = Math.max(1, Math.floor(Number(count) || 1));
        Pack4State.inventory[kind] = Math.max(0, Pack4State.inventory[kind] || 0) + amount;
        saveState(); updateUI();
        window.GameEvents.emit('pack4_inventory_updated', { kind, count: amount });
        return true;
    }

    Pack4State.saveState = saveState;
    Pack4State.notifyUI = updateUI;
    Pack4State.addInventory = addInventory;

    function ensureAllDefaultsUnlocked() {
        const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
        let changed = false;
        Object.values(chars).forEach(char => {
            const defaultSkin = char.skins?.[0]?.id;
            if (defaultSkin && !Pack4State.unlockedSkins.includes(defaultSkin)) {
                Pack4State.unlockedSkins.push(defaultSkin);
                changed = true;
            }
        });
        if (changed) saveState();
    }

    function initMissions() {
        const configured = P4_CONFIG.missions || [];
        if (!Array.isArray(Pack4State.missions) || !Pack4State.missions.length) {
            Pack4State.missions = configured.map(m => ({ ...m, progress: 0, completed: false }));
            saveState();
            return;
        }
        Pack4State.missions = configured.map(def => {
            const saved = Pack4State.missions.find(m => m && m.id === def.id);
            const progress = Math.max(0, Math.min(def.target, Math.floor(Number(saved?.progress) || 0)));
            return { ...def, progress, completed: !!saved?.completed || progress >= def.target };
        });
    }

    // Инициализация при загрузке модуля (не только на start)
    ensureAllDefaultsUnlocked();
    initMissions();

    // ─── HELPERS ───
    function getCurrentSkinFor(charId) {
        try {
            const cur = JSON.parse(localStorage.getItem('lacosteCurrentSkins') || '{}');
            if (cur[charId]) return cur[charId];
        } catch {}
        const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
        return chars[charId]?.skins?.[0]?.id || 'default';
    }

    function upgradePrice(currentLevel) {
        return (P4_CONFIG.upgrades.priceBase || 500) + currentLevel * (P4_CONFIG.upgrades.priceStep || 250);
    }

    function confirmPurchase(name, price) {
        if (price < 600) return true;
        return window.confirm(`Купить "${name}" за ${price}💰?`);
    }

    // ─── PURCHASES ───
    function buySkin(skinId, price) {
        if (Pack4State.unlockedSkins.includes(skinId)) return false;
        if (Pack4State.coins < price) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' });
            SFX.play('error', 0.8);
            vibrate([20, 40, 20]);
            return false;
        }
        if (!confirmPurchase(skinId, price)) return false;
        Pack4State.coins -= price;
        Pack4State.unlockedSkins.push(skinId);
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: '✅ Skin unlocked!', type: 'success' });
        SFX.play('unlock', 1.3);
        vibrate([15, 30, 15]);
        saveState(); updateUI(); return true;
    }

    function buyBuff(buffId, price) {
        if (Pack4State.boughtBuffs.includes(buffId)) return false;
        if (Pack4State.coins < price) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        if (!confirmPurchase(buffId, price)) return false;
        Pack4State.coins -= price;
        Pack4State.boughtBuffs.push(buffId);
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: '✅ Buff active!', type: 'success' });
        SFX.play('buy', 1.2);
        vibrate([20, 30, 20]);
        saveState(); updateUI(); return true;
    }

    function buyConsumable(id, price) {
        if (Pack4State.coins < price) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        if (!confirmPurchase(id, price)) return false;
        Pack4State.coins -= price;
        Pack4State.inventory[id] = (Pack4State.inventory[id] || 0) + 1;
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: `✅ ${id.toUpperCase()} +1`, type: 'success' });
        SFX.play('buy', 1.0);
        vibrate(15);
        saveState(); updateUI(); return true;
    }

    function buyUpgrade(charId, stat) {
        const maxLvl = P4_CONFIG.upgrades.maxLevel || 10;
        if (!Pack4State.upgrades[charId]) Pack4State.upgrades[charId] = { speed: 0, jump: 0, luck: 0 };
        const currentLvl = Pack4State.upgrades[charId][stat] || 0;
        if (currentLvl >= maxLvl) {
            window.GameEvents.emit('pack4_toast', { text: '⭐ MAX LEVEL', type: 'info' });
            return false;
        }
        const price = upgradePrice(currentLvl);
        if (Pack4State.coins < price) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        if (!confirmPurchase(`${stat} Lv.${currentLvl + 1}`, price)) return false;
        Pack4State.coins -= price;
        Pack4State.upgrades[charId][stat] = currentLvl + 1;
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: `✅ ${stat.toUpperCase()} Lv.${currentLvl + 1}`, type: 'success' });
        SFX.play('buy', 1.1 + currentLvl * 0.05);
        vibrate(15);
        saveState(); updateUI(); return true;
    }

    function equipSkin(charId, skinId) {
        // SECURITY: проверка ownership
        if (!Pack4State.unlockedSkins.includes(skinId)) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Skin not owned', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        try {
            const cur = JSON.parse(localStorage.getItem('lacosteCurrentSkins') || '{}');
            cur[charId] = skinId;
            localStorage.setItem('lacosteCurrentSkins', JSON.stringify(cur));
            window.GameEvents.emit('pack4_skins_updated', { charId, skinId });
            window.GameEvents.emit('pack4_toast', { text: '🎨 Skin equipped', type: 'info' });
            SFX.play('equip', 1.0);
            vibrate(10);
            updateUI();
            return true;
        } catch (e) { console.error(e); return false; }
    }

    // ─── PROMO ───
    function applyFriendCode(input) {
        const code = (input || '').trim().toUpperCase();
        if (code && code === Pack4State.myFriendCode) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Нельзя активировать собственный код', type: 'danger' });
        } else {
            window.GameEvents.emit('pack4_toast', { text: 'ℹ️ Активация реферальных кодов требует серверной проверки. В офлайн-версии отключена.', type: 'info' });
        }
        return false;
    }

    function applyAdminCode() {
        window.GameEvents.emit('pack4_toast', { text: 'ℹ️ Административные награды выдаются только сервером. Клиентский код отключён.', type: 'info' });
        return false;
    }

    // ─── UFO ENCOUNTER: arrival, food abduction, coins, catch reward ───
    function getUfoConfig() {
        return P4_CONFIG.secrets.ufoEncounter || {};
    }

    function getUfoTarget() {
        const player = Pack4State._playerPos;
        const cfg = getUfoConfig();
        const physics = (window.GAME_CONFIG && window.GAME_CONFIG.physics) || {};
        const groundY = Math.max(100, Number(player?.groundY || Pack4State._groundY || 530));
        const playerHeight = Math.max(30, Number(player?.h || 110));
        const playerCenterX = player ? player.x + player.w / 2 : 182;
        const horizontalOffset = Math.max(0, Number(cfg.horizontalOffset) || 110);

        // Повторяем реальную физику обычного прыжка с удержанием кнопки:
        // velocityY += gravity; velocityY -= holdThrust * jumpMult; y += velocityY.
        // Так корабль располагается у верхней точки достижимого прыжка, а не над головой стоящего игрока.
        const gravity = Math.max(0.05, Number(physics.gravity) || 0.75);
        const jumpForce = Math.max(0.1, Math.abs(Number(physics.jumpForce) || 10.5));
        const holdThrust = Math.max(0, Number(physics.holdThrust) || 0.45);
        const jumpMult = Math.max(1, Number(player?.jumpMult) || 1);
        let velocityY = -jumpForce * jumpMult;
        let displacement = 0;
        let maxRise = 0;
        for (let frame = 0; frame < 600; frame++) {
            velocityY += gravity;
            velocityY -= holdThrust * jumpMult;
            displacement += velocityY;
            maxRise = Math.max(maxRise, -displacement);
            if (velocityY >= 0) break;
        }
        // Оставляем запас сверху, чтобы корабль и луч не обрезались верхней границей Canvas.
        const maxCanvasRise = Math.max(60, groundY - playerHeight - 70);
        const maxJumpHeight = Math.max(40, Math.min(maxRise, maxCanvasRise));
        const jumpApexHeadY = groundY - playerHeight - maxJumpHeight;
        // Нижний край корпуса находится примерно на 23 px ниже центра.
        // Смещение на 18 px даёт небольшой запас пересечения хитбоксов в верхней точке прыжка.
        const y = Math.max(52, jumpApexHeadY - 18);

        const canvasWidth = Math.max(480, Number(Pack4State._canvasWidth) || 1200);
        const minX = Math.max(120, Math.min(canvasWidth - 220, playerCenterX + Math.max(20, Number(cfg.patrolMinPlayerOffset) || 35)));
        const maxX = Math.max(minX + 180, canvasWidth - Math.max(60, Number(cfg.patrolMaxMargin) || 80));
        return {
            x: Math.max(minX, Math.min(maxX, playerCenterX + horizontalOffset)),
            minX,
            maxX,
            playerCenterX,
            groundY,
            playerHeight,
            jumpMultiplier: jumpMult,
            maxJumpHeight,
            jumpApexHeadY,
            y,
        };
    }

    function beginUfoEncounter(options = {}) {
        const now = Date.now();
        const target = getUfoTarget();
        const cfg = getUfoConfig();
        Pack4State.ufoDrop = null; // legacy field; the old falling-drop mode is retired.
        Pack4State.ufoCoins = [];
        Pack4State.activeUFO = {
            x: target.x,
            y: 18,
            patrolMinX: target.minX,
            patrolMaxX: target.maxX,
            patrolDirection: 1,
            w: 96,
            h: 46,
            scale: 0.045,
            phase: 'arrival',
            phaseStartedAt: now,
            arrivalDurationMs: Math.max(500, Number(cfg.approachDurationMs) || 2800),
            scanDurationMs: Math.max(1000, Number(cfg.scanDurationMs) || 12000),
            departureDurationMs: Math.max(400, Number(cfg.departureDurationMs) || 1300),
            scanEndsAt: 0,
            nextStealAt: 0,
            beamActive: false,
            abducting: [],
            source: options.source || 'random',
            collected: false,
        };
        SFX.play('ufoArrival', 1.0);
        updateUI();
        return Pack4State.activeUFO;
    }

    Pack4State.startUfoEncounter = beginUfoEncounter;

    function unlockRandomUnownedSkin() {
        const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
        const owned = new Set(Pack4State.unlockedSkins);
        // Equipped skins count as owned even if an older save missed their unlock-list entry.
        try {
            const equipped = JSON.parse(localStorage.getItem('lacosteCurrentSkins') || '{}');
            Object.values(equipped || {}).forEach(id => { if (typeof id === 'string' && id) owned.add(id); });
        } catch (e) {}
        const candidates = [];
        const candidateIds = new Set();
        Object.values(chars).forEach(char => {
            (char.skins || []).forEach(skin => {
                if (skin && skin.id && !owned.has(skin.id) && !candidateIds.has(skin.id)) {
                    candidateIds.add(skin.id);
                    candidates.push({ id: skin.id, name: skin.name || skin.id, characterId: char.id, characterName: char.name || char.id });
                }
            });
        });
        if (!candidates.length) return null;
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        Pack4State.unlockedSkins.push(chosen.id);
        window.GameEvents.emit('pack4_skin_unlocked', chosen);
        return chosen;
    }

    function awardUfoCatch(ufo) {
        if (!ufo || ufo.collected) return false;
        ufo.collected = true;
        const cfg = getUfoConfig();
        const coinReward = Math.max(0, Math.floor(Number(cfg.catchRewardCoins) || 1000));
        Pack4State.coins += coinReward;
        // Complete any food already being lifted by the beam so the exchange is not lost
        // if the player catches the ship during the abduction animation.
        const radius = Math.max(8, (Number(cfg.coinSize) || 28) / 2);
        (ufo.abducting || []).forEach(item => {
            Pack4State.ufoCoins.push({
                x: Number(item.currentX ?? item.x) || ufo.x,
                y: Number(item.currentY ?? item.y) || ufo.y + 24,
                vy: 0,
                radius,
                landY: Math.max(radius, Pack4State._groundY - radius),
                value: Math.max(1, Math.floor(Number(item.value) || Number(cfg.coinRewardPerFood) || 50)),
                bornAt: Date.now(),
                landed: false,
            });
        });
        ufo.abducting = [];
        const skin = unlockRandomUnownedSkin();
        window.GameEvents.emit('pack4_coins_updated');
        if (skin) {
            window.GameEvents.emit('pack4_toast', {
                text: `🛸 НЛО поймано! +${coinReward} монет · новый скин: ${skin.name} (${skin.characterName})`,
                type: 'success'
            });
            SFX.play('ufoSkinReward', 1.0);
        } else {
            window.GameEvents.emit('pack4_toast', {
                text: `🛸 НЛО поймано! +${coinReward} монет · все скины уже открыты`,
                type: 'success'
            });
        }
        SFX.play('ufo', 1.0);
        vibrate([30, 40, 30, 40, 80]);
        if (window.RenderEngine && !PREFERS_REDUCED_MOTION) {
            window.RenderEngine.flash('0,255,255', 0.5);
            window.RenderEngine.spawnParticles(ufo.x, ufo.y, 30, {
                colors: ['#00FFFF', '#FFD700', '#FFFFFF'], speed: 6, life: 40, size: 6, gravity: 0.1,
            });
        }
        Pack4State.activeUFO = null;
        saveState();
        updateUI();
        return true;
    }

    // Начало игры: случайная встреча с НЛО. Комбинация Konami запускает её гарантированно.
    window.GameEvents.on('start', (data) => {
        Pack4State.settings = data?.settings || Pack4State.settings;
        SFX.setSettings(Pack4State.settings);
        initMissions();
        Pack4State.activeUFO = null;
        Pack4State.ufoDrop = null;
        Pack4State.ufoCoins = [];
        Pack4State.reviveUsed = false;
        Pack4State._missionLastDistance = 0;
        Pack4State._playerPos = null;
        Pack4State._groundY = Number(window.GAME_CONFIG?.physics?.groundY) || 530;

        if (Math.random() < (P4_CONFIG.secrets.ufoChance ?? 0.05)) {
            beginUfoEncounter({ source: 'random' });
        }
    });

    window.GameEvents.on('konami_activated', () => {
        beginUfoEncounter({ source: 'konami' });
        window.GameEvents.emit('pack4_toast', { text: '🛸 НЛО приближается из космоса!', type: 'info' });
    });

    // Луч забирает только обычную еду. Power-up предметы не трогаются.
    window.GameEvents.on('ufo_scan_food', (data = {}) => {
        const ufo = Pack4State.activeUFO;
        const foods = data.foods;
        if (!ufo || ufo.phase !== 'scan' || !ufo.beamActive || !Array.isArray(foods)) return;
        const now = Date.now();
        if (now < ufo.nextStealAt) return;
        const cfg = getUfoConfig();
        const beamHalfWidth = Math.max(24, (Number(cfg.beamWidth) || 118) / 2);
        const groundY = Number(data.groundY) || Pack4State._groundY;
        let candidateIndex = -1;
        let bestDistance = Infinity;
        for (let i = 0; i < foods.length; i++) {
            const food = foods[i];
            if (!food || food.isPowerup) continue;
            const centerX = Number(food.x) + Number(food.width || food.w || 40) / 2;
            const centerY = Number(food.y) + Number(food.height || food.h || 40) / 2;
            const dx = Math.abs(centerX - ufo.x);
            if (dx > beamHalfWidth || centerY < ufo.y + 18 || centerY > groundY + 12) continue;
            if (dx < bestDistance) { bestDistance = dx; candidateIndex = i; }
        }
        if (candidateIndex < 0) return;

        const [food] = foods.splice(candidateIndex, 1);
        const fw = Number(food.width || food.w || 40);
        const fh = Number(food.height || food.h || 40);
        ufo.abducting.push({
            emoji: food.emoji || '🍗',
            x: Number(food.x) + fw / 2,
            y: Number(food.y) + fh / 2,
            startedAt: now,
            durationMs: Math.max(160, Number(cfg.abductDurationMs) || 360),
            value: Math.max(1, Math.floor(Number(cfg.coinRewardPerFood) || 50)),
        });
        ufo.nextStealAt = now + Math.max(250, Number(cfg.scanIntervalMs) || 850);
        SFX.play('ufoSteal', 1.0);
    });

    // ─── EVENT: TICK ───
    window.GameEvents.on('tick', (data) => {
        if (data.settings) {
            Pack4State.settings = data.settings;
            SFX.setSettings(data.settings);
        }

        // ─── UFO encounter simulation ───
        const cfg = getUfoConfig();
        const deltaScale = Math.max(0.25, Math.min(3, (Number(data.delta) || 16.6) / 16.6));
        const now = Date.now();
        const tickPlayer = data.player || Pack4State._playerPos;
        if (tickPlayer) {
            Pack4State._playerPos = {
                x: Number(tickPlayer.x) || 0,
                y: Number(tickPlayer.y) || 0,
                w: Number(tickPlayer.w) || 0,
                h: Number(tickPlayer.h) || 0,
                isJumping: !!tickPlayer.isJumping,
                jumpMult: Number(tickPlayer.jumpMult) || Number(Pack4State._playerPos?.jumpMult) || 1,
                groundY: Number(data.groundY) || Pack4State._groundY,
            };
        }
        if (Number.isFinite(Number(data.groundY))) Pack4State._groundY = Number(data.groundY);
        const target = getUfoTarget();
        const player = Pack4State._playerPos;
        const worldSpeed = Number(data.speed) || 0;

        const ufo = Pack4State.activeUFO;
        if (ufo && !ufo.collected) {
            if (ufo.phase === 'arrival') {
                // Прибытие заканчивается в стартовой точке патруля.
                ufo.x = Math.max(ufo.patrolMinX || target.minX, Math.min(ufo.patrolMaxX || target.maxX, ufo.x));
                const t = Math.min(1, (now - ufo.phaseStartedAt) / ufo.arrivalDurationMs);
                const eased = 1 - Math.pow(1 - t, 3);
                ufo.y = 18 + (target.y - 18) * eased;
                ufo.scale = 0.045 + 0.955 * eased;
                if (t >= 1) {
                    ufo.phase = 'scan';
                    ufo.phaseStartedAt = now;
                    ufo.scanEndsAt = now + ufo.scanDurationMs;
                    ufo.nextStealAt = now + 350;
                    ufo.beamActive = true;
                    ufo.y = target.y;
                    ufo.scale = 1;
                    SFX.play('ufoBeam', 1.0);
                    window.GameEvents.emit('pack4_toast', { text: '🛸 НЛО сканирует местность и ищет еду!', type: 'info' });
                }
            } else if (ufo.phase === 'scan') {
                // После прилёта корабль патрулирует всю доступную ширину Canvas и разворачивается у краёв.
                const patrolSpeed = Math.max(0.5, Number(cfg.patrolSpeed) || 3.2) * deltaScale;
                ufo.patrolMinX = Number.isFinite(ufo.patrolMinX) ? ufo.patrolMinX : target.minX;
                ufo.patrolMaxX = Number.isFinite(ufo.patrolMaxX) ? ufo.patrolMaxX : target.maxX;
                ufo.patrolDirection = ufo.patrolDirection === -1 ? -1 : 1;
                ufo.x += patrolSpeed * ufo.patrolDirection;
                if (ufo.x >= ufo.patrolMaxX) {
                    ufo.x = ufo.patrolMaxX;
                    ufo.patrolDirection = -1;
                } else if (ufo.x <= ufo.patrolMinX) {
                    ufo.x = ufo.patrolMinX;
                    ufo.patrolDirection = 1;
                }
                const bobAmplitude = Math.max(0, Number(cfg.verticalBobAmplitude) || 4);
                const bobPeriod = Math.max(300, Number(cfg.verticalBobPeriodMs) || 1500);
                ufo.y = target.y + Math.sin(now * Math.PI * 2 / bobPeriod) * bobAmplitude;
                ufo.scale = 1 + Math.sin(now / 260) * 0.012;
                if (now >= ufo.scanEndsAt) {
                    ufo.phase = 'departure';
                    ufo.phaseStartedAt = now;
                    ufo.beamActive = false;
                }
            } else if (ufo.phase === 'departure') {
                const t = Math.min(1, (now - ufo.phaseStartedAt) / ufo.departureDurationMs);
                ufo.y = target.y - 260 * t;
                ufo.scale = Math.max(0.035, 1 - 0.965 * t);
                if (t >= 1) Pack4State.activeUFO = null;
            }

            // Корабль можно получить только прыжком: простое стояние под НЛО не засчитывается.
            if (ufo.phase === 'scan' && player?.isJumping) {
                const px = player.x, py = player.y, pw = player.w, ph = player.h;
                const horizontalRange = Math.max(60, Number(cfg.catchHorizontalRange) || 145);
                const horizontalOverlap = Math.abs((px + pw / 2) - ufo.x) <= horizontalRange;
                const playerTop = py;
                const playerBottom = py + ph;
                const shipTop = ufo.y - 24;
                const shipBottom = ufo.y + 23;
                const verticalOverlap = playerTop <= shipBottom && playerBottom >= shipTop;
                if (horizontalOverlap && verticalOverlap) awardUfoCatch(ufo);
            }

            // Еда, поднятая лучом, летит в корпус. После поглощения из корабля падает монета.
            if (Pack4State.activeUFO?.abducting?.length) {
                const durationFallback = Math.max(160, Number(cfg.abductDurationMs) || 360);
                Pack4State.activeUFO.abducting = Pack4State.activeUFO.abducting.filter(item => {
                    const t = Math.min(1, (now - item.startedAt) / (item.durationMs || durationFallback));
                    item.progress = t;
                    item.currentX = item.x + (ufo.x - item.x) * t;
                    item.currentY = item.y + (ufo.y + 24 - item.y) * t;
                    if (t >= 1) {
                        const radius = Math.max(8, (Number(cfg.coinSize) || 28) / 2);
                        Pack4State.ufoCoins.push({
                            x: ufo.x + (Math.random() - 0.5) * 18,
                            y: ufo.y + 27,
                            vy: 0,
                            radius,
                            landY: Math.max(radius, target.groundY - radius),
                            value: Math.max(1, Math.floor(Number(item.value) || 50)),
                            bornAt: now,
                            landed: false,
                        });
                        SFX.play('ufoCoinDrop', 1.0);
                        return false;
                    }
                    return true;
                });
            }
        }

        // Монеты имеют физику падения до уровня земли и затем движутся вместе с локацией.
        if (Pack4State.ufoCoins.length) {
            const lifetime = Math.max(1000, Number(cfg.coinLifetimeMs) || 18000);
            const gravity = Math.max(0.1, Number(cfg.coinGravity) || 0.62);
            const playerRect = player;
            Pack4State.ufoCoins = Pack4State.ufoCoins.filter(coin => {
                if (now - coin.bornAt > lifetime) return false;
                coin.x -= worldSpeed * deltaScale;
                // Ground height can change during a biome transition; keep the coin seated on it.
                coin.landY = Math.max(coin.radius || 14, target.groundY - (coin.radius || 14));
                if (coin.landed) coin.y = coin.landY;
                if (!coin.landed) {
                    coin.vy = Math.min(13, coin.vy + gravity * deltaScale);
                    coin.y += coin.vy * deltaScale;
                    if (coin.y >= coin.landY) {
                        coin.y = coin.landY;
                        coin.vy = 0;
                        coin.landed = true;
                    }
                }
                if (playerRect && coin.landed) {
                    const radius = coin.radius || 14;
                    const px1 = playerRect.x + playerRect.w * 0.12;
                    const px2 = playerRect.x + playerRect.w * 0.88;
                    const py1 = playerRect.y;
                    const py2 = playerRect.y + playerRect.h;
                    const overlaps = coin.x + radius >= px1 && coin.x - radius <= px2 &&
                        coin.y + radius >= py1 && coin.y - radius <= py2;
                    if (overlaps) {
                        const value = Math.max(1, Math.floor(Number(coin.value) || 50));
                        Pack4State.coins += value;
                        window.GameEvents.emit('pack4_coins_updated');
                        window.GameEvents.emit('pack4_toast', { text: `💰 +${value} монет`, type: 'success' });
                        SFX.play('ufoCoinCollect', 1.0);
                        saveState(); updateUI();
                        return false;
                    }
                }
                return coin.x + (coin.radius || 14) >= -8;
            });
        }

        // Missions — distance
        let missionProgressChanged = false;
        if (data.distance !== undefined) {
            const currentDistance = Math.max(0, Math.floor(Number(data.distance) || 0));
            const distanceDelta = Math.max(0, currentDistance - Pack4State._missionLastDistance);
            Pack4State._missionLastDistance = currentDistance;
            if (distanceDelta > 0) {
                Pack4State.missions.forEach(m => {
                    if (m.type === 'distance' && m.progress < m.target && !m.completed) {
                        m.progress = Math.min(m.target, m.progress + distanceDelta);
                        missionProgressChanged = true;
                        if (m.progress >= m.target) completeMission(m);
                    }
                });
            }
        }

        // Missions — combo
        if (data.combo !== undefined) {
            Pack4State.missions.forEach(m => {
                if (m.type === 'combo' && m.progress < m.target && !m.completed) {
                    const next = Math.max(m.progress, data.combo || 0);
                    if (next !== m.progress) { m.progress = next; missionProgressChanged = true; }
                    if (m.progress >= m.target) completeMission(m);
                }
            });
        }
        if (missionProgressChanged) { saveState(); updateUI(); }

        // Golden Croc is a hidden unlock at the configured distance.
        const secretDistance = P4_CONFIG.secrets.goldenCrocDistance || 5000;
        if ((data.distance || 0) >= secretDistance && !Pack4State.secrets.goldenCrocUnlocked) {
            const goldenSkin = 'croc_gold';
            if (!Pack4State.unlockedSkins.includes(goldenSkin)) Pack4State.unlockedSkins.push(goldenSkin);
            Pack4State.secrets.goldenCrocUnlocked = true;
            saveState(); updateUI();
            window.GameEvents.emit('pack4_toast', { text: '🐊 GOLDEN CROC UNLOCKED!', type: 'success' });
        }
    });

    function completeMission(m) {
        m.completed = true;
        Pack4State.coins += m.reward;
        window.GameEvents.emit('pack4_toast', { text: `🎯 MISSION COMPLETE: +${m.reward} COINS`, type: 'success' });
        window.GameEvents.emit('pack4_coins_updated');
        SFX.play('promo', 1.2);
        vibrate([20, 30, 20]);
        saveState(); updateUI();
    }

    // ─── EVENT: EAT / JUMP ───
    window.GameEvents.on('eat', () => {
        Pack4State.missions.forEach(m => {
            if (m.type === 'food' && m.progress < m.target && !m.completed) {
                m.progress++;
                if (m.progress >= m.target) completeMission(m);
                else { saveState(); updateUI(); }
            }
        });
    });

    window.GameEvents.on('eat', (data = {}) => {
        const foodType = data.foodType || data.pack1Type || 'regular';
        const comboMultiplier = Math.max(1, Number(data.comboMult) || Number(window.Pack1State?.comboMult) || 1);
        const comboBonus = Math.max(0, Math.floor((comboMultiplier - 1) * (P4_CONFIG.economy.bonusCombo || 0)));
        const goldenBonus = foodType === 'golden' ? (P4_CONFIG.economy.bonusGoldenFood || 0) : 0;
        const totalBonus = comboBonus + goldenBonus;
        if (totalBonus > 0) {
            Pack4State.coins += totalBonus;
            window.GameEvents.emit('pack4_coins_updated');
            window.GameEvents.emit('pack4_toast', { text: `💰 +${totalBonus} food bonus${comboBonus ? ` (combo x${comboMultiplier})` : ''}`, type: 'success' });
            saveState(); updateUI();
        }
    });

    window.GameEvents.on('jump', () => {
        let changed = false;
        Pack4State.missions.forEach(m => {
            if (m.type === 'jumps' && m.progress < m.target && !m.completed) {
                m.progress++;
                changed = true;
                if (m.progress >= m.target) completeMission(m);
            }
        });
        if (changed) { saveState(); updateUI(); }
    });

    // ─── EVENT: GAMEOVER ───
    window.GameEvents.on('gameover', (data) => {
        const rate = (P4_CONFIG.economy.coinsPerMeter || 1) * (Pack4State.boughtBuffs.includes('start_speed') ? 1.05 : 1);
        const earned = Math.floor((data.distance || 0) * rate);
        Pack4State.coins += earned;
        Pack4State.runsPlayed++;

        // Filter tiny runs from leaderboard
        if ((data.distance || 0) >= 10) {
            Pack4State.leaderboard.push({ score: Math.floor(data.distance), date: new Date().toISOString() });
            Pack4State.leaderboard.sort((a, b) => b.score - a.score);
            Pack4State.leaderboard = Pack4State.leaderboard.slice(0, 10);
        }

        Pack4State.activeUFO = null;
        Pack4State.ufoCoins = [];
        Pack4State._playerPos = null;
        window.GameEvents.emit('pack4_coins_updated');
        saveState(); updateUI();
    });

    // ─── UFO / COIN DRAWING (Canvas only; no external sprites required) ───
    function drawUfo(ctx, x, y, scale = 1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        const glow = ctx.createRadialGradient(0, 5, 4, 0, 5, 62);
        glow.addColorStop(0, 'rgba(0,255,255,0.34)');
        glow.addColorStop(1, 'rgba(0,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.ellipse(0, 5, 62, 36, 0, 0, Math.PI * 2); ctx.fill();
        const dome = ctx.createLinearGradient(0, -30, 0, 4);
        dome.addColorStop(0, '#E8FFFF'); dome.addColorStop(0.55, '#63DDEB'); dome.addColorStop(1, '#267C9A');
        ctx.beginPath(); ctx.ellipse(0, -10, 22, 23, 0, Math.PI, Math.PI * 2);
        ctx.fillStyle = dome; ctx.fill();
        const hull = ctx.createLinearGradient(0, -4, 0, 22);
        hull.addColorStop(0, '#F8FFFF'); hull.addColorStop(0.35, '#8BDCE7'); hull.addColorStop(1, '#28768B');
        ctx.beginPath(); ctx.ellipse(0, 7, 48, 15, 0, 0, Math.PI * 2);
        ctx.fillStyle = hull; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#D8FFFF'; ctx.stroke();
        [-27, -9, 9, 27].forEach((lx, index) => {
            ctx.beginPath(); ctx.arc(lx, 8, 3.2, 0, Math.PI * 2);
            ctx.fillStyle = index % 2 ? '#FFD84A' : '#36FFF2'; ctx.fill();
        });
        ctx.restore();
    }

    function drawUfoCoin(ctx, coin) {
        const r = Math.max(8, Number(coin.radius) || (Number(getUfoConfig().coinSize) || 28) / 2);
        ctx.save();
        ctx.translate(coin.x, coin.y);
        ctx.shadowColor = 'rgba(255,190,0,0.72)'; ctx.shadowBlur = coin.landed ? 7 : 12;
        const gold = ctx.createLinearGradient(-r, -r, r, r);
        gold.addColorStop(0, '#FFF6A5'); gold.addColorStop(0.45, '#FFC928'); gold.addColorStop(1, '#B96A00');
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = gold; ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2; ctx.strokeStyle = '#FFF2A1'; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(140,75,0,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#6D3C00'; ctx.font = `bold ${Math.max(10, r * 0.9)}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 1);
        ctx.restore();
    }

    function drawUfoBeam(ctx, ufo, groundY) {
        const cfg = getUfoConfig();
        const topY = ufo.y + 20;
        const bottomY = Math.max(topY + 8, groundY - 2);
        const topHalf = 7;
        const bottomHalf = Math.max(26, (Number(cfg.beamWidth) || 118) / 2);
        const alpha = Math.max(0.08, Math.min(0.45, Number(cfg.beamOpacity) || 0.24));
        ctx.save();
        const beam = ctx.createLinearGradient(ufo.x, topY, ufo.x, bottomY);
        beam.addColorStop(0, `rgba(100,255,255,${alpha * 0.9})`);
        beam.addColorStop(0.65, `rgba(90,245,255,${alpha * 0.42})`);
        beam.addColorStop(1, 'rgba(120,255,255,0.015)');
        ctx.beginPath();
        ctx.moveTo(ufo.x - topHalf, topY);
        ctx.lineTo(ufo.x + topHalf, topY);
        ctx.lineTo(ufo.x + bottomHalf, bottomY);
        ctx.lineTo(ufo.x - bottomHalf, bottomY);
        ctx.closePath();
        ctx.fillStyle = beam; ctx.fill();
        ctx.strokeStyle = `rgba(120,255,255,${alpha * 0.75})`;
        ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ufo.x, groundY - 2, bottomHalf * 0.72, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(90,255,255,${alpha * 0.9})`; ctx.fill();
        ctx.restore();
    }

    // ─── EVENT: RENDER_FRAME ───
    window.GameEvents.on('render_frame', ({ ctx, player, groundY }) => {
        if (player) {
            Pack4State._playerPos = {
                x: player.x, y: player.y, w: player.w, h: player.h,
                isJumping: !!player.isJumping,
                jumpMult: Number(player.jumpMult) || Number(Pack4State._playerPos?.jumpMult) || 1,
                groundY: Number(groundY) || Pack4State._groundY
            };
        }
        if (Number.isFinite(Number(groundY))) Pack4State._groundY = Number(groundY);
        if (ctx && ctx.canvas && Number.isFinite(Number(ctx.canvas.width))) Pack4State._canvasWidth = Number(ctx.canvas.width);
        if (!ctx) return;

        const ufo = Pack4State.activeUFO;
        if (ufo && !ufo.collected) {
            // Во время прилёта корабль виден как далёкая световая точка, которая растёт.
            if (ufo.phase === 'scan' && ufo.beamActive) drawUfoBeam(ctx, ufo, Number(groundY) || Pack4State._groundY);
            (ufo.abducting || []).forEach(item => {
                const progress = item.progress || 0;
                ctx.save();
                ctx.globalAlpha = Math.max(0.2, 1 - progress * 0.25);
                ctx.font = `${Math.max(12, 27 * (1 - progress * 0.25))}px Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.shadowColor = '#8CFFFF'; ctx.shadowBlur = 12;
                ctx.fillText(item.emoji, item.currentX ?? item.x, item.currentY ?? item.y);
                ctx.restore();
            });
            drawUfo(ctx, ufo.x, ufo.y, Math.max(0.035, ufo.scale || 1));
            if (ufo.phase === 'scan') {
                ctx.save();
                ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#E7FFFF'; ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 8;
                ctx.fillText('SCANNING FOOD · JUMP TO CATCH +1000 + SKIN', ufo.x, ufo.y - 48);
                ctx.restore();
            }
        }
        if (Pack4State.ufoCoins.length) Pack4State.ufoCoins.forEach(coin => drawUfoCoin(ctx, coin));
    });

    // ─── RENDER: SHOP ───
    function renderShopTab() {
        const [activeSub, setActiveSub] = React.useState('skins');
        const [charId, setCharId] = React.useState(() => {
            const saved = localStorage.getItem('lacosteCharacter');
            const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
            if (saved && chars[saved]) return saved;
            return Object.keys(chars)[0] || 'crocodile';
        });
        const [, force] = React.useReducer(x => x + 1, 0);
        React.useEffect(() => {
            Pack4State.uiListeners.push(force);
            return () => { Pack4State.uiListeners = Pack4State.uiListeners.filter(l => l !== force); };
        }, []);

        const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
        const tiers = P4_CONFIG.skinTiers || {};
        const currentSkinsMap = (() => { try { return JSON.parse(localStorage.getItem('lacosteCurrentSkins') || '{}'); } catch { return {}; } })();
        const currentSkinForChar = currentSkinsMap[charId] || chars[charId]?.skins?.[0]?.id;

        const selectChar = (id) => {
            setCharId(id);
            localStorage.setItem('lacosteCharacter', id);
            if (window.__gameSetCharacter) window.__gameSetCharacter(id);
            window.GameEvents.emit('pack4_character_changed', { charId: id });
        };

        const subTabs = [
            { id: 'skins', label: '🎨 Skins' },
            { id: 'buffs', label: '⭐ Buffs' },
            { id: 'items', label: '🧪 Items' },
            { id: 'upgrades', label: '📈 Upgrades' },
        ];

        const renderSkins = () => {
            const charSkins = chars[charId]?.skins || [];
            return React.createElement('div', null,
                React.createElement('div', { className: 'ms-char-tabs' },
                    Object.values(chars).map(c => React.createElement('button', {
                        key: c.id,
                        className: `ms-char-tab ${charId === c.id ? 'active' : ''}`,
                        onClick: () => selectChar(c.id),
                    }, `${c.emoji || '❓'} ${c.name}`))
                ),
                charSkins.length === 0
                    ? React.createElement('div', { className: 'ms-empty' }, 'No skins for this character')
                    : React.createElement('div', { className: 'ms-grid' },
                        charSkins.slice().sort((a, b) => (tiers[a.tier]?.order || 0) - (tiers[b.tier]?.order || 0)).map(skin => {
                            const owned = Pack4State.unlockedSkins.includes(skin.id);
                            const equipped = currentSkinForChar === skin.id;
                            const tier = tiers[skin.tier] || { name: skin.tier, color: '#fff', emoji: '?' };
                            return React.createElement('div', { key: skin.id, className: `ms-card ${owned ? 'owned' : ''}` },
                                React.createElement('div', { className: 'ms-card-tier', style: { background: tier.color + '33', color: tier.color, border: `1px solid ${tier.color}66` } }, `${tier.emoji} ${tier.name}`),
                                React.createElement('div', { className: 'ms-card-icon', style: { filter: tier.filter || 'none' } }, chars[charId].emoji || '🐾'),
                                React.createElement('div', { className: 'ms-card-name' }, skin.name),
                                equipped
                                    ? React.createElement('button', { className: 'ms-buy-btn equipped', disabled: true }, '✓ EQUIPPED')
                                    : owned
                                        ? React.createElement('button', { className: 'ms-buy-btn', onClick: () => { equipSkin(charId, skin.id); force(); } }, 'EQUIP')
                                        : React.createElement('button', { className: 'ms-buy-btn', onClick: () => { buySkin(skin.id, skin.price); force(); } }, `💰 ${skin.price}`)
                            );
                        })
                    )
            );
        };

        const renderBuffs = () => React.createElement('div', { className: 'ms-grid' },
            P4_CONFIG.shop.buffs.map(buff => {
                const owned = Pack4State.boughtBuffs.includes(buff.id);
                return React.createElement('div', { key: buff.id, className: `ms-card ${owned ? 'owned' : ''}` },
                    React.createElement('div', { className: 'ms-card-icon' }, buff.icon || '⭐'),
                    React.createElement('div', { className: 'ms-card-name' }, buff.name),
                    React.createElement('div', { className: 'ms-card-sub' }, buff.description),
                    owned
                        ? React.createElement('button', { className: 'ms-buy-btn equipped', disabled: true }, '✓ ACTIVE')
                        : React.createElement('button', { className: 'ms-buy-btn', onClick: () => { buyBuff(buff.id, buff.price); force(); } }, `💰 ${buff.price}`)
                );
            })
        );

        const renderItems = () => React.createElement('div', { className: 'ms-grid' },
            P4_CONFIG.shop.consumables.map(item => {
                const count = Pack4State.inventory[item.id] || 0;
                return React.createElement('div', { key: item.id, className: 'ms-card' },
                    React.createElement('div', { className: 'ms-card-icon', style: { color: item.color || '#fff' } }, item.icon || '🧪'),
                    React.createElement('div', { className: 'ms-card-name' }, item.name),
                    React.createElement('div', { className: 'ms-card-sub', style: { color: '#FFD700' } }, `Owned: ${count}`),
                    React.createElement('button', { className: 'ms-buy-btn', onClick: () => { buyConsumable(item.id, item.price); force(); } }, `💰 ${item.price}`)
                );
            })
        );

        const renderUpgrades = () => {
            const maxLvl = P4_CONFIG.upgrades.maxLevel || 10;
            const statInfo = { speed: { icon: '⚡', name: 'Speed' }, jump: { icon: '🦘', name: 'Jump' }, luck: { icon: '🍀', name: 'Luck' } };
            const charData = chars[charId];
            const charUpgrades = Pack4State.upgrades[charId] || { speed: 0, jump: 0, luck: 0 };
            return React.createElement('div', null,
                React.createElement('div', { className: 'ms-char-tabs' },
                    Object.values(chars).map(c => React.createElement('button', {
                        key: c.id,
                        className: `ms-char-tab ${charId === c.id ? 'active' : ''}`,
                        onClick: () => selectChar(c.id),
                    }, `${c.emoji || '❓'} ${c.name}`))
                ),
                React.createElement('div', { className: 'ms-grid' },
                    ['speed', 'jump', 'luck'].map(stat => {
                        const lvl = charUpgrades[stat] || 0;
                        const maxed = lvl >= maxLvl;
                        const price = upgradePrice(lvl);
                        const base = charData?.stats?.[stat] ?? 1.0;
                        const current = base + lvl * (P4_CONFIG.upgrades.statBonus || 0.05);
                        return React.createElement('div', { key: stat, className: `ms-card ${maxed ? 'maxed' : ''}` },
                            React.createElement('div', { className: 'ms-card-icon' }, statInfo[stat].icon),
                            React.createElement('div', { className: 'ms-card-name' }, `${statInfo[stat].name} · Lv.${lvl}/${maxLvl}`),
                            React.createElement('div', { className: 'ms-card-sub' }, `${base.toFixed(2)} → ${current.toFixed(2)}`),
                            React.createElement('div', { className: 'ms-progress' },
                                React.createElement('div', { className: `ms-progress-bar ${maxed ? 'maxed' : ''}`, style: { width: `${(lvl / maxLvl) * 100}%` } })
                            ),
                            maxed
                                ? React.createElement('button', { className: 'ms-buy-btn maxed', disabled: true }, '⭐ MAXED')
                                : React.createElement('button', { className: 'ms-buy-btn', onClick: () => { buyUpgrade(charId, stat); force(); } }, `💰 ${price}`)
                        );
                    })
                )
            );
        };

        return React.createElement('div', null,
            React.createElement('div', { className: 'ms-tabs', style: { padding: '0 0 10px', marginBottom: '16px' } },
                subTabs.map(t => React.createElement('button', {
                    key: t.id,
                    className: `ms-tab ${activeSub === t.id ? 'active' : ''}`,
                    onClick: () => setActiveSub(t.id),
                }, t.label))
            ),
            activeSub === 'skins' && renderSkins(),
            activeSub === 'buffs' && renderBuffs(),
            activeSub === 'items' && renderItems(),
            activeSub === 'upgrades' && renderUpgrades()
        );
    }

    // ─── RENDER: PROMO ───
    function renderPromoTab() {
        const [, force] = React.useReducer(x => x + 1, 0);
        React.useEffect(() => {
            Pack4State.uiListeners.push(force);
            return () => { Pack4State.uiListeners = Pack4State.uiListeners.filter(l => l !== force); };
        }, []);
        const [friendInput, setFriendInput] = React.useState('');
        const [adminInput, setAdminInput] = React.useState('');

        const copyMyCode = () => {
            try {
                navigator.clipboard.writeText(Pack4State.myFriendCode);
                window.GameEvents.emit('pack4_toast', { text: '📋 Code copied', type: 'info' });
                SFX.play('equip', 1.0);
            } catch (e) {}
        };

        return React.createElement('div', null,
            React.createElement('div', { className: 'ms-promo-card' },
                React.createElement('div', { className: 'ms-section-title' }, '🎁 My friend code'),
                React.createElement('div', { className: 'ms-promo-code' }, Pack4State.myFriendCode),
                React.createElement('div', { className: 'ms-promo-hint' }, 'Код можно скопировать и передать другу. Активация наград будет доступна после подключения серверной проверки.'),
                React.createElement('div', { className: 'ms-row', style: { marginTop: '12px' } },
                    React.createElement('button', { className: 'ms-btn', onClick: copyMyCode }, '📋 COPY')
                )
            ),
            React.createElement('div', { className: 'ms-promo-card' },
                React.createElement('div', { className: 'ms-section-title' }, '👥 Enter friend code'),
                React.createElement('div', { className: 'ms-row' },
                    React.createElement('input', {
                        className: 'ms-input',
                        placeholder: 'FRIEND-XXXX',
                        value: friendInput,
                        onChange: e => setFriendInput(e.target.value.toUpperCase()),
                        disabled: true,
                    }),
                    React.createElement('button', {
                        className: 'ms-btn primary',
                        onClick: () => { if (applyFriendCode(friendInput)) { setFriendInput(''); force(); } },
                        disabled: true,
                    }, 'SERVER REQUIRED')
                ),
                Pack4State.promoUsed.friend && React.createElement('div', { className: 'ms-promo-hint' }, '✅ Использован: ', Pack4State.promoUsed.friend)
            ),
            React.createElement('div', { className: 'ms-promo-card' },
                React.createElement('div', { className: 'ms-section-title' }, '👑 Admin rewards'),
                React.createElement('div', { className: 'ms-promo-hint' }, 'Отключено в клиентской версии. Административные награды должны выдаваться сервером после проверки прав.')
            )
        );
    }

    // ─── RENDER: LEADERBOARD ───
    function renderLeaderboardTab() {
        if (Pack4State.leaderboard.length === 0) {
            return React.createElement('div', { className: 'ms-empty' }, '🏆 Пока нет рекордов. Сыграй!');
        }
        return React.createElement('div', null,
            React.createElement('div', { className: 'ms-section-title' }, '🏆 Top 10'),
            Pack4State.leaderboard.map((entry, i) => React.createElement('div', {
                key: i,
                className: 'ms-row',
                style: {
                    padding: '10px 14px',
                    background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    border: i === 0 ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
                },
            },
                React.createElement('span', { style: { fontSize: '20px', minWidth: '40px' } }, `#${i + 1}`),
                React.createElement('span', { style: { flex: 1, fontFamily: 'Rajdhani', fontWeight: '700', fontSize: '16px', color: i === 0 ? '#FFD700' : '#fff' } }, `${entry.score}m`),
                React.createElement('span', { style: { fontSize: '12px', opacity: 0.6 } }, new Date(entry.date).toLocaleDateString())
            ))
        );
    }

    function renderMissionsTab() {
        const [, force] = React.useReducer(x => x + 1, 0);
        React.useEffect(() => { Pack4State.uiListeners.push(force); return () => { Pack4State.uiListeners = Pack4State.uiListeners.filter(fn => fn !== force); }; }, []);
        if (!Pack4State.missions.length) return React.createElement('div', { className: 'ms-empty' }, 'Миссии пока не настроены.');
        return React.createElement('div', null,
            React.createElement('div', { className: 'ms-section-title' }, '📋 MISSIONS'),
            React.createElement('div', { className: 'ms-grid' }, Pack4State.missions.map(m => {
                const progress = Math.min(m.target, Math.max(0, Number(m.progress) || 0));
                const complete = !!m.completed || progress >= m.target;
                return React.createElement('div', { key: m.id, className: `ms-card ${complete ? 'owned' : ''}`, style: { alignItems: 'stretch' } },
                    React.createElement('div', { className: 'ms-card-name' }, m.title),
                    React.createElement('div', { className: 'ms-card-sub' }, `${progress} / ${m.target}`),
                    React.createElement('div', { className: 'ms-progress' }, React.createElement('div', { className: `ms-progress-bar ${complete ? 'maxed' : ''}`, style: { width: `${(progress / Math.max(1, m.target)) * 100}%` } })),
                    React.createElement('div', { className: 'ms-card-sub' }, `Награда: ${m.reward} монет`),
                    React.createElement('div', { className: 'ms-card-sub', style: { color: complete ? '#00ffb4' : '#aaa' } }, complete ? '✓ Выполнено' : 'В процессе')
                );
            }))
        );
    }

    window.Pack4Render = {
        shop: renderShopTab,
        promo: renderPromoTab,
        leaderboard: renderLeaderboardTab,
        missions: renderMissionsTab,
    };

    // ─── TOAST ───
    function Pack4ToastSystem() {
        const [toasts, setToasts] = React.useState([]);
        const [minorToasts, setMinorToasts] = React.useState([]);
        React.useEffect(() => {
            const listener = (data) => {
                const id = Date.now() + Math.random();
                const text = String(data?.text || '');
                // Frequent low-priority feedback goes to a discreet side rail.
                const minor = /food bonus|\+\s*\d+\s*HP|\+HP|food collected/i.test(text);
                const item = { id, ...data };
                const setter = minor ? setMinorToasts : setToasts;
                setter(prev => [...prev, item].slice(minor ? -3 : -2));
                setTimeout(() => setter(prev => prev.filter(t => t.id !== id)), minor ? 2200 : 3600);
            };
            window.GameEvents.on('pack4_toast', listener);
            return () => {
                if (window.GameEvents.listeners['pack4_toast']) {
                    window.GameEvents.listeners['pack4_toast'] = window.GameEvents.listeners['pack4_toast'].filter(cb => cb !== listener);
                }
            };
        }, []);
        return React.createElement(React.Fragment, null,
            React.createElement('div', {
                className: 'pack3-toast-container', // сохраняем класс для совместимости CSS
                style: { pointerEvents: 'none' },
            }, toasts.map(t => React.createElement('div', { key: t.id, className: `pack3-toast ${t.type}` }, t.text))),
            React.createElement('div', { className: 'pack4-minor-toast-rail', 'aria-live': 'polite' },
                minorToasts.map(t => React.createElement('div', { key: t.id, className: 'pack4-minor-toast' }, t.text)))
        );
    }

    if (window.PackUIs) window.PackUIs.push(Pack4ToastSystem);

    console.log('%c💎 PACK 4 (Economy, Skins, Upgrades, Promo v2) loaded', 'color:#FFD700;font-weight:bold;font-size:14px');
})();
