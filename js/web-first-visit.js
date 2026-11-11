(() => {
  const host = window.location.hostname.toLowerCase();
  const isNative = Boolean(
    window.Capacitor?.isNativePlatform?.() ||
    ['android', 'ios'].includes(window.Capacitor?.getPlatform?.()) ||
    ['localhost', '127.0.0.1'].includes(host) ||
    ['capacitor:', 'ionic:'].includes(window.location.protocol) ||
    /\\bCapacitor\\b/i.test(window.navigator.userAgent)
  );
  if (isNative) return;

  const seenKey = 'skysbridge-web-first-visit-seen';
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let storage;
  try {
    storage = window.localStorage;
    if (storage.getItem(seenKey) === '1' || reducedMotion) return;
    storage.setItem(seenKey, '1');
  } catch {
    return;
  }

  document.documentElement.classList.add('web-first-visit-pending');
  const start = () => {
    if (!document.body || document.querySelector('.web-first-visit')) return;
    const lang = (document.documentElement.lang || 'en').slice(0, 2);
    const skipLabel = lang === 'de' ? 'Überspringen' : lang === 'es' ? 'Saltar' : 'Skip';
    const introLabel = lang === 'de' ? 'Skysbridge wird geöffnet' : lang === 'es' ? 'Abriendo Skysbridge' : 'Opening Skysbridge';
    const intro = document.createElement('div');
    intro.className = 'web-first-visit';
    intro.setAttribute('role', 'region');
    intro.setAttribute('aria-label', introLabel);
    intro.innerHTML = '<div class="web-first-visit__backdrop" aria-hidden="true"></div>' +
      '<video class="web-first-visit__video" muted autoplay playsinline preload="auto" poster="assets/skysbridge-first-visit-poster.jpg" aria-hidden="true">' +
      '<source src="assets/skysbridge-first-visit.mp4" type="video/mp4">' +
      '</video><button class="web-first-visit__skip" type="button"></button>';
    document.body.appendChild(intro);
    const video = intro.querySelector('video');
    const skip = intro.querySelector('button');
    skip.textContent = skipLabel;

    let closing = false;
    const close = () => {
      if (closing || !intro.isConnected) return;
      closing = true;
      intro.classList.add('is-leaving');
      document.documentElement.classList.add('web-first-visit-done');
      window.setTimeout(() => {
        intro.remove();
        document.documentElement.classList.remove('web-first-visit-pending');
      }, 700);
    };

    skip.addEventListener('click', close, { once: true });
    video.addEventListener('ended', close, { once: true });
    video.addEventListener('error', close, { once: true });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    }, { once: true });
    window.setTimeout(close, 10000);
    const playback = video.play();
    if (playback && typeof playback.catch === 'function') playback.catch(close);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();