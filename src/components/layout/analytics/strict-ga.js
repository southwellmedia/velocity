(function(){
  const d = JSON.parse(document.getElementById('analytics-data').textContent);
  if (window.__consentState && window.__consentState.decided && window.__consentState.categories[d.analyticsCategoryKey]) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + d.gaId;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
  // GA4 requires the Arguments object, not rest params
    function gtag(){window.dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', d.gaId);
  }
})();
