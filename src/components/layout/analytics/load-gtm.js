(function(){
  const d = JSON.parse(document.getElementById('analytics-data').textContent);
  const i = d.gtmId;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  const f = document.getElementsByTagName('script')[0],
    j = document.createElement('script');
  j.async = true;
  j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i;
  f.parentNode.insertBefore(j, f);
})();
