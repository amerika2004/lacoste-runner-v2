/* Lacoste Modular Engine — engine core (no game-specific mechanics) */
(function (global) {
    'use strict';

    const ENGINE_VERSION = '2.0.0';
    const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

    class Logger {
        constructor(scope = 'Engine') { this.scope = scope; }
        _write(level, args) {
            const fn = console[level] || console.log;
            fn.call(console, `[${this.scope}]`, ...args);
        }
        debug(...args) { this._write('debug', args); }
        info(...args) { this._write('info', args); }
        warn(...args) { this._write('warn', args); }
        error(...args) { this._write('error', args); }
        child(scope) { return new Logger(`${this.scope}:${scope}`); }
    }

    class EventBus {
        constructor(logger = new Logger('Events')) {
            // `listeners` intentionally remains an array-of-callbacks facade for legacy packs.
            this.listeners = Object.create(null);
            this._entries = Object.create(null);
            this.logger = logger;
            this._emitting = 0;
        }
        on(event, callback, options = {}) {
            if (typeof event !== 'string' || !event.trim()) throw new TypeError('Event name must be a non-empty string');
            if (typeof callback !== 'function') throw new TypeError(`Listener for ${event} must be a function`);
            let entries = this._entries[event] || (this._entries[event] = []);
            // Reconcile callbacks removed by legacy code that edits `listeners[event]` directly.
            if (this.listeners[event]) {
                const exposed = new Set(this.listeners[event]);
                entries = this._entries[event] = entries.filter(item => item.active && exposed.has(item.callback));
            }
            const entry = { callback, once: !!options.once, priority: Number(options.priority) || 0, active: true };
            entries.push(entry);
            entries.sort((a, b) => b.priority - a.priority);
            this.listeners[event] = entries.map(item => item.callback);
            return () => this.off(event, callback, entry);
        }
        once(event, callback, options = {}) { return this.on(event, callback, { ...options, once: true }); }
        off(event, callback, exactEntry = null) {
            const list = this._entries[event];
            if (!list) return false;
            let removed = false;
            this._entries[event] = list.filter(entry => {
                const match = exactEntry ? entry === exactEntry : entry.callback === callback;
                if (match) { entry.active = false; removed = true; return false; }
                return entry.active;
            });
            if (!this._entries[event].length) { delete this._entries[event]; delete this.listeners[event]; }
            else this.listeners[event] = this._entries[event].map(entry => entry.callback);
            return removed;
        }
        emit(event, payload) {
            const list = this._entries[event];
            if (!list || !list.length) return 0;
            const snapshot = list.slice();
            this._emitting++;
            let called = 0;
            try {
                for (const entry of snapshot) {
                    if (!entry.active || !(this.listeners[event] || []).includes(entry.callback)) continue;
                    if (entry.once) this.off(event, entry.callback, entry);
                    try { entry.callback(payload, event); called++; }
                    catch (error) { this.logger.error(`Listener failed for "${event}"`, error); }
                }
            } finally { this._emitting--; }
            return called;
        }
        clear(event) {
            if (event) {
                (this._entries[event] || []).forEach(entry => { entry.active = false; });
                delete this._entries[event];
                delete this.listeners[event];
                return;
            }
            Object.keys(this.listeners).forEach(key => this.clear(key));
        }
        listenerCount(event) { return (this._entries[event] || []).filter(entry => entry.active && (this.listeners[event] || []).includes(entry.callback)).length; }
    }

    class StateStore {
        constructor(initial = {}, logger = new Logger('State')) {
            this._state = isObject(initial) ? { ...initial } : {};
            this._listeners = new Set();
            this._version = 0;
            this.logger = logger;
        }
        get state() { return this._state; }
        get version() { return this._version; }
        get(path, fallback) {
            if (!path) return this._state;
            const parts = Array.isArray(path) ? path : String(path).split('.');
            let value = this._state;
            for (const part of parts) {
                if (value == null || !own(value, part)) return fallback;
                value = value[part];
            }
            return value === undefined ? fallback : value;
        }
        set(path, value) {
            const parts = Array.isArray(path) ? path : String(path).split('.');
            if (!parts.length || parts.some(part => !String(part).length)) throw new TypeError('State path is invalid');
            const next = { ...this._state };
            let cursor = next;
            let source = this._state;
            for (let i = 0; i < parts.length - 1; i++) {
                const key = parts[i];
                const nextKey = parts[i + 1];
                const sourceChild = source && source[key] && typeof source[key] === 'object'
                    ? source[key]
                    : (/^\d+$/.test(String(nextKey)) ? [] : {});
                cursor[key] = Array.isArray(sourceChild) ? sourceChild.slice() : { ...sourceChild };
                cursor = cursor[key]; source = sourceChild;
            }
            cursor[parts[parts.length - 1]] = value;
            this._commit(next, { type: 'set', path: parts, value });
            return value;
        }
        update(path, updater) {
            if (typeof updater !== 'function') throw new TypeError('State updater must be a function');
            return this.set(path, updater(this.get(path)));
        }
        transaction(mutator) {
            if (typeof mutator !== 'function') throw new TypeError('Transaction must be a function');
            const draft = structuredCloneSafe(this._state);
            mutator(draft);
            this._commit(draft, { type: 'transaction' });
            return this._state;
        }
        subscribe(callback, options = {}) {
            if (typeof callback !== 'function') throw new TypeError('Subscriber must be a function');
            this._listeners.add(callback);
            if (options.immediate) callback(this._state, { type: 'subscribe', version: this._version });
            return () => this._listeners.delete(callback);
        }
        _commit(next, meta) {
            this._state = next; this._version++;
            for (const listener of Array.from(this._listeners)) {
                try { listener(this._state, { ...meta, version: this._version }); }
                catch (error) { this.logger.error('State subscriber failed', error); }
            }
        }
    }

    function structuredCloneSafe(value) {
        if (typeof structuredClone === 'function') {
            try { return structuredClone(value); } catch (_) {}
        }
        return JSON.parse(JSON.stringify(value));
    }

    class GameClock {
        constructor(options = {}) {
            this.fixedStepMs = Math.max(1, Number(options.fixedStepMs) || 1000 / 60);
            this.maxFrameMs = Math.max(this.fixedStepMs, Number(options.maxFrameMs) || 250);
            this.maxSubSteps = Math.max(1, Math.floor(Number(options.maxSubSteps) || 5));
            this.accumulator = 0;
            this.elapsedMs = 0;
            this.frame = 0;
            this.paused = false;
        }
        reset() { this.accumulator = 0; this.elapsedMs = 0; this.frame = 0; }
        pause() { this.paused = true; this.accumulator = 0; }
        resume() { this.paused = false; this.accumulator = 0; }
        advance(deltaMs, step) {
            if (this.paused) return { steps: 0, alpha: 0, deltaMs: 0 };
            const delta = Math.min(Math.max(0, Number(deltaMs) || 0), this.maxFrameMs);
            this.accumulator += delta;
            let steps = 0;
            while (this.accumulator >= this.fixedStepMs && steps < this.maxSubSteps) {
                this.elapsedMs += this.fixedStepMs;
                this.frame++;
                if (typeof step === 'function') step(this.fixedStepMs / 1000, this);
                this.accumulator -= this.fixedStepMs;
                steps++;
            }
            if (steps === this.maxSubSteps && this.accumulator >= this.fixedStepMs) this.accumulator = 0;
            return { steps, alpha: this.accumulator / this.fixedStepMs, deltaMs: delta };
        }
    }

    class InputManager {
        constructor() {
            this.keys = new Set();
            this.actions = new Map();
            this._boundDown = e => { this.keys.add(e.code); this._dispatch('down', e); };
            this._boundUp = e => { this.keys.delete(e.code); this._dispatch('up', e); };
            this._boundBlur = () => this.keys.clear();
            if (typeof global.addEventListener === 'function') {
                global.addEventListener('keydown', this._boundDown);
                global.addEventListener('keyup', this._boundUp);
                global.addEventListener('blur', this._boundBlur);
            }
        }
        isDown(code) { return this.keys.has(code); }
        bind(action, codes) { this.actions.set(action, new Set(Array.isArray(codes) ? codes : [codes])); }
        isActionDown(action) { const codes = this.actions.get(action); return !!codes && Array.from(codes).some(code => this.keys.has(code)); }
        _dispatch(type, event) { /* reserved for input plugins */ }
        dispose() {
            if (typeof global.removeEventListener === 'function') {
                global.removeEventListener('keydown', this._boundDown);
                global.removeEventListener('keyup', this._boundUp);
                global.removeEventListener('blur', this._boundBlur);
            }
            this.keys.clear(); this.actions.clear();
        }
    }

    class AssetManager {
        constructor(logger) { this.logger = logger; this.images = new Map(); this.audio = new Map(); }
        image(src) {
            if (!src) return Promise.reject(new Error('Asset path is empty'));
            if (this.images.has(src)) return this.images.get(src);
            const promise = new Promise((resolve, reject) => {
                if (typeof Image === 'undefined') return reject(new Error('Image API unavailable'));
                const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`Failed to load image: ${src}`)); img.src = src;
            });
            this.images.set(src, promise); return promise;
        }
        audio(src, options = {}) {
            if (!src) return null;
            if (this.audio.has(src)) return this.audio.get(src);
            if (typeof Audio === 'undefined') return null;
            const audio = new Audio(src); audio.preload = options.preload || 'auto';
            this.audio.set(src, audio); return audio;
        }
    }

    class PluginManager {
        constructor(engine) {
            this.engine = engine;
            this.definitions = new Map();
            this.instances = new Map();
            this.scriptPromises = new Map();
            this.systems = { update: [], render: [] };
            this.services = new Map();
            this.features = new Map();
            this.status = 'idle';
        }
        register(definition) {
            if (!definition || typeof definition !== 'object') throw new TypeError('Plugin definition is required');
            const id = String(definition.id || '').trim();
            if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) throw new TypeError(`Invalid plugin id: ${id}`);
            if (this.definitions.has(id)) throw new Error(`Plugin already registered: ${id}`);
            if (typeof definition.setup !== 'function') throw new TypeError(`Plugin ${id} must provide setup(api)`);
            const minEngineVersion = definition.minEngineVersion || '2.0.0';
            if (!versionAtLeast(ENGINE_VERSION, minEngineVersion)) throw new Error(`Plugin ${id} requires engine ${minEngineVersion}; current ${ENGINE_VERSION}`);
            this.definitions.set(id, { ...definition, id, dependencies: Array.isArray(definition.dependencies) ? definition.dependencies.slice() : [], minEngineVersion });
            return id;
        }
        async loadScript(src) {
            if (this.scriptPromises.has(src)) return this.scriptPromises.get(src);
            const promise = new Promise((resolve, reject) => {
                if (typeof document === 'undefined') return reject(new Error(`Cannot load script without document: ${src}`));
                const script = document.createElement('script');
                script.src = src; script.async = false;
                script.onload = () => resolve(src);
                script.onerror = () => reject(new Error(`Failed to load plugin script: ${src}`));
                document.head.appendChild(script);
            });
            this.scriptPromises.set(src, promise);
            return promise;
        }
        async loadManifest(url) {
            this.status = 'loading-manifest';
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Plugin manifest request failed (${response.status})`);
            const manifest = await response.json();
            if (!manifest || manifest.engine !== 'LacosteEngine' || !Array.isArray(manifest.scripts)) throw new Error('Invalid plugin manifest format');
            for (const script of manifest.scripts) {
                if (typeof script !== 'string' || !/^plugins\/[a-zA-Z0-9._/-]+\.js$/.test(script) || script.includes('..')) throw new Error(`Invalid plugin script path: ${script}`);
                await this.loadScript(script);
            }
            this.status = 'manifest-loaded';
            return manifest;
        }
        _resolveOrder() {
            const ordered = [], visiting = new Set(), visited = new Set();
            const visit = id => {
                if (visited.has(id)) return;
                if (visiting.has(id)) throw new Error(`Plugin dependency cycle detected at ${id}`);
                const plugin = this.definitions.get(id);
                if (!plugin) throw new Error(`Plugin dependency not registered: ${id}`);
                visiting.add(id);
                for (const dep of plugin.dependencies) {
                    if (!this.definitions.has(dep)) throw new Error(`Plugin ${id} requires missing dependency ${dep}`);
                    visit(dep);
                }
                visiting.delete(id); visited.add(id); ordered.push(plugin);
            };
            for (const id of this.definitions.keys()) visit(id);
            return ordered;
        }
        _api(plugin) {
            const manager = this;
            const cleanups = [];
            const registerSystem = system => {
                if (!system || typeof system !== 'object') throw new TypeError('System descriptor is required');
                const id = `${plugin.id}:${system.id || `system-${Date.now()}`}`;
                const priority = Number(system.priority) || 0;
                if (typeof system.update === 'function') manager.systems.update.push({ id, priority, fn: system.update });
                if (typeof system.render === 'function') manager.systems.render.push({ id, priority, fn: system.render });
                const cleanup = () => {
                    manager.systems.update = manager.systems.update.filter(item => item.id !== id);
                    manager.systems.render = manager.systems.render.filter(item => item.id !== id);
                };
                cleanups.push(cleanup); return cleanup;
            };
            const registerService = (name, service) => {
                if (manager.services.has(name)) throw new Error(`Service already registered: ${name}`);
                manager.services.set(name, service);
                const cleanup = () => { if (manager.services.get(name) === service) manager.services.delete(name); };
                cleanups.push(cleanup); return cleanup;
            };
            const storagePrefix = `lacoste.plugin.${plugin.id}.`;
            const storage = {
                get(key, fallback = null) {
                    try { const value = localStorage.getItem(storagePrefix + key); return value === null ? fallback : value; }
                    catch (_) { return fallback; }
                },
                getJSON(key, fallback = null) {
                    try { const value = localStorage.getItem(storagePrefix + key); return value === null ? fallback : JSON.parse(value); }
                    catch (_) { return fallback; }
                },
                set(key, value) { try { localStorage.setItem(storagePrefix + key, String(value)); return true; } catch (_) { return false; } },
                setJSON(key, value) { try { localStorage.setItem(storagePrefix + key, JSON.stringify(value)); return true; } catch (_) { return false; } },
                remove(key) { try { localStorage.removeItem(storagePrefix + key); return true; } catch (_) { return false; } }
            };
            const api = {
                engine: manager.engine,
                plugin: Object.freeze({ id: plugin.id, version: plugin.version || '0.0.0', metadata: plugin.metadata || {} }),
                logger: manager.engine.logger.child(plugin.id),
                events: manager.engine.events,
                state: manager.engine.state,
                clock: manager.engine.clock,
                input: manager.engine.input,
                assets: manager.engine.assets,
                config: manager.engine.config,
                storage,
                registerSystem,
                registerService,
                getService: name => manager.services.get(name),
                loadScript: src => manager.loadScript(src),
                bootGame: () => {
                    if (typeof global.__bootGame !== 'function') throw new Error('Legacy game boot function is not available');
                    global.__bootGame();
                },
                onCleanup: fn => { if (typeof fn === 'function') cleanups.push(fn); },
                emit: (event, payload) => manager.engine.events.emit(event, payload),
                on: (event, fn, options) => { const off = manager.engine.events.on(event, fn, options); cleanups.push(off); return off; },
                registerFeature: (name, descriptor) => {
                    const key = `${plugin.id}.${name}`;
                    if (manager.features.has(key)) throw new Error(`Feature already registered: ${key}`);
                    manager.features.set(key, descriptor);
                    const cleanup = () => manager.features.delete(key); cleanups.push(cleanup); return cleanup;
                },
                registerUI: (component, metadata) => { const off = manager.engine.registerUI(plugin.id, component, metadata); cleanups.push(off); return off; },
                ui: { register: (component, metadata) => { const off = manager.engine.registerUI(plugin.id, component, metadata); cleanups.push(off); return off; } }
            };
            return { api, cleanups };
        }
        async installAll() {
            this.status = 'installing';
            const order = this._resolveOrder();
            for (const definition of order) {
                const { api, cleanups } = this._api(definition);
                try {
                    const lifecycle = await definition.setup(api) || {};
                    this.instances.set(definition.id, { definition, lifecycle, cleanups, status: 'installed' });
                    this.engine.events.emit('plugin:installed', { id: definition.id, version: definition.version || '0.0.0' });
                    this.engine.logger.info(`Plugin installed: ${definition.id}`);
                } catch (error) {
                    cleanups.reverse().forEach(cleanup => { try { cleanup(); } catch (_) {} });
                    this.status = 'failed';
                    this.engine.events.emit('plugin:error', { id: definition.id, phase: 'install', error });
                    throw new Error(`Plugin install failed (${definition.id}): ${error.message}`, { cause: error });
                }
            }
            this.status = 'installed';
            return order.map(plugin => plugin.id);
        }
        async startAll() {
            this.status = 'starting';
            for (const [id, instance] of this.instances) {
                if (instance.definition.enabled === false) { instance.status = 'disabled'; continue; }
                try {
                    if (typeof instance.lifecycle.start === 'function') await instance.lifecycle.start();
                    instance.status = 'running';
                    this.engine.events.emit('plugin:started', { id });
                } catch (error) {
                    this.status = 'failed';
                    this.engine.events.emit('plugin:error', { id, phase: 'start', error });
                    throw new Error(`Plugin start failed (${id}): ${error.message}`, { cause: error });
                }
            }
            this.status = 'running';
        }
        async setEnabled(id, enabled) {
            const instance = this.instances.get(id);
            if (!instance) throw new Error(`Plugin is not installed: ${id}`);
            const desired = !!enabled;
            if (desired && instance.status === 'running') return;
            if (!desired && instance.status === 'disabled') return;
            const dependents = Array.from(this.instances.values()).filter(item => item.definition.dependencies.includes(id) && item.status === 'running');
            if (!desired && dependents.length) throw new Error(`Cannot disable ${id}; active dependent plugin(s): ${dependents.map(item => item.definition.id).join(', ')}`);
            if (desired) {
                for (const dependency of instance.definition.dependencies) {
                    const depInstance = this.instances.get(dependency);
                    if (!depInstance || depInstance.status !== 'running') throw new Error(`Cannot enable ${id}; dependency ${dependency} is not running`);
                }
            }
            if (!desired) {
                if (typeof instance.lifecycle.stop === 'function') await instance.lifecycle.stop();
                instance.cleanups.reverse().forEach(cleanup => { try { cleanup(); } catch (_) {} });
                instance.cleanups = [];
                this.systems.update = this.systems.update.filter(system => !system.id.startsWith(`${id}:`));
                this.systems.render = this.systems.render.filter(system => !system.id.startsWith(`${id}:`));
                instance.status = 'disabled';
                this.engine.events.emit('plugin:disabled', { id });
                return;
            }
            const { api, cleanups } = this._api(instance.definition);
            try {
                instance.lifecycle = await instance.definition.setup(api) || {};
                instance.cleanups = cleanups;
                if (typeof instance.lifecycle.start === 'function') await instance.lifecycle.start();
                instance.status = 'running';
                this.engine.events.emit('plugin:enabled', { id });
            } catch (error) {
                cleanups.reverse().forEach(cleanup => { try { cleanup(); } catch (_) {} });
                instance.status = 'failed';
                throw new Error(`Plugin enable failed (${id}): ${error.message}`, { cause: error });
            }
        }
        update(dt, context) {
            for (const system of this.systems.update.slice().sort((a, b) => b.priority - a.priority)) {
                try { system.fn(dt, context, this.engine); }
                catch (error) { this.engine.logger.error(`Update system failed: ${system.id}`, error); this.engine.events.emit('plugin:error', { id: system.id.split(':')[0], phase: 'update', error }); }
            }
        }
        render(ctx, scene) {
            for (const system of this.systems.render.slice().sort((a, b) => b.priority - a.priority)) {
                try { system.fn(ctx, scene, this.engine); }
                catch (error) { this.engine.logger.error(`Render system failed: ${system.id}`, error); this.engine.events.emit('plugin:error', { id: system.id.split(':')[0], phase: 'render', error }); }
            }
        }
        async disposeAll() {
            const entries = Array.from(this.instances.entries()).reverse();
            for (const [id, instance] of entries) {
                try { if (typeof instance.lifecycle.dispose === 'function') await instance.lifecycle.dispose(); }
                catch (error) { this.engine.logger.warn(`Plugin dispose failed: ${id}`, error); }
                instance.cleanups.reverse().forEach(cleanup => { try { cleanup(); } catch (_) {} });
                instance.status = 'disposed';
            }
            this.instances.clear(); this.systems.update = []; this.systems.render = []; this.services.clear(); this.features.clear(); this.status = 'disposed';
        }
    }

    function versionAtLeast(current, minimum) {
        const parse = value => String(value).replace(/^[v^~]/, '').split('.').map(part => parseInt(part, 10) || 0);
        const a = parse(current), b = parse(minimum);
        for (let i = 0; i < 3; i++) { if (a[i] > b[i]) return true; if (a[i] < b[i]) return false; }
        return true;
    }

    class EngineRuntime {
        constructor(options = {}) {
            this.version = ENGINE_VERSION;
            this.logger = new Logger('LacosteEngine');
            this.events = new EventBus(this.logger.child('Events'));
            this.state = new StateStore(options.initialState || {}, this.logger.child('State'));
            this.clock = new GameClock(options.clock || {});
            this.input = new InputManager();
            this.assets = new AssetManager(this.logger.child('Assets'));
            this.plugins = new PluginManager(this);
            this._uiComponents = new Map();
            this.status = 'created';
            this.gameState = 'boot';
            this._lastState = null;
            this.events.on('start', payload => this.events.emit('game:start', payload));
            this.events.on('gameover', payload => this.events.emit('game:over', payload));
        }
        registerUI(pluginId, component, metadata = {}) {
            if (typeof component !== 'function') throw new TypeError('UI component must be a function');
            const id = `${pluginId}.${metadata.id || component.name || `ui-${this._uiComponents.size + 1}`}`;
            if (this._uiComponents.has(id)) throw new Error(`UI component already registered: ${id}`);
            this._uiComponents.set(id, component);
            return () => this._uiComponents.delete(id);
        }
        getUIComponents() { return Array.from(this._uiComponents.values()); }
        get config() { return global.GAME_CONFIG || {}; }
        registerPlugin(definition) { return this.plugins.register(definition); }
        async boot(manifestUrl = 'plugins/manifest.json') {
            if (this.status === 'running') return this;
            this.status = 'booting';
            try {
                await this.plugins.loadManifest(manifestUrl);
                await this.plugins.installAll();
                await this.plugins.startAll();
                this.status = 'running';
                this.events.emit('engine:ready', { version: this.version, plugins: Array.from(this.plugins.instances.keys()) });
                this.logger.info(`Engine ready (${this.plugins.instances.size} plugins)`);
                return this;
            } catch (error) {
                this.status = 'failed';
                this.logger.error('Engine boot failed', error);
                throw error;
            }
        }
        step(deltaMs, context = {}) {
            if (this.gameState !== 'playing') return { steps: 0, alpha: 0, deltaMs: 0 };
            const result = this.clock.advance(deltaMs, (dt, clock) => {
                const frameContext = { ...context, dt, clock, gameState: this.gameState };
                this.plugins.update(dt, frameContext);
                this.events.emit('engine:update', frameContext);
            });
            return result;
        }
        render(ctx, scene = {}) {
            if (this.gameState !== 'playing') return;
            this.plugins.render(ctx, scene);
            this.events.emit('engine:render', { ctx, scene, gameState: this.gameState });
        }
        setGameState(next) {
            if (next === this.gameState) return;
            const previous = this.gameState;
            this.gameState = next;
            if (next === 'paused' || next === 'menu' || next === 'gameover') this.clock.pause();
            else if (next === 'playing') this.clock.resume();
            this.events.emit('game:state', { previous, current: next });
            if (next === 'paused') this.events.emit('game:pause', { previous });
            if (previous === 'paused' && next === 'playing') this.events.emit('game:resume', { previous });
        }
        async shutdown() {
            await this.plugins.disposeAll(); this.input.dispose(); this.events.clear(); this._uiComponents.clear(); this.status = 'stopped';
        }
    }

    const engine = global.LacosteEngine instanceof EngineRuntime ? global.LacosteEngine : new EngineRuntime();
    global.LacosteEngine = engine;
    // Compatibility event facade: old feature packs and native plugins share one event bus.
    global.GameEvents = engine.events;
    global.LacosteEngineVersion = ENGINE_VERSION;
})(window);
