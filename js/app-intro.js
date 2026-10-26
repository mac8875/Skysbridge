(() => {
  const capacitor = window.Capacitor;
  const host = window.location.hostname.toLowerCase();
  const isNative = Boolean(
    capacitor?.isNativePlatform?.() ||
    ['android', 'ios'].includes(capacitor?.getPlatform?.()) ||
    ['localhost', '127.0.0.1'].includes(host) ||
    ['capacitor:', 'ionic:'].includes(window.location.protocol) ||
    /\bCapacitor\b/i.test(window.navigator.userAgent)
  );
  if (!isNative) return;

  const introSessionKey = 'skysbridge-intro-shown';
  try {
    if (window.sessionStorage.getItem(introSessionKey) === '1') return;
    window.sessionStorage.setItem(introSessionKey, '1');
  } catch {
    // Keep the intro available if session storage is disabled.
  }

  document.documentElement.classList.add('native-app');
  if (!document.getElementById('app-intro-stylesheet')) {
    const stylesheet = document.createElement('link');
    stylesheet.id = 'app-intro-stylesheet';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/css/app-intro.css?v=8';
    document.head.appendChild(stylesheet);
  }

  const start = () => {
    if (!document.body || document.querySelector('.app-intro')) return;
    const lang = (document.documentElement.lang || 'en').slice(0, 2);
    const skipLabel = lang === 'de' ? 'Überspringen' : lang === 'es' ? 'Saltar' : 'Skip';
    const label = lang === 'de' ? 'Skysbridge wird geladen' : lang === 'es' ? 'Cargando Skysbridge' : 'Loading Skysbridge';
    const intro = document.createElement('div');
    intro.className = 'app-intro';
    intro.setAttribute('role', 'status');
    intro.setAttribute('aria-label', label);
    intro.innerHTML = `
      <div class="app-intro__scene" aria-hidden="true">
        <img class="app-intro__backdrop" src="/assets/app-intro-background-v14.webp" alt="" fetchpriority="high">
        <div class="app-intro__depth-stars"></div>
        <div class="app-intro__rising-star">
          <span class="app-intro__star-trail"></span>
          <i class="app-intro__star-side" style="--depth:1px"></i><i class="app-intro__star-side" style="--depth:2px"></i><i class="app-intro__star-side" style="--depth:3px"></i><i class="app-intro__star-side" style="--depth:4px"></i><i class="app-intro__star-side" style="--depth:5px"></i>
          <svg class="app-intro__star-face" viewBox="0 0 200 200" focusable="false">
            <defs>
              <linearGradient id="introStarGold" x1=".12" y1=".08" x2=".86" y2=".94"><stop stop-color="#fffbe6"/><stop offset=".38" stop-color="#ffe59b"/><stop offset=".72" stop-color="#e9ad48"/><stop offset="1" stop-color="#a96924"/></linearGradient>
              <radialGradient id="introStarCore"><stop stop-color="#fffef5"/><stop offset=".52" stop-color="#ffe8a0" stop-opacity=".9"/><stop offset="1" stop-color="#f4c35f" stop-opacity="0"/></radialGradient>
            </defs>
            <path d="M100 4 119 80 196 100 119 120 100 196 81 120 4 100 81 80Z" fill="url(#introStarGold)"/>
            <circle cx="100" cy="100" r="35" fill="url(#introStarCore)"/>
            <path d="M100 68 132 100 100 132 68 100Z" fill="#fff4c6" fill-opacity=".42"/>
            <circle cx="100" cy="100" r="4" fill="#fffef7"/>
          </svg>
        </div>
        <div class="app-intro__wordmark">Sky’s Bridge</div>
      </div>
      <button class="app-intro__skip" type="button">${skipLabel}</button>
    `;
    document.body.appendChild(intro);

    const close = () => {
      if (!intro.isConnected || intro.classList.contains('is-leaving')) return;
      intro.classList.add('is-leaving');
      window.setTimeout(() => { intro.remove(); document.documentElement.classList.remove('skysbridge-intro-pending'); }, 650);
    };
    intro.querySelector('.app-intro__skip').addEventListener('click', close, { once: true });
    window.setTimeout(close, 8750);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
