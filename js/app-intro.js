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
    stylesheet.href = '/css/app-intro.css?v=15';
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
        <img class="app-intro__animation" src="/assets/skysbridge-intro-bridge-stronger.gif" alt="" fetchpriority="high">
      </div>
      <button class="app-intro__skip" type="button">${skipLabel}</button>
    `;
    document.body.appendChild(intro);
    const animation = intro.querySelector('.app-intro__animation');
    animation?.addEventListener('error', () => {
      animation.remove();
      intro.classList.add('app-intro--fallback');
      const fallback = document.createElement('span');
      fallback.className = 'app-intro__fallback-label';
      fallback.textContent = 'Sky’s Bridge';
      intro.querySelector('.app-intro__scene')?.appendChild(fallback);
    }, { once: true });
    try { window.SkysbridgeNative?.setFullscreen(true); } catch {}

    const close = () => {
      if (!intro.isConnected || intro.classList.contains('is-leaving')) return;
      intro.classList.add('is-leaving');
      window.setTimeout(() => {
        intro.remove();
        document.documentElement.classList.remove('skysbridge-intro-pending');
        try { window.SkysbridgeNative?.setFullscreen(false); } catch {}
      }, 650);
    };
    intro.querySelector('.app-intro__skip')?.addEventListener('click', close, { once: true });
    window.setTimeout(close, 10850);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
