// SKYBRIDGE DE V42 compatibility loader.
// index-de.html already points to this file. It loads the current complete German app.
(() => {
  const script = document.createElement('script');
  script.src = 'js/app-de-v41.js?v=43';
  script.async = false;
  (document.currentScript?.parentNode || document.body || document.head).appendChild(script);
})();
