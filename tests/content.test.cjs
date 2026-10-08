const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

// Controlled selection/focus/timers exercise the real script without changing
// a user's notebook. These checks do not replace a browser smoke test.
function harness({ code = true, ready = true, text = 'print', visible = false, stored = {}, deferred = false } = {}) {
  const listeners = new Map();
  const timers = new Map();
  const sent = [];
  let changed;
  let nextTimer = 0;
  let loadSettings;
  class Element {
    isConnected = true;
    nodeType = 1;
    classList = { contains: (name) => name === 'jp-mod-completer-enabled' && ready };
    matches() { return true; }
    querySelectorAll() { return [line]; }
    closest(selector) {
      if (selector === '.jp-Notebook .jp-CodeCell') return code ? this : null;
      if (selector === '.jp-CodeMirrorEditor') return this;
      if (selector === '.cm-line') return line;
      return null;
    }
    contains(node) { return node === this || node === line || node === textNode; }
    dispatchEvent(event) { sent.push(event); }
  }
  const target = new Element();
  const line = new Element();
  const textNode = { nodeType: 3, parentElement: line };
  const selection = { isCollapsed: true, rangeCount: 1, anchorNode: textNode, anchorOffset: text.length };
  const document = {
    activeElement: target,
    addEventListener: (name, fn) => listeners.set(name, fn),
    querySelectorAll: () => visible ? [{ classList: { contains: () => false }, getClientRects: () => [1] }] : [],
    createRange: () => ({ setStart() {}, setEnd() {}, toString: () => text.slice(0, selection.anchorOffset) }),
  };
  const context = vm.createContext({
    chrome: { storage: {
      sync: { get: (defaults, cb) => {
        loadSettings = () => cb({ ...defaults, ...stored });
        if (!deferred) loadSettings();
      } },
      onChanged: { addListener: (fn) => { changed = fn; } },
    } },
    document,
    window: { getSelection: () => selection, addEventListener: (name, fn) => listeners.set(name, fn) },
    HTMLElement: Element,
    Node: { ELEMENT_NODE: 1 },
    KeyboardEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
  });
  for (const file of ['../shared.js', '../content.js']) {
    vm.runInContext(fs.readFileSync(require.resolve(file), 'utf8'), context);
  }
  return {
    sent, selection, document, target,
    fire(name, extra = {}) { listeners.get(name)?.({ target, key: 't', isTrusted: true, ...extra }); },
    change(changes, area = 'sync') { changed(changes, area); },
    loadSettings() { loadSettings(); },
    flush() { const callbacks = [...timers.values()]; timers.clear(); for (const fn of callbacks) fn(); },
  };
}

test('eligible code typing requests completion once after a burst', () => {
  const h = harness(); h.fire('keyup'); h.fire('keyup'); h.flush();
  assert.deepEqual(h.sent.map(e => e.type), ['keydown', 'keyup']);
  assert.ok(h.sent.every(e => e.key === 'Tab'));
});

for (const [name, options] of [
  ['Markdown cell', { code: false }],
  ['completion provider not ready', { ready: false }],
  ['existing completion menu', { visible: true }],
  ['short identifier', { text: 'p' }],
  ['Python comment', { text: '# print' }],
  ['number prefix', { text: '1e' }],
  ['string', { text: 's = "print' }],
  ['escaped quote followed by a comment', { text: "s = 'it\\'s' # print" }],
]) {
  test(`does not dispatch Tab for ${name}`, () => {
    const h = harness(options); h.fire('keyup'); h.flush(); assert.equal(h.sent.length, 0);
  });
}

for (const name of ['keydown', 'pointerdown', 'focusout', 'blur']) {
  test(`${name} cancels a pending request`, () => {
    const h = harness(); h.fire('keyup'); h.fire(name, { key: 'ArrowLeft' }); h.flush();
    assert.equal(h.sent.length, 0);
  });
}

test('disabling before the delay expires cancels completion', () => {
  const h = harness(); h.fire('keyup'); h.change({ enabled: { newValue: false } }); h.flush();
  assert.equal(h.sent.length, 0);
});

test('cursor changes cancel completion even without a key event', () => {
  const h = harness(); h.fire('keyup'); h.selection.anchorOffset = 2;
  h.fire('selectionchange'); h.flush(); assert.equal(h.sent.length, 0);
});

test('focus and connection are checked again when the timer fires', () => {
  const h = harness(); h.fire('keyup'); h.document.activeElement = null; h.flush();
  assert.equal(h.sent.length, 0);
  h.document.activeElement = h.target; h.fire('keyup'); h.target.isConnected = false; h.flush();
  assert.equal(h.sent.length, 0);
});

test('selected text and selections outside the editor do not trigger', () => {
  const h = harness(); h.selection.isCollapsed = false; h.fire('keyup'); h.flush();
  assert.equal(h.sent.length, 0);
  h.selection.isCollapsed = true; h.selection.anchorNode = null; h.fire('keyup'); h.flush();
  assert.equal(h.sent.length, 0);
});

test('untrusted events and modified keys do not trigger', () => {
  const h = harness(); h.fire('keyup', { isTrusted: false }); h.flush();
  h.fire('keyup', { ctrlKey: true }); h.flush(); assert.equal(h.sent.length, 0);
});

test('IME composition waits for the committed text', () => {
  const h = harness(); h.fire('compositionstart'); h.fire('keyup'); h.flush();
  assert.equal(h.sent.length, 0);
  h.fire('compositionend'); h.flush(); assert.equal(h.sent.length, 2);
});

test('storage changes outside sync do not affect the setting', () => {
  const h = harness(); h.change({ enabled: { newValue: false } }, 'local');
  h.fire('keyup'); h.flush(); assert.equal(h.sent.length, 2);
});

test('unrelated sync settings leave a pending completion alone', () => {
  const h = harness(); h.fire('keyup'); h.change({ unrelated: { newValue: 1 } });
  h.flush(); assert.equal(h.sent.length, 2);
});

test('removed settings return to defaults', () => {
  const h = harness({ stored: { enabled: false } });
  h.change({ enabled: { oldValue: false } }); h.fire('keyup'); h.flush();
  assert.equal(h.sent.length, 2);
});

test('typing waits until settings have loaded', () => {
  const h = harness({ deferred: true }); h.fire('keyup'); h.flush();
  assert.equal(h.sent.length, 0);
  h.loadSettings(); h.fire('keyup'); h.flush(); assert.equal(h.sent.length, 2);
});

test('a stale initial read cannot undo a newer disable event', () => {
  const h = harness({ deferred: true }); h.change({ enabled: { newValue: false } });
  h.loadSettings(); h.fire('keyup'); h.flush(); assert.equal(h.sent.length, 0);
});
