/* ==================================================================
   config.js — Глобальная конфигурация игры
   ================================================================== */
(function () {
    'use strict';

    window.GAME_CONFIG = {
        physics: { gravity: 0.68, jumpForce: -11.5, holdThrust: 0.55, groundY: 530, baseSpeed: 4.0, speedMultiplier: 0.8 },

        defaultSettings: {
            sfxVolume: 0.7, ambientVolume: 0.25, masterVolume: 1.0, soundEnabled: true, graphics: 'high',
            comboEnabled: true, comboVisualsEnabled: true, weatherEnabled: true, dynamicMusicEnabled: true,
            biomesEnabled: true, achievementsEnabled: true, dailyGoalsEnabled: true,
            hudScale: 1.0, hudOpacity: 0.8,
            vibrateEnabled: true
        },

        // ==============================================================
        // AUDIO CONFIG — ВСЕ ЗВУКИ И МУЗЫКА ИГРЫ В ОДНОМ МЕСТЕ.
        // Укажи путь относительно index.html, например:
        // jump: 'source/sounds/jump.mp3'
        // Пустая строка означает «звук отключён / файл ещё не назначен».
        // ==============================================================
        audio: {
            sfx: {
                // Персонаж и игровой процесс
                jump: '', land: '', hit: '', eat: '', goldenFood: '', rareFood: '', poisonFood: '',
                milestone: '', boss: '', shieldBreak: '', powerup: '', dash: '',
                pitFall: '', barrelExplosion: '', puddleSplash: '',

                // Предметы и бонусы
                powerupShield: '', powerupMagnet: '', powerupSprint: '', powerupSlowmo: '',
                pickupShield: '', pickupMagnet: '', pickupSprint: '', pickupSlowmo: '',
                thunder: '',

                // Достижения, биомы и интерфейс
                whoosh: '', achievement: '', purchase: '', unlock: '', equip: '', promo: '', ufoCatch: '', ufoArrival: '', ufoBeam: '', ufoSteal: '', ufoCoinDrop: '', ufoCoinCollect: '', ufoSkinReward: '', error: ''
            },
            ambient: {
                day: '', night: '', rain: ''
            },
            music: {
                // Слои включаются по мере набора дистанции. Можно оставить один слой.
                layers: [
                    { file: '', minDistance: 0 },
                    { file: '', minDistance: 1500 }
                ]
            }
        },

        combo: {
            decayTimeMs: 3000,
            tiers: [
                { threshold: 3,  mult: 2, emoji: '😎', color: '#00FFFF' },
                { threshold: 5,  mult: 3, emoji: '🔥', color: '#FFD700' },
                { threshold: 10, mult: 5, emoji: '👑', color: '#FF007F' },
                { threshold: 20, mult: 10, emoji: '🌈', color: '#FFFFFF' }
            ],
            sadEmoji: '😢', sadColor: '#888888'
        },

        pack1: {
            combo: {
                thresholds: [
                    { c: 3,  m: 2 },
                    { c: 5,  m: 3 },
                    { c: 10, m: 5 },
                    { c: 20, m: 10 }
                ],
                decayMs: 3000
            },
            charges: { max: 3, foodPerCharge: 5, dashCost: 2, doubleJumpCost: 1, invulnMs: 600, dashDurationMs: 800 },
            food: {
                weights: {
                    regular: { emoji: '🍗', weight: 60, score: 10, growth: 1 },
                    golden:  { emoji: '🌟', weight: 15, score: 50, growth: 2, coins: 5 },
                    rare:    { emoji: '🍎', weight: 20, score: 25, heal: 2 },
                    poison:  { emoji: '🍄', weight: 5,  score: 0,  damage: 1 }
                }
            }
        },

        pack2: {
            powerups: {
                spawnChance: 0.05,
                types: {
                    shield: { emoji: '🛡️', duration: 0, color: '#00FFFF' },
                    magnet: { emoji: '🧲', duration: 5000, color: '#FF0000' },
                    sprint: { emoji: '⚡', duration: 3000, color: '#FFD700' },
                    slowmo: { emoji: '⏳', duration: 3000, color: '#0080FF' }
                }
            },
            weather: {
                changeDistance: 1000,
                combinations: [
                    { id: 'clear',  label: '☀️', rain: false, fog: false, storm: false, tint: 'rgba(0,0,0,0)' },
                    { id: 'cloudy', label: '☁️', rain: false, fog: false, storm: false, tint: 'rgba(50,50,60,0.2)' },
                    { id: 'rain',   label: '🌧️', rain: true,  fog: false, storm: false, tint: 'rgba(20,40,60,0.25)' },
                    { id: 'fog',    label: '🌫️', rain: false, fog: true,  storm: false, tint: 'rgba(200,200,210,0.4)' },
                    { id: 'storm',  label: '⛈️', rain: true,  fog: false, storm: true,  tint: 'rgba(10,10,20,0.5)' }
                ]
            }
        },

        pack3: {
            biomes: [
                { id: 'forest', name: '🌳 Forest', distance: 0,    dayImg: 'source/landscape.jpg',     nightImg: 'source/landscape_n.jpg',     obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'] },
                { id: 'desert', name: '🏜️ Desert', distance: 1000, dayImg: 'source/biomes/desert_day.svg', nightImg: 'source/biomes/desert_night.svg',    obstacleTypes: ['cactus', 'rock', 'pit'] },
                { id: 'city',   name: '🏙️ City',   distance: 2000, dayImg: 'source/biomes/city_day.svg', nightImg: 'source/biomes/city_night.svg',      obstacleTypes: ['barrel', 'puddle', 'pit'] },
                { id: 'jungle', name: '🌿 Jungle', distance: 3000, dayImg: 'source/biomes/jungle_day.svg', nightImg: 'source/biomes/jungle_night.svg',    obstacleTypes: ['cactus', 'puddle', 'pit'] }
            ],
            music: {
                // Аудиофайлы настраиваются только в GAME_CONFIG.audio.music.layers.
                maxTempoRate: 1.15, tempoDistance: 2000
            },
            achievements: [
                { id: 'dist_1000',      title: 'Marathoner',   desc: 'Run 1000m',               icon: '🏃' },
                { id: 'dist_3000',      title: 'Legend',       desc: 'Run 3000m',               icon: '👑' },
                { id: 'no_damage_500',  title: 'Untouchable',  desc: '500m without damage',     icon: '🛡️' },
                { id: 'food_50',        title: 'Gourmand',     desc: 'Eat 50 foods',            icon: '🍔' },
                { id: 'jumps_100',      title: 'Jumping Jack', desc: 'Jump 100 times',          icon: '🦘' },
                { id: 'combo_10',       type: 'max_combo', value: 20, title: 'Combo Master', desc: 'Reach the x10 combo multiplier', icon: '🔥' }
            ],
            dailyGoals: [
                { id: 'd_jump_30',  title: 'Jump 30 times',  target: 30,  type: 'jumps',    reward: 'Shield x1' },
                { id: 'd_eat_15',   title: 'Eat 15 foods',   target: 15,  type: 'food',     reward: 'Magnet x1' },
                { id: 'd_dist_500', title: 'Run 500m',       target: 500, type: 'distance', reward: 'Sprint x1' }
            ]
        },

        pack4: {
            economy: { coinsPerMeter: 1, bonusCombo: 5, bonusGoldenFood: 50 },

            skinTiers: {
                bronze: { name: 'Bronze', color: '#CD7F32', order: 1, emoji: '🥉', filter: null },
                silver: { name: 'Silver', color: '#C0C0C0', order: 2, emoji: '🥈', filter: 'grayscale(0.7) brightness(1.2)' },
                gold:   { name: 'Gold',   color: '#FFD700', order: 3, emoji: '🥇', filter: 'sepia(1) saturate(5) hue-rotate(5deg) brightness(1.2)' },
                epic:   { name: 'Epic',   color: '#9B30FF', order: 4, emoji: '💎', filter: 'hue-rotate(270deg) saturate(2) brightness(1.15)' }
            },

            shop: {
                buffs: [
                    { id: 'start_hp',     name: 'Max HP',        price: 500,  description: '+2 Start HP',        icon: '❤️' },
                    { id: 'start_shield', name: 'Shield Start',  price: 1000, description: 'Start with 🛡️',       icon: '🛡️' },
                    { id: 'start_speed',  name: 'Speed Boost',   price: 1500, description: '+5% Score Rate',     icon: '⚡' },
                    { id: 'start_combo',  name: 'Combo Start',   price: 2000, description: 'Start with x3 Combo', icon: '🔥' },
                    { id: 'revive',       name: 'Second Chance', price: 3000, description: 'Survive 1 fatal hit', icon: '💖' }
                ],
                consumables: [
                    { id: 'shield', name: 'Shield',  price: 100, icon: '🛡️', color: '#00FFFF' },
                    { id: 'magnet', name: 'Magnet',  price: 150, icon: '🧲', color: '#FF0000' },
                    { id: 'sprint', name: 'Sprint',  price: 150, icon: '⚡', color: '#FFD700' },
                    { id: 'slowmo', name: 'Slow-mo', price: 100, icon: '⏳', color: '#0080FF' }
                ]
            },

            upgrades: {
                maxLevel: 10,
                priceBase: 500,
                priceStep: 250,
                statBonus: 0.05
            },

            promo: {
                friendPrefix: 'FRIEND-',
                friendCodeLength: 4,
                friendRewardCoins: 500,
                adminCode: '', // Admin rewards must be verified by a server; never ship secrets in client code.
                friendRedemptionEnabled: false,
                adminRewardCoins: 10000
            },

            missions: [
                { id: 'm_run_2000', title: 'Run 2000m',     target: 2000, type: 'distance', reward: 200 },
                { id: 'm_eat_20',   title: 'Eat 20 foods',  target: 20,   type: 'food',     reward: 150 },
                { id: 'm_jump_100', title: 'Jump 100 times', target: 100, type: 'jumps',   reward: 100 }
            ],

            secrets: {
                goldenCrocDistance: 5000,
                ufoChance: 0.05, // шанс встречи с НЛО при начале забега
                // Konami cheat: activates invincibility and starts the same UFO encounter manually.
                // Desktop: Arrow Up Up Down Down Left Right Left Right
                // Mobile :  Swipe  Up Up Down Down Left Right Left Right
                konami: {
                    code: ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight'],
                    swipes: ['up','up','down','down','left','right','left','right'],
                    duration: 10000
                },
                // Полноценное событие НЛО: прилёт из точки, сканирование еды лучом,
                // обмен каждой украденной еды на монету и награда за перехват корабля.
                ufoEncounter: {
                    approachDurationMs: 2800,
                    scanDurationMs: 12000,
                    scanIntervalMs: 250,
                    abductDurationMs: 360,
                    departureDurationMs: 1300,
                    // НЛО зависает на высоте максимального обычного прыжка игрока.
                    // Высота рассчитывается из physics.jumpForce / gravity / holdThrust.
                    hoverHeight: 85, // legacy: больше не используется для вычисления высоты
                    horizontalOffset: 110,
                    patrolSpeed: 3.2, // скорость патрулирования, px за кадр при 60 FPS
                    patrolMinPlayerOffset: 35, // минимальное расстояние слева от центра игрока
                    patrolMaxMargin: 80, // отступ от правого края Canvas
                    verticalBobAmplitude: 4,
                    verticalBobPeriodMs: 1500,
                    beamWidth: 118,
                    beamOpacity: 0.24,
                    coinRewardPerFood: 50,
                    catchRewardCoins: 1000,
                    coinSize: 28,
                    coinGravity: 0.62,
                    coinLifetimeMs: 18000,
                    catchHorizontalRange: 145
                }
            }
        },

        characters: {
            crocodile: {
                id: 'crocodile', name: 'Crocodile', emoji: '🐊', folder: 'source/characters/crocodile',
                frameCount: 12, baseWidth: 165.4, baseHeight: 110.3,
                foodEmojis: ['🍗', '🍔', '🍕', '🥩'], eatEmoji: null, eatFolder: null, eatFrameCount: 0, eatDuration: 0,
                stats: { speed: 1.0, jump: 1.0, luck: 1.0 },
                skins: [
                    { id: 'croc_default', name: 'Original',     tier: 'bronze', price: 0,     unlocked: true  },
                    { id: 'croc_silver',  name: 'Silver Croc',  tier: 'silver', price: 1500,  unlocked: false },
                    { id: 'croc_gold',    name: 'Golden Croc',  tier: 'gold',   price: 5000,  unlocked: false },
                    { id: 'croc_epic',    name: 'Shadow Croc',  tier: 'epic',   price: 15000, unlocked: false }
                ]
            },
            panda: {
                id: 'panda', name: 'Panda', emoji: '🐼', folder: 'source/characters/panda',
                frameCount: 20, baseWidth: 160, baseHeight: 120,
                foodEmojis: ['🎋'], eatEmoji: '🎋', eatFolder: 'source/characters/panda/eating', eatFrameCount: 8, eatDuration: 4.0,
                stats: { speed: 0.9, jump: 1.0, luck: 1.2 },
                skins: [
                    { id: 'panda_default', name: 'Classic',      tier: 'bronze', price: 0,     unlocked: true  },
                    { id: 'panda_silver',  name: 'Silver Panda', tier: 'silver', price: 1500,  unlocked: false },
                    { id: 'panda_gold',    name: 'Red Panda',    tier: 'gold',   price: 5000,  unlocked: false },
                    { id: 'panda_epic',    name: 'Eclipse Panda',tier: 'epic',   price: 15000, unlocked: false }
                ]
            }
        },

        biomes: {
            default: { id: 'default', name: 'Forest', emoji: '🌳', dayImg: 'source/landscape.jpg',       nightImg: 'source/landscape_n.jpg',       groundOffset: 0,  obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'], foodEmojis: null },
            cartoon: { id: 'cartoon', name: 'Cartoon', emoji: '🌲', dayImg: 'source/cartoon_forest.png',  nightImg: 'source/cartoon_forest_n.png',  groundOffset: 30, obstacleTypes: ['rock', 'puddle', 'pit'], foodEmojis: ['🎋'] }
        }
    };
})();
