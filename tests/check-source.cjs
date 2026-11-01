const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const ignore = new Set(['node_modules']);
const files = [];
function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ignore.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
    }
}
walk(root);
let failed = false;
for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        failed = true;
        console.error(`FAIL ${path.relative(root, file)}\n${result.stderr}`);
    }
}
const manifestPath = path.join(root, 'plugins/manifest.json');
try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const src of manifest.scripts) {
        if (!fs.existsSync(path.join(root, src))) {
            failed = true;
            console.error(`FAIL missing plugin script: ${src}`);
        }
    }
} catch (error) {
    failed = true;
    console.error(`FAIL plugin manifest: ${error.message}`);
}
if (failed) process.exit(1);
console.log(`Source check passed: ${files.length} JavaScript files, plugin manifest valid.`);
