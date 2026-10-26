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
    stylesheet.href = '/css/app-intro.css?v=10';
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
          <svg class="app-intro__star-trail" viewBox="0 0 300 280" focusable="false">
            <defs>
              <linearGradient id="introTailGold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff9de" stop-opacity=".92"/><stop offset=".32" stop-color="#ffd477" stop-opacity=".62"/><stop offset=".72" stop-color="#eea83c" stop-opacity=".25"/><stop offset="1" stop-color="#eea83c" stop-opacity="0"/></linearGradient>
              <linearGradient id="introTailCore" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffef2"/><stop offset=".5" stop-color="#ffe19a" stop-opacity=".85"/><stop offset="1" stop-color="#ffe19a" stop-opacity="0"/></linearGradient>
            </defs>
            <path class="app-intro__tail-glow" d="M22 15 C72 67 139 119 278 253" fill="none" stroke="url(#introTailGold)" stroke-width="24" stroke-linecap="round"/>
            <path class="app-intro__tail-core" d="M22 15 C72 67 139 119 278 253" fill="none" stroke="url(#introTailCore)" stroke-width="3" stroke-linecap="round"/>
            <path class="app-intro__tail-spark" d="M57 52 C109 101 169 154 238 217" fill="none" stroke="#ffe6ab" stroke-width="1" stroke-dasharray="1 13" stroke-linecap="round"/>
            <path class="app-intro__tail-star" d="M0-5 1.4-1.4 5 0 1.4 1.4 0 5-1.4 1.4-5 0-1.4-1.4Z" transform="translate(61 53) scale(1.2)"/>
            <path class="app-intro__tail-star" d="M0-5 1.4-1.4 5 0 1.4 1.4 0 5-1.4 1.4-5 0-1.4-1.4Z" transform="translate(92 82) scale(.9)"/>
            <path class="app-intro__tail-star" d="M0-5 1.4-1.4 5 0 1.4 1.4 0 5-1.4 1.4-5 0-1.4-1.4Z" transform="translate(124 109) scale(1.05)"/>
            <path class="app-intro__tail-star" d="M0-5 1.4-1.4 5 0 1.4 1.4 0 5-1.4 1.4-5 0-1.4-1.4Z" transform="translate(158 140) scale(.78)"/>
            <path class="app-intro__tail-star" d="M0-5 1.4-1.4 5 0 1.4 1.4 0 5-1.4 1.4-5 0-1.4-1.4Z" transform="translate(193 173) scale(.95)"/>
            <path class="app-intro__tail-star" d="M0-5 1.4-1.4 5 0 1.4 1.4 0 5-1.4 1.4-5 0-1.4-1.4Z" transform="translate(227 206) scale(.68)"/>
            <path class="app-intro__tail-star" d="M0-5 1.4-1.4 5 0 1.4 1.4 0 5-1.4 1.4-5 0-1.4-1.4Z" transform="translate(258 235) scale(.52)"/>
          </svg>
          <i class="app-intro__star-side" style="--depth:1px"></i><i class="app-intro__star-side" style="--depth:2px"></i><i class="app-intro__star-side" style="--depth:3px"></i><i class="app-intro__star-side" style="--depth:4px"></i><i class="app-intro__star-side" style="--depth:5px"></i>
          <svg class="app-intro__star-face" viewBox="0 0 200 200" focusable="false">
            <defs>
              <linearGradient id="introStarGold" x1=".12" y1=".08" x2=".86" y2=".94"><stop stop-color="#fffdf1"/><stop offset=".32" stop-color="#ffe7a1"/><stop offset=".7" stop-color="#e9ad48"/><stop offset="1" stop-color="#a96924"/></linearGradient>
              <radialGradient id="introStarCore"><stop stop-color="#fffef5"/><stop offset=".44" stop-color="#ffe69b" stop-opacity=".92"/><stop offset="1" stop-color="#f4c35f" stop-opacity="0"/></radialGradient>
            </defs>
            <path d="M100 2 C94 43 88 87 48 100 C88 113 94 157 100 198 C106 157 112 113 152 100 C112 87 106 43 100 2Z" fill="url(#introStarGold)"/>
            <path d="M100 22 C97 63 95 91 78 100 C95 109 97 137 100 178 C103 137 105 109 122 100 C105 91 103 63 100 22Z" fill="#fffdf4" fill-opacity=".38"/>
            <circle cx="100" cy="100" r="31" fill="url(#introStarCore)"/>
            <circle cx="100" cy="100" r="3.5" fill="#fffef7"/>
          </svg>
        </div>
        <div class="app-intro__brand">
          <div class="app-intro__wordmark"><span class="app-intro__wordmark-sky">Sky’s</span><span class="app-intro__wordmark-bridge">Bridge</span></div>
          <svg class="app-intro__wings" viewBox="0 0 100 64" preserveAspectRatio="none" focusable="false">
            <path d="M1 7 C17 46 31 14 50 56 C69 14 83 46 99 7"/>
            <path d="M0 18 C17 53 33 28 50 61 C67 28 83 53 100 18"/>
            <path d="M4 2 C20 35 34 12 50 49 C66 12 80 35 96 2"/>
          </svg>
          <span class="app-intro__tagline">BUILDING BRIDGES THROUGH GRIEF</span>
        </div>
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
