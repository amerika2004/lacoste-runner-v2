const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function createEngine() {
    const sandbox = {
        console,
        setTimeout,
        clearTimeout,
        structuredClone,
        window: {},
        localStorage: {
            _data: new Map(),
            getItem(key) { return this._data.has(key) ? this._data.get(key) : null; },
            setItem(key, value) { this._data.set(key, String(value)); },
            removeItem(key) { this._data.delete(key); }
        }
    };
    vm.createContext(sandbox);
    const source = fs.readFileSync(path.join(__dirname, '../engine/core.js'), 'utf8');
    vm.runInContext(source, sandbox, { filename: 'engine/core.js' });
    return sandbox.window.LacosteEngine;
}

test('EventBus supports priority, once, unsubscribe and listener isolation', () => {
    const engine = createEngine();
    const bus = engine.events;
    const calls = [];
    bus.on('test:event', () => calls.push('low'), { priority: 1 });
    bus.once('test:event', () => calls.push('high'), { priority: 5 });
    const off = bus.on('test:event', () => { throw new Error('isolated'); });
    bus.emit('test:event');
    bus.emit('test:event');
    off();
    assert.deepEqual(calls, ['high', 'low', 'low']);
    assert.equal(bus.listenerCount('test:event'), 1);
    const legacy = () => calls.push('legacy');
    bus.on('legacy:event', legacy);
    // Old packs mutate GameEvents.listeners directly; the compatibility facade honors it.
    bus.listeners['legacy:event'] = bus.listeners['legacy:event'].filter(callback => callback !== legacy);
    bus.emit('legacy:event');
    assert.equal(calls.includes('legacy'), false);
    assert.equal(bus.listenerCount('legacy:event'), 0);
    const fresh = () => calls.push('fresh');
    bus.on('legacy:event', fresh);
    bus.emit('legacy:event');
    assert.equal(calls.filter(value => value === 'legacy').length, 0);
    assert.equal(calls.filter(value => value === 'fresh').length, 1);
});

test('StateStore supports nested immutable updates and transactions', () => {
    const engine = createEngine();
    const store = engine.state;
    store.set('player.coins', 20);
    assert.equal(store.get('player.coins'), 20);
    store.transaction(draft => {
        draft.player.coins += 30;
        draft.player.level = 2;
    });
    assert.equal(store.get('player.coins'), 50);
    assert.equal(store.get('player.level'), 2);
    store.set('items.0.count', 4);
    assert.equal(store.get('items.0.count'), 4);
    assert.equal(Array.isArray(store.get('items')), true);
    assert.equal(store.version, 3);
});

test('GameClock caps catch-up and freezes while paused', () => {
    const engine = createEngine();
    const clock = engine.clock;
    let steps = 0;
    const result = clock.advance(1000, () => steps++);
    assert.equal(result.steps, 5);
    assert.equal(steps, 5);
    clock.pause();
    const paused = clock.advance(100, () => steps++);
    assert.equal(paused.steps, 0);
    assert.equal(steps, 5);
    clock.resume();
    clock.advance(17, () => steps++);
    assert.equal(steps, 6);
});

test('Plugin manager resolves dependencies, starts in order and runs systems', async () => {
    const engine = createEngine();
    const order = [];
    let updates = 0;
    engine.registerPlugin({
        id: 'test.alpha', version: '1.0.0', minEngineVersion: '2.0.0',
        setup(api) { order.push('setup-alpha'); api.events.emit('test:setup', { id: 'alpha' }); return { start() { order.push('start-alpha'); } }; }
    });
    engine.registerPlugin({
        id: 'test.beta', version: '1.0.0', minEngineVersion: '2.0.0', dependencies: ['test.alpha'],
        setup(api) {
            order.push('setup-beta');
            api.registerSystem({ id: 'counter', update() { updates++; } });
            return { start() { order.push('start-beta'); } };
        }
    });
    await engine.plugins.installAll();
    await engine.plugins.startAll();
    assert.deepEqual(order, ['setup-alpha', 'setup-beta', 'start-alpha', 'start-beta']);
    engine.setGameState('playing');
    engine.step(34, { distance: 100 });
    assert.equal(updates, 2);
    await engine.plugins.disposeAll();
    assert.equal(engine.plugins.instances.size, 0);
});

test('Plugin manager rejects missing dependencies and cycles', async () => {
    const engine = createEngine();
    engine.registerPlugin({ id: 'test.a', setup() { return {}; }, dependencies: ['test.missing'] });
    await assert.rejects(engine.plugins.installAll(), /missing dependency/);

    const second = createEngine();
    second.registerPlugin({ id: 'test.a', setup() { return {}; }, dependencies: ['test.b'] });
    second.registerPlugin({ id: 'test.b', setup() { return {}; }, dependencies: ['test.a'] });
    await assert.rejects(second.plugins.installAll(), /cycle detected/);
});


test('Plugin can be disabled and re-enabled without engine edits', async () => {
    const engine = createEngine();
    let starts = 0, stops = 0, updates = 0, setups = 0;
    engine.registerPlugin({
        id: 'test.toggle', version: '1.0.0', minEngineVersion: '2.0.0',
        setup(api) {
            setups++;
            api.registerSystem({ id: 'toggle-system', update() { updates++; } });
            return { start() { starts++; }, stop() { stops++; } };
        }
    });
    await engine.plugins.installAll();
    await engine.plugins.startAll();
    await engine.plugins.setEnabled('test.toggle', false);
    engine.setGameState('playing');
    engine.step(17, {});
    assert.equal(updates, 0);
    await engine.plugins.setEnabled('test.toggle', true);
    engine.step(17, {});
    assert.equal(updates, 1);
    assert.equal(starts, 2);
    assert.equal(stops, 1);
    assert.equal(setups, 2);
});
