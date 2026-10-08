const DEFAULTS = { enabled: true, delay: 200, minChars: 2 };

chrome.storage.sync.get(DEFAULTS, (s) => {
  for (const key of Object.keys(DEFAULTS)) {
    const el = document.getElementById(key);
    if (el.type === 'checkbox') el.checked = s[key];
    else el.value = s[key];
    el.addEventListener('change', () => {
      chrome.storage.sync.set({ [key]: el.type === 'checkbox' ? el.checked : Number(el.value) });
    });
  }
});
