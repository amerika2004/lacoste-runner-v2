const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('Engine boots current legacy gameplay through plugin adapters', async () => {
    const data = new Map();
    const sandbox = {
        console, Math, Date, Promise, Set, Map, WeakMap, Array, Object, String, Number, Boolean,
        RegExp, Error, TypeError, JSON, structuredClone,
        localStorage: {
            getItem: key => data.has(key) ? data.get(key) : null,
            setItem: (key, value) => data.set(key, String(value)),
            removeItem: key => data.delete(key)
        },
        addEventListener() {},
        removeEventListener() {},
        matchMedia() { return { matches: false }; },
        navigator: { vibrate() {} },
        fetch: async () => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, 'plugins/manifest.json'), 'utf8')) })
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    const context = vm.createContext(sandbox);
    sandbox.document = {
        head: {
            appendChild(script) {
                try {
                    const source = fs.readFileSync(path.join(root, script.src), 'utf8');
                    vm.runInContext(source, context, { filename: script.src });
                    script.onload?.();
                } catch (error) {
                    script.onerror?.();
                    throw error;
                }
            }
        },
        createElement() { return {}; },
        body: { appendChild() {} }
    };
    vm.runInContext(fs.readFileSync(path.join(root, 'engine/core.js'), 'utf8'), context, { filename: 'engine/core.js' });
    vm.runInContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), context, { filename: 'config.js' });
    let booted = false;
    sandbox.__bootGame = () => { booted = true; };

    await sandbox.LacosteEngine.boot('plugins/manifest.json');
    assert.equal(booted, true);
    assert.equal(sandbox.LacosteEngine.status, 'running');
    assert.equal(sandbox.LacosteEngine.plugins.instances.size, 7);
    assert.ok(sandbox.LacosteEngine.plugins.instances.has('native.player-core'));
    assert.ok(sandbox.LacosteEngine.plugins.instances.has('native.world-core'));
    assert.ok(sandbox.LacosteEngine.plugins.services.has('player.core'));
    assert.ok(sandbox.LacosteEngine.plugins.services.has('world.core'));
    assert.ok(sandbox.Pack1State);
    assert.ok(sandbox.Pack2State);
    assert.ok(sandbox.Pack3State);
    assert.ok(sandbox.Pack4State);
    assert.ok(Array.isArray(sandbox.PackUIs) && sandbox.PackUIs.length >= 4);
});
