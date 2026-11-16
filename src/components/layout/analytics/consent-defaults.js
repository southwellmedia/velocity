(function(){
  const d = JSON.parse(document.getElementById('analytics-data').textContent);
  window.dataLayer = window.dataLayer || [];
  // GA4 requires the Arguments object, not rest params
  function gtag(){window.dataLayer.push(arguments);}

  let stored = null;
  try {
    const raw = localStorage.getItem(d.storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === d.configVersion) {
        stored = parsed;
      }
    }
  } catch { /* ignored */ }

  const gcmValues = {};
  const keys = Object.keys(d.gcmDefaults);
  for (let k = 0; k < keys.length; k++) { gcmValues[keys[k]] = d.gcmDefaults[keys[k]]; }
  let decided = false;
  let categories = {};
  const catKeys = Object.keys(d.categoryDefaults);
  for (let c = 0; c < catKeys.length; c++) { categories[catKeys[c]] = d.categoryDefaults[catKeys[c]]; }

  const optOut = d.mode === 'opt_out';

  if (stored && stored.categories) {
    decided = true;
    categories = stored.categories;

    const mapKeys = Object.keys(d.categoryGcmMap);
    for (let m = 0; m < mapKeys.length; m++) {
      const catKey = mapKeys[m];
      const granted = !!categories[catKey];
      const gcmTypes = d.categoryGcmMap[catKey];
      for (let g = 0; g < gcmTypes.length; g++) {
        gcmValues[gcmTypes[g]] = granted ? 'granted' : 'denied';
      }
    }
  } else if (optOut && navigator.globalPrivacyControl === true) {
    // Global Privacy Control is an opt-out request: honour it as a decision
    decided = true;
    const gpcKeys = Object.keys(d.gcmDenied);
    for (let p = 0; p < gpcKeys.length; p++) { gcmValues[gpcKeys[p]] = d.gcmDenied[gpcKeys[p]]; }
    for (let c = 0; c < catKeys.length; c++) {
      const types = d.categoryGcmMap[catKeys[c]] || [];
      categories[catKeys[c]] = types.length > 0 && d.gcmDenied[types[0]] === 'granted';
    }
  } else if (optOut && d.optInRegions.length) {
    // Opt-in regions start denied. The region-specific default wins over the
    // general one below for visitors Google places in these regions.
    const regional = { region: d.optInRegions };
    const deniedKeys = Object.keys(d.gcmDenied);
    for (let r = 0; r < deniedKeys.length; r++) { regional[deniedKeys[r]] = d.gcmDenied[deniedKeys[r]]; }
    gtag('consent', 'default', regional);
  }

  gtag('consent', 'default', gcmValues);
  window.__consentState = { decided: decided, categories: categories };
})();
