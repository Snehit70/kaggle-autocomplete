const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('../shared.js'), 'utf8'), context);
const { shouldTrigger, normalizeSettings } = context.KaggleAutocomplete;

for (const text of ['np.', 'pd.read', "df['col'].", 'factory().', 'print', '_x', 'αβ']) {
  test(`requests suggestions for ${JSON.stringify(text)}`, () => assert.equal(shouldTrigger(text), true));
}

for (const text of [
  'p', '1e', '0x1f', '42.', 'np.1', '# print', 'x = 1 # print',
  "'hello", '"hello', "r'hello", "f'{np.",
  "s = 'it\\'s' # print", "s = '''first\nprint", 's = """first\nprint',
]) {
  test(`skips ${JSON.stringify(text)}`, () => assert.equal(shouldTrigger(text), false));
}

test('completed strings and previous-line comments do not suppress code', () => {
  for (const text of ["s = 'it\\'s'\nprint", '# comment\nprint', "s = '''abc'''\nprint", 's = "a#b"\nprint']) {
    assert.equal(shouldTrigger(text), true, text);
  }
});

test('minimum characters affects names but not attribute access', () => {
  assert.equal(shouldTrigger('pri', 4), false);
  assert.equal(shouldTrigger('print', 4), true);
  assert.equal(shouldTrigger('np.', 5), true);
});

test('settings clamp finite numbers and ignore unknown keys', () => {
  const actual = JSON.parse(JSON.stringify(normalizeSettings({ enabled: false, delay: -1, minChars: 99, extra: 1 })));
  assert.deepEqual(actual, { enabled: false, delay: 0, minChars: 5 });
  assert.equal(normalizeSettings({ delay: 9999 }).delay, 2000);
});

test('invalid stored types and nonfinite values use defaults', () => {
  const actual = JSON.parse(JSON.stringify(normalizeSettings({ enabled: 'false', delay: NaN, minChars: Infinity })));
  assert.deepEqual(actual, { enabled: true, delay: 200, minChars: 2 });
  assert.equal(normalizeSettings({ delay: '' }).delay, 200);
});
