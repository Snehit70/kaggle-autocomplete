// Runs inside Kaggle's JupyterLab iframe (*.jupyter-proxy.kaggle.net).
// JupyterLab already has a kernel/LSP-backed completer, but it only opens on Tab.
// This script opens it automatically while you type, like Colab.

const DEFAULTS = { enabled: true, delay: 200, minChars: 2 };
let settings = { ...DEFAULTS };

chrome.storage.sync.get(DEFAULTS, (s) => (settings = s));
chrome.storage.onChanged.addListener((changes) => {
  for (const [k, { newValue }] of Object.entries(changes)) settings[k] = newValue;
});

let timer = null;

function completerVisible() {
  const el = document.querySelector('.jp-Completer');
  return !!el && !el.classList.contains('lm-mod-hidden') && el.offsetParent !== null;
}

// Text of the current line up to the cursor, read from CodeMirror 6's DOM selection.
function textBeforeCursor() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const node = sel.anchorNode;
  const line = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest('.cm-line');
  if (!line) return null;
  const range = document.createRange();
  range.setStart(line, 0);
  range.setEnd(node, sel.anchorOffset);
  return range.toString();
}

function shouldTrigger(text) {
  if (text == null) return false;
  // Skip comments (rough check: a '#' before the cursor that isn't inside quotes).
  const hash = text.indexOf('#');
  if (hash !== -1 && (text.slice(0, hash).split(/['"]/).length - 1) % 2 === 0) return false;
  if (/[A-Za-z_][\w]*\.\w*$/.test(text)) return true; // attribute access: np.  df.gr
  const word = text.match(/[A-Za-z_]\w*$/);
  if (!word || word[0].length < settings.minChars) return false;
  // Don't pop up right after a number like `1e` or inside `0x1f`.
  return !/\d[A-Za-z_]\w*$/.test(text.slice(-word[0].length - 1));
}

function openCompleter(target) {
  // Same key JupyterLab binds to `completer:invoke-notebook`.
  const init = { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true, cancelable: true };
  target.dispatchEvent(new KeyboardEvent('keydown', init));
  target.dispatchEvent(new KeyboardEvent('keyup', init));
}

document.addEventListener(
  'keyup',
  (e) => {
    if (!settings.enabled || !e.isTrusted) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Only react to typed characters (and Backspace, so the list refreshes after edits).
    if (e.key.length !== 1 && e.key !== 'Backspace') return;
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.closest('.jp-Notebook .cm-content')) return;

    clearTimeout(timer);
    timer = setTimeout(() => {
      if (document.activeElement !== target || completerVisible()) return;
      if (shouldTrigger(textBeforeCursor())) openCompleter(target);
    }, settings.delay);
  },
  true
);
