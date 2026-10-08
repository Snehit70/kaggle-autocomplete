// Runs in Kaggle's JupyterLab iframe, in the extension's isolated world.
(() => {
  'use strict';

  const DEFAULTS = { enabled: true, delay: 200, minChars: 2 };
  let settings = { ...DEFAULTS };
  let pending = null;
  let composing = false;

  function cancelPending() {
    if (pending) clearTimeout(pending.timer);
    pending = null;
  }

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = stored;
    cancelPending();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const key of Object.keys(DEFAULTS)) {
      if (key in changes) settings[key] = changes[key].newValue ?? DEFAULTS[key];
    }
    cancelPending();
  });

  function eligibleEditor(target) {
    if (!(target instanceof HTMLElement) || !target.isConnected) return false;
    if (!target.matches('.cm-content[contenteditable="true"]')) return false;
    if (!target.closest('.jp-Notebook .jp-CodeCell')) return false;
    // Without this flag, CodeMirror can treat Tab as an insertion/indentation.
    const editor = target.closest('.jp-CodeMirrorEditor');
    return !!editor?.classList.contains('jp-mod-completer-enabled');
  }

  function completerVisible() {
    return [...document.querySelectorAll('.jp-Completer, .jp-InlineCompleter')].some(
      (el) => !el.classList.contains('lm-mod-hidden') && el.getClientRects().length > 0,
    );
  }

  function readCursor(target) {
    const selection = window.getSelection();
    if (!selection?.isCollapsed || selection.rangeCount === 0) return null;
    const node = selection.anchorNode;
    if (!node || !target.contains(node)) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    const line = element?.closest('.cm-line');
    if (!line || !target.contains(line)) return null;
    const range = document.createRange();
    range.setStart(line, 0);
    range.setEnd(node, selection.anchorOffset);
    return { node, offset: selection.anchorOffset, line, text: range.toString() };
  }

  function sameCursor(a, b) {
    return !!a && !!b && a.node === b.node && a.offset === b.offset &&
      a.line === b.line && a.text === b.text;
  }

  function shouldTrigger(text) {
    const hash = text.indexOf('#');
    if (hash !== -1 && (text.slice(0, hash).split(/['"]/).length - 1) % 2 === 0) return false;
    if (/[A-Za-z_]\w*\.\w*$/.test(text)) return true;
    const word = text.match(/[A-Za-z_]\w*$/);
    return !!word && word[0].length >= settings.minChars &&
      !/\d[A-Za-z_]\w*$/.test(text.slice(-word[0].length - 1));
  }

  function schedule(target) {
    cancelPending();
    if (!settings.enabled || composing || !eligibleEditor(target)) return;
    if (document.activeElement !== target || completerVisible()) return;
    const cursor = readCursor(target);
    if (!cursor || !shouldTrigger(cursor.text)) return;
    const request = { target, cursor, timer: null };
    pending = request;
    request.timer = setTimeout(() => {
      if (pending !== request) return;
      pending = null;
      if (!settings.enabled || composing || !eligibleEditor(target)) return;
      if (document.activeElement !== target || completerVisible()) return;
      if (!sameCursor(cursor, readCursor(target))) return;
      const init = { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true, cancelable: true };
      target.dispatchEvent(new KeyboardEvent('keydown', init));
      target.dispatchEvent(new KeyboardEvent('keyup', init));
    }, settings.delay);
  }

  document.addEventListener('keydown', (event) => {
    if (event.isTrusted) cancelPending();
  }, true);

  document.addEventListener('keyup', (event) => {
    if (!event.isTrusted) return;
    cancelPending();
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1 && event.key !== 'Backspace') return;
    schedule(event.target);
  }, true);

  document.addEventListener('selectionchange', () => {
    if (pending && !sameCursor(pending.cursor, readCursor(pending.target))) cancelPending();
  });
  document.addEventListener('pointerdown', cancelPending, true);
  document.addEventListener('focusout', cancelPending, true);
  window.addEventListener('blur', cancelPending);
  document.addEventListener('compositionstart', () => {
    composing = true;
    cancelPending();
  }, true);
  document.addEventListener('compositionend', (event) => {
    composing = false;
    if (event.isTrusted) schedule(event.target);
  }, true);
})();
