
(() => {
  if (!document.documentElement.classList.contains('native-app')) return;
  try {
    if (sessionStorage.getItem('skysbridge-app-intro-shown') === '1') return;
    sessionStorage.setItem('skysbridge-app-intro-shown', '1');
  } catch (_) {}

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'css/app-intro.css?v=1';
  document.head.appendChild(stylesheet);

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
      <div class="app-intro__horizon" aria-hidden="true"></div>
      <svg class="app-intro__bridge" viewBox="0 0 390 180" aria-hidden="true">
        <path d="M10 127 Q94 125 125 93 L125 48 L138 48 L138 88 Q195 24 252 88 L252 48 L265 48 L265 93 Q296 125 380 127"></path>
        <path class="app-intro__bridge-deck" d="M8 128 Q195 91 382 128"></path>
        <path d="M10 137 Q195 101 380 137 M131 93 L131 126 M259 93 L259 108"></path>
        <path d="M34 145 Q195 111 356 145"></path>
        <path class="app-intro__bridge-water" d="M24 158 H112 M283 158 H366"></path>
      </svg>
      <span class="app-intro__star" aria-hidden="true">
        <svg viewBox="0 0 72 72"><path d="M36 0 43 28 72 36 43 43 36 72 29 43 0 36 29 28Z"></path></svg>
      </span>
      <div class="app-intro__wordmark" aria-label="Sky’s Bridge — Building Bridges Through Grief">
        <div class="app-intro__name">
          <span class="app-intro__sky">${[...'Sky’s'].map((letter, index) => `<span style="animation-delay:${2.5 + index * 0.12}s">${letter === ' ' ? '&nbsp;' : letter}</span>`).join('')}</span>
          <span class="app-intro__bridge-word">Bridge</span>
        </div>
        <span class="app-intro__tagline">Building Bridges Through Grief</span>
      </div>
      <button class="app-intro__skip" type="button">${skipLabel}</button>
    `;
    document.body.appendChild(intro);

    const close = () => {
      if (!intro.isConnected || intro.classList.contains('is-leaving')) return;
      intro.classList.add('is-leaving');
      window.setTimeout(() => intro.remove(), 600);
    };
    intro.querySelector('.app-intro__skip').addEventListener('click', close, { once: true });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(close, reducedMotion ? 1800 : 4800);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
