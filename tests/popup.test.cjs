const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function harness({ stored = {}, loadError = false, saveError = false } = {}) {
  const elements = {};
  const writes = [];
  const runtime = { lastError: loadError ? { message: 'load failed' } : null };
  for (const id of ['enabled', 'delay', 'minChars', 'status']) {
    elements[id] = {
      type: id === 'enabled' ? 'checkbox' : 'number', disabled: true,
      valid: true, checkValidity() { return this.valid; }, reportValidity() { this.reported = true; },
      addEventListener(_, callback) { this.change = callback; },
    };
  }
  const context = vm.createContext({
    document: { getElementById: (id) => elements[id] },
    chrome: { runtime, storage: { sync: {
      get: (defaults, callback) => callback({ ...defaults, ...stored }),
      set: (update, callback) => {
        writes.push(JSON.parse(JSON.stringify(update)));
        runtime.lastError = saveError ? { message: 'save failed' } : null;
        callback();
      },
    } } },
  });
  for (const file of ['../shared.js', '../popup.js']) {
    vm.runInContext(fs.readFileSync(require.resolve(file), 'utf8'), context);
  }
  return { elements, writes };
}

test('popup shows normalized saved settings and enables fields', () => {
  const { elements } = harness({ stored: { enabled: false, delay: 9999, minChars: NaN } });
  assert.equal(elements.enabled.checked, false);
  assert.equal(elements.delay.value, 2000);
  assert.equal(elements.minChars.value, 2);
  assert.equal(elements.delay.disabled, false);
});

test('invalid numeric input reports a correction and is never stored', () => {
  const { elements, writes } = harness();
  elements.delay.valid = false; elements.delay.valueAsNumber = NaN; elements.delay.change();
  assert.equal(writes.length, 0);
  assert.equal(elements.delay.reported, true);
  assert.match(elements.status.textContent, /0 to 2000/);
});

test('valid numeric input saves a number and confirms success', () => {
  const { elements, writes } = harness();
  elements.delay.valueAsNumber = 350; elements.delay.change();
  assert.deepEqual(writes, [{ delay: 350 }]);
  assert.equal(elements.status.textContent, 'Saved.');
});

test('disabling saves a boolean', () => {
  const { elements, writes } = harness();
  elements.enabled.checked = false; elements.enabled.change();
  assert.deepEqual(writes, [{ enabled: false }]);
});

test('storage read failures leave fields disabled with recovery guidance', () => {
  const { elements } = harness({ loadError: true });
  assert.equal(elements.delay.disabled, true);
  assert.match(elements.status.textContent, /Close and reopen/);
});

test('storage write failures remain visible', () => {
  const { elements } = harness({ saveError: true });
  elements.minChars.valueAsNumber = 4; elements.minChars.change();
  assert.match(elements.status.textContent, /Could not save/);
});
