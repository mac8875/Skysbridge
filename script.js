/* Compatibility entry point. The active application is js/app.js. */
(() => {
  if (document.querySelector('script[src*="js/app.js"]')) return;
  const script = document.createElement('script');
  script.src = 'js/app.js?v=32';
  document.head.appendChild(script);
})();
