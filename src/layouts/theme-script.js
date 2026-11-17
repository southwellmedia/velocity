// Runs before render to prevent a flash of the wrong theme.
// A theme the visitor chose with the toggle wins. Otherwise the site's default
// applies: data-default-theme on <html>, from defaultTheme in site.config.ts
// ('system' follows the operating system, 'light' or 'dark' fixes it).
// Storage can throw when site data is blocked; the default still applies.
(function () {
  const root = document.documentElement;
  let stored = null;
  try {
    stored = localStorage.getItem('theme');
  } catch {
    /* site data blocked */
  }
  const fallback = root.dataset.defaultTheme || 'system';
  const dark =
    stored === 'dark' ||
    (stored !== 'light' &&
      (fallback === 'dark' || (fallback === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)));
  root.classList.toggle('dark', dark);
})();
