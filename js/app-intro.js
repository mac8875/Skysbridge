(() => {
  if (!document.documentElement.classList.contains('native-app')) return;
  try {
    if (sessionStorage.getItem('skysbridge-app-intro-shown') === '1') return;
    sessionStorage.setItem('skysbridge-app-intro-shown', '1');
  } catch (_) {}

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
      <img class="app-intro__animation" src="assets/app-intro-v13.gif" alt="" fetchpriority="high">
      <button class="app-intro__skip" type="button">${skipLabel}</button>
    `;
    document.body.appendChild(intro);

    const close = () => {
      if (!intro.isConnected || intro.classList.contains('is-leaving')) return;
      intro.classList.add('is-leaving');
      window.setTimeout(() => intro.remove(), 650);
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
