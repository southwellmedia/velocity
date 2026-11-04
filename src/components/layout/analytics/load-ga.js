(function(){
  const d = JSON.parse(document.getElementById('analytics-data').textContent);
  window.dataLayer = window.dataLayer || [];
  // GA4 requires the Arguments object, not rest params
  function gtag(){window.dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', d.gaId);
})();
