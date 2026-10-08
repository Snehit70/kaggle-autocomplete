const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

test('every extension entry point exists in the unpacked directory', () => {
  const references = [manifest.action.default_popup, ...manifest.content_scripts.flatMap(script => script.js)];
  for (const reference of references) {
    const absolute = path.resolve(root, reference);
    assert.ok(absolute.startsWith(root + path.sep), reference);
    assert.ok(fs.statSync(absolute).isFile(), reference);
  }
});

test('extension and development package versions agree', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, manifest.version);
});
