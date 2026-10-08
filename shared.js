(() => {
  'use strict';
  const DEFAULTS = Object.freeze({ enabled: true, delay: 200, minChars: 2 });

  function normalizeSettings(stored = {}) {
    const number = (key, min, max) => {
      const value = stored[key];
      return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, Math.round(value))) : DEFAULTS[key];
    };
    return {
      enabled: typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULTS.enabled,
      delay: number('delay', 0, 2000),
      minChars: number('minChars', 1, 5),
    };
  }

  // A small Python lexical check, not a parser. Entire f-strings are skipped.
  function isCode(text) {
    let quote = '';
    let triple = false;
    let escaped = false;
    let comment = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (comment) {
        if (char === '\n') comment = false;
      } else if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (triple && text.startsWith(quote.repeat(3), i)) {
          quote = ''; triple = false; i += 2;
        } else if (!triple && (char === quote || char === '\n')) quote = '';
      } else if (char === '#') comment = true;
      else if (char === "'" || char === '"') {
        quote = char;
        triple = text.startsWith(char.repeat(3), i);
        if (triple) i += 2;
      }
    }
    return !quote && !comment;
  }

  const IDENTIFIER = /^[\p{ID_Start}_][\p{ID_Continue}]*$/u;
  function shouldTrigger(text, minChars = DEFAULTS.minChars) {
    if (typeof text !== 'string' || !isCode(text)) return false;
    const attribute = text.match(/\.([\p{ID_Continue}]*)$/u);
    if (attribute) {
      if (attribute[1] && !IDENTIFIER.test(attribute[1])) return false;
      const base = text.slice(0, -attribute[0].length).trimEnd();
      if (/[)\]]$/.test(base)) return true;
      const name = base.match(/[\p{ID_Continue}]+$/u)?.[0];
      return !!name && IDENTIFIER.test(name);
    }
    const word = text.match(/[\p{ID_Continue}]+$/u)?.[0];
    return !!word && IDENTIFIER.test(word) && [...word].length >= minChars;
  }

  globalThis.KaggleAutocomplete = Object.freeze({ DEFAULTS, normalizeSettings, shouldTrigger });
})();
