(() => {
  'use strict';
  const { DEFAULTS, normalizeSettings } = KaggleAutocomplete;
  const status = document.getElementById('status');
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    if (chrome.runtime.lastError) {
      status.textContent = 'Could not load settings. Close and reopen this popup to retry.';
      return;
    }
    const settings = normalizeSettings(stored);
    status.textContent = 'Settings save automatically.';
    for (const key of Object.keys(DEFAULTS)) {
      const el = document.getElementById(key);
      if (el.type === 'checkbox') el.checked = settings[key];
      else el.value = settings[key];
      el.disabled = false;
      el.addEventListener('change', () => {
        if (!el.checkValidity()) {
          status.textContent = key === 'delay'
            ? 'Use a delay from 0 to 2000 ms in steps of 50.'
            : 'Use a minimum from 1 to 5 characters.';
          el.reportValidity();
          return;
        }
        const value = el.type === 'checkbox' ? el.checked : el.valueAsNumber;
        status.textContent = 'Saving...';
        chrome.storage.sync.set({ [key]: value }, () => {
          status.textContent = chrome.runtime.lastError
            ? 'Could not save settings. Change the value again to retry.' : 'Saved.';
        });
      });
    }
  });
})();
