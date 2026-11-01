/* ==================================================================
   PACK 1 — Advanced Game Feel: Audio, Vibration, Visual Juice
   v2.0 — расширенные SFX, prefers-reduced-motion, обработка boss/rare
   ================================================================== */
(function () {
    'use strict';

    const P1_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.pack1) || {};
    const CHARGE_CONFIG = P1_CONFIG.charges || { max: 3, foodPerCharge: 5, dashCost: 2, doubleJumpCost: 1, invulnMs: 600, dashDurationMs: 800 };
    const COMBO_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.combo) || {
        decayTimeMs: 3000,
        tiers: [
            { threshold: 3, mult: 2, emoji: '😎', color: '#00FFFF' },
            { threshold: 5, mult: 3, emoji: '🔥', color: '#FFD700' },
            { threshold: 10, mult: 5, emoji: '👑', color: '#FF007F' },
            { threshold: 20, mult: 10, emoji: '🌈', color: '#FFFFFF' }
        ],
        sadEmoji: '😢', sadColor: '#888888'
    };

    // prefers-reduced-motion
    const PREFERS_REDUCED_MOTION = (() => {
        try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false; }
        catch { return false; }
    })();

    const Pack1State = {
        combo: 0,
        comboMult: 1,
        comboDisplay: { mult: 1, count: 0 },
        lastJumpTime: 0,
        uiListeners: [],
        activeEmojis: [],
        settings: null,
        audios: {},
        lastHealth: 6,
        lowHealthPulse: 0,
        lastMilestone: 0,
        milestonesActive: [],
        isFalling: false,
        reducedMotion: PREFERS_REDUCED_MOTION,
        charges: 0,
        foodChargeProgress: 0,
        dashUntil: 0,
        invulnUntil: 0,
    };

    window.Pack1State = Pack1State;

    // Все пути к звукам задаются только в config.js -> GAME_CONFIG.audio.sfx.
    const AUDIO_SFX = (window.GAME_CONFIG && window.GAME_CONFIG.audio && window.GAME_CONFIG.audio.sfx) || {};
    const SOUND_PATHS = {
        jump: AUDIO_SFX.jump,
        land: AUDIO_SFX.land,
        hit: AUDIO_SFX.hit,
        eat: AUDIO_SFX.eat,
        golden: AUDIO_SFX.goldenFood,
        rare: AUDIO_SFX.rareFood,
        poison: AUDIO_SFX.poisonFood,
        milestone: AUDIO_SFX.milestone,
        boss: AUDIO_SFX.boss,
        shieldBreak: AUDIO_SFX.shieldBreak,
        powerup: AUDIO_SFX.powerup,
        dash: AUDIO_SFX.dash,
    };

    function initSounds() {
        for (const [key, path] of Object.entries(SOUND_PATHS)) {
            if (Pack1State.audios[key]) continue;
            if (typeof path !== 'string' || !path.trim()) continue;
            try {
                const audio = new Audio(path.trim());
                audio.preload = 'auto';
                audio.volume = 0.7;
                audio.onerror = () => {};
                Pack1State.audios[key] = audio;
            } catch (e) { /* ignore */ }
        }
    }
    initSounds(); // preload сразу

    function playSound(key, rate = 1.0, volumeMult = 1.0) {
        const audio = Pack1State.audios[key];
        if (!audio) return;
        const s = Pack1State.settings;
        if (!s || !s.soundEnabled) return;
        try {
            audio.currentTime = 0;
            audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
            audio.volume = Math.max(0, Math.min(1,
                (s.sfxVolume ?? 0.7) * (s.masterVolume ?? 1.0) * volumeMult
            ));
            audio.play().catch(() => {});
        } catch (e) { /* ignore */ }
    }

    function vibrate(pattern) {
        const s = Pack1State.settings;
        if (s && s.vibrateEnabled === false) return;
        // reduced-motion: урезаем длинные паттерны
        if (Pack1State.reducedMotion) {
            if (Array.isArray(pattern)) {
                pattern = pattern.map(v => Math.min(20, v));
            } else if (typeof pattern === 'number') {
                pattern = Math.min(20, pattern);
            }
        }
        if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
    }

    function updateUI() {
        Pack1State.uiListeners.forEach(fn => {
            try { fn({ ...Pack1State.comboDisplay, charges: Pack1State.charges }); } catch (e) { /* ignore */ }
        });
    }

    function resetCombo(triggerSadEmoji = false, x = 0, y = 0) {
        if (Pack1State.combo > 0 && triggerSadEmoji
            && !Pack1State.reducedMotion
            && Pack1State.settings?.comboVisualsEnabled) {
            Pack1State.activeEmojis.push({
                text: COMBO_CONFIG.sadEmoji, x, y: y - 50,
                life: 60, maxLife: 60, color: COMBO_CONFIG.sadColor, scale: 1.5, vy: -2
            });
        }
        Pack1State.combo = 0;
        Pack1State.comboMult = 1;
        Pack1State.comboDisplay = { mult: 1, count: 0 };
        Pack1State.isFalling = false;
        updateUI();
    }

    function addCombo(x, y) {
        if (Pack1State.settings && !Pack1State.settings.comboEnabled) return;
        Pack1State.combo++;
        Pack1State.lastJumpTime = Date.now();

        let currentTier = { mult: 1, emoji: '', color: '#FFF' };
        for (const tier of COMBO_CONFIG.tiers) {
            if (Pack1State.combo >= tier.threshold) currentTier = tier;
        }
        const prevMult = Pack1State.comboMult;
        Pack1State.comboMult = currentTier.mult;
        Pack1State.comboDisplay = { mult: currentTier.mult, count: Pack1State.combo };

        if (!Pack1State.reducedMotion && Pack1State.settings?.comboVisualsEnabled) {
            if (currentTier.mult > prevMult && currentTier.emoji) {
                Pack1State.activeEmojis.push({
                    text: currentTier.emoji, x, y: y - 30,
                    life: 80, maxLife: 80, color: currentTier.color, scale: 2.0, vy: -3
                });
                if (window.RenderEngine) {
                    window.RenderEngine.spawnParticles(x, y, 20, {
                        colors: [currentTier.color, '#FFFFFF'],
                        speed: 6, life: 30, size: 3, gravity: -0.1, shape: 'spark'
                    });
                }
            } else if (Math.random() < 0.35) {
                const smallEmojis = ['👍', '❤️', '✨', '💯'];
                const randEmoji = smallEmojis[Math.floor(Math.random() * smallEmojis.length)];
                Pack1State.activeEmojis.push({
                    text: randEmoji, x: x + (Math.random() - 0.5) * 40, y: y - 20,
                    life: 40, maxLife: 40, color: '#FFFFFF', scale: 1.0, vy: -2
                });
            }
        }
        updateUI();
    }

    // === LIFECYCLE ===
    window.GameEvents.on('start', (data) => {
        initSounds();
        resetCombo(false);
        Pack1State.settings = data?.settings || Pack1State.settings;
        Pack1State.activeEmojis = [];
        Pack1State.milestonesActive = [];
        Pack1State.lastHealth = data?.health ?? 6;
        Pack1State.charges = 0;
        Pack1State.foodChargeProgress = 0;
        Pack1State.dashUntil = 0;
        Pack1State.invulnUntil = 0;
        Pack1State.lastMilestone = 0;
        Pack1State.lowHealthPulse = 0;
        Pack1State.isFalling = false;

        // START_COMBO buff (совместимо с Core-паком)
        if (window.Pack4State && window.Pack4State.boughtBuffs?.includes('start_combo')) {
            Pack1State.combo = 5;
            Pack1State.comboMult = 3;
            Pack1State.comboDisplay = { mult: 3, count: 5 };
            Pack1State.lastJumpTime = Date.now();
            updateUI();
        }
    });

    // === CHARGE ABILITIES ===
    function updateChargeUI() { updateUI(); }
    function addFoodCharge() {
        const perCharge = Math.max(1, CHARGE_CONFIG.foodPerCharge || 5);
        Pack1State.foodChargeProgress++;
        if (Pack1State.foodChargeProgress >= perCharge) {
            Pack1State.foodChargeProgress -= perCharge;
            Pack1State.charges = Math.min(CHARGE_CONFIG.max || 3, Pack1State.charges + 1);
            window.GameEvents.emit('pack1_toast', { text: `⚡ Ability charge ${Pack1State.charges}/${CHARGE_CONFIG.max || 3}`, type: 'info' });
        }
        updateChargeUI();
    }
    function spendCharges(cost) {
        if (Pack1State.charges < cost) return false;
        Pack1State.charges -= cost;
        updateChargeUI();
        return true;
    }
    function activateDash() {
        if (window.__LACOSTE_GAME_STATE !== 'playing') return false;
        if (!spendCharges(CHARGE_CONFIG.dashCost || 2)) return false;
        const now = Date.now();
        Pack1State.dashUntil = now + (CHARGE_CONFIG.dashDurationMs || 800);
        Pack1State.invulnUntil = Math.max(Pack1State.invulnUntil, now + (CHARGE_CONFIG.invulnMs || 600));
        playSound('dash', 1.4);
        vibrate([20, 30, 20]);
        window.GameEvents.emit('dash_activated', { until: Pack1State.dashUntil });
        updateChargeUI();
        return true;
    }
    function consumeDoubleJump() {
        if (window.__LACOSTE_GAME_STATE !== 'playing') return false;
        if (!spendCharges(CHARGE_CONFIG.doubleJumpCost || 1)) return false;
        playSound('dash', 1.1, 0.7);
        window.GameEvents.emit('double_jump_activated');
        return true;
    }
    Pack1State.addFoodCharge = addFoodCharge;
    Pack1State.activateDash = activateDash;
    Pack1State.consumeDoubleJump = consumeDoubleJump;
    Pack1State.getChargeConfig = () => CHARGE_CONFIG;

    window.GameEvents.on('eat', addFoodCharge);
    window.GameEvents.on('dash_activated', () => { if (window.RenderEngine && !Pack1State.reducedMotion) window.RenderEngine.flash('0,255,255', 0.3); });

    // === JUMP / LAND ===
    window.GameEvents.on('jump', (data) => {
        addCombo(data.x || 100, data.y || 400);
        const pitch = 1.0 + Math.min(Pack1State.combo * 0.02, 0.5);
        playSound('jump', pitch);
        vibrate(15);
        Pack1State.isFalling = true;
    });

    window.GameEvents.on('land', () => {
        playSound('land', 1.0, 0.8);
    });

    // === HIT (обычный + boss) ===
    window.GameEvents.on('hit', (data) => {
        resetCombo(true, data.playerX || 100, data.playerY || 400);

        if (data?.type === 'boss') {
            playSound('boss', 0.7, 1.0);
            vibrate([60, 40, 60, 40, 120]);
        } else {
            playSound('hit');
            vibrate([30, 50, 30]);
        }

        if (window.RenderEngine && !Pack1State.reducedMotion) {
            window.RenderEngine.flash('255,0,0', 0.4);
            window.RenderEngine.shake(6, 12);
            window.RenderEngine.spawnParticles(data.playerX || 100, data.playerY || 400, 15, {
                colors: ['#FF007F', '#FFFFFF'], speed: 4, life: 25, size: 3, gravity: 0.15
            });
        }
    });

    // === BARREL ===
    window.GameEvents.on('barrel_hit', (data) => {
        resetCombo(true, data.x || 100, data.y || 400);
        playSound('hit', 0.8, 1.0);
        vibrate([40, 60, 40]);
    });

    // === EAT (дифференцировано) ===
    window.GameEvents.on('eat', (data) => {
        const type = data?.pack1Type || 'regular';
        if (type === 'golden') {
            playSound('golden', 1.5, 1.0);
            vibrate([15, 20, 15, 20, 30]);
        } else if (type === 'rare') {
            playSound('rare', 1.3, 0.8);
            vibrate(15);
        } else if (type === 'poison') {
            playSound('poison', 0.6, 1.0);
            vibrate([50, 80, 50]);
        } else {
            playSound('eat', 1.2);
            vibrate(10);
        }

        if (window.RenderEngine && !Pack1State.reducedMotion) {
            const colors = type === 'golden' ? ['#FFD700', '#FFFFFF'] :
                           type === 'poison' ? ['#8B00FF', '#444'] :
                           ['#FFD700', '#FFAA00'];
            window.RenderEngine.spawnParticles(100, 400, 10, {
                colors, speed: 3, life: 30, size: 4, gravity: 0.1
            });
        }
    });

    // === POWERUP / SHIELD ===
    window.GameEvents.on('powerup_collect', () => {
        playSound('powerup', 1.5);
        vibrate([15, 30, 15]);
        if (window.RenderEngine && !Pack1State.reducedMotion) {
            window.RenderEngine.flash('0,255,255', 0.3);
        }
    });

    window.GameEvents.on('shield_break', () => {
        playSound('shieldBreak', 0.9);
        vibrate([20, 40, 20]);
        if (window.RenderEngine && !Pack1State.reducedMotion) {
            window.RenderEngine.flash('0,150,255', 0.4);
        }
    });

    // === TICK ===
    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack1State.settings = data.settings;

        // Combo decay
        if (Pack1State.combo > 0 && Pack1State.settings?.comboEnabled) {
            const dt = Date.now() - Pack1State.lastJumpTime;
            if (dt > COMBO_CONFIG.decayTimeMs) resetCombo(false);
        }

        // Low health pulse
        if (data.health !== undefined) {
            if (data.health <= 2 && data.health > 0) Pack1State.lowHealthPulse += 0.1;
            else Pack1State.lowHealthPulse = 0;
            Pack1State.lastHealth = data.health;
        }

        // Milestones
        if (data.distance !== undefined) {
            const currentMile = Math.floor(data.distance / 100);
            if (currentMile > Pack1State.lastMilestone && currentMile > 0) {
                Pack1State.lastMilestone = currentMile;
                playSound('milestone', 1.0 + (currentMile % 5) * 0.1);
                vibrate([20, 100, 20]);
                if (!Pack1State.reducedMotion) {
                    Pack1State.milestonesActive.push({
                        text: `${currentMile * 100}m! ✨`, x: 600, y: 200,
                        life: 120, maxLife: 120, color: '#FFD700', scale: 1.5, vy: -1
                    });
                    if (window.RenderEngine) {
                        window.RenderEngine.spawnParticles(600, 300, 40, {
                            colors: ['#FFD700', '#FF007F', '#00FFFF'],
                            speed: 8, life: 60, size: 4, gravity: 0.05
                        });
                    }
                }
            }
        }
    });

    // === GAMEOVER ===
    window.GameEvents.on('gameover', () => {
        resetCombo(false);
        Pack1State.activeEmojis = [];
        Pack1State.milestonesActive = [];
        Pack1State.lowHealthPulse = 0;
        Pack1State.isFalling = false;
    });

    // === RENDER ===
    window.GameEvents.on('render_frame', ({ ctx }) => {
        if (!ctx) return;
        const reduced = Pack1State.reducedMotion;

        // Floating emojis (combo feedback)
        if (Pack1State.activeEmojis.length) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let i = Pack1State.activeEmojis.length - 1; i >= 0; i--) {
                const e = Pack1State.activeEmojis[i];
                e.y += e.vy; e.life--;
                if (e.life <= 0) { Pack1State.activeEmojis.splice(i, 1); continue; }
                const progress = e.life / e.maxLife;
                ctx.globalAlpha = Math.min(1, Math.max(0, progress > 0.8 ? (1 - progress) / 0.2 : progress));
                ctx.font = `${Math.floor(30 * e.scale)}px Arial`;
                ctx.fillStyle = e.color || '#fff';
                ctx.fillText(e.text, e.x, e.y);
            }
            ctx.restore();
        }

        // Milestone text
        if (Pack1State.milestonesActive.length) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let i = Pack1State.milestonesActive.length - 1; i >= 0; i--) {
                const m = Pack1State.milestonesActive[i];
                m.y += m.vy; m.life--;
                if (m.life <= 0) { Pack1State.milestonesActive.splice(i, 1); continue; }
                const progress = m.life / m.maxLife;
                ctx.globalAlpha = Math.min(1, Math.max(0, progress));
                ctx.font = `bold ${Math.floor(40 * m.scale)}px Arial`;
                ctx.fillStyle = m.color;
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 10;
                ctx.fillText(m.text, m.x, m.y);
            }
            ctx.restore();
        }

        // Low health red vignette
        if (Pack1State.lastHealth <= 2 && Pack1State.lastHealth > 0 && !reduced) {
            ctx.save();
            const alpha = 0.15 + Math.sin(Pack1State.lowHealthPulse) * 0.15;
            const grad = ctx.createRadialGradient(
                ctx.canvas.width / 2, ctx.canvas.height / 2,
                Math.min(ctx.canvas.width, ctx.canvas.height) * 0.4,
                ctx.canvas.width / 2, ctx.canvas.height / 2,
                Math.max(ctx.canvas.width, ctx.canvas.height) * 0.7
            );
            grad.addColorStop(0, 'rgba(255,0,0,0)');
            grad.addColorStop(1, `rgba(255,0,0,${alpha})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
    });

    // === UI ===
    function Pack1UI({ gameState }) {
        const [display, setDisplay] = React.useState({ ...Pack1State.comboDisplay, charges: Pack1State.charges });
        React.useEffect(() => {
            Pack1State.uiListeners.push(setDisplay);
            return () => {
                const idx = Pack1State.uiListeners.indexOf(setDisplay);
                if (idx >= 0) Pack1State.uiListeners.splice(idx, 1);
            };
        }, []);
        if (gameState !== 'playing') return null;
        let tierColor = '#FFFFFF';
        for (const tier of COMBO_CONFIG.tiers) if (display.count >= tier.threshold) tierColor = tier.color;
        return React.createElement(React.Fragment, null,
            display.mult > 1 ? React.createElement('div', {
                key: display.count,
                className: `combo-indicator combo-x${display.mult}`,
                style: { color: tierColor, textShadow: `0 0 15px ${tierColor}` }
            }, `COMBO x${display.mult}  [${display.count}]`) : null,
            React.createElement('div', { className: 'pack1-ability-controls' },
                React.createElement('button', {
                    type: 'button', className: 'pack1-ability-btn dash', title: 'Dash',
                    disabled: display.charges < (CHARGE_CONFIG.dashCost || 2),
                    onClick: activateDash,
                }, `⚡ DASH ${display.charges}/${CHARGE_CONFIG.max || 3}`),
                React.createElement('button', {
                    type: 'button', className: 'pack1-ability-btn double-jump', title: 'Double jump',
                    disabled: display.charges < (CHARGE_CONFIG.doubleJumpCost || 1),
                    onClick: () => window.GameEvents.emit('ability_double_jump'),
                }, '↟ DOUBLE JUMP')
            )
        );
    }

    if (window.PackUIs) { window.PackUIs.push(Pack1UI); } else { window.PackUIs = [Pack1UI]; }

    console.log('%c🔥 PACK 1 (Advanced Game Feel v2) loaded', 'color:#FF007F;font-weight:bold;font-size:14px');
})();
