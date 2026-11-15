(() => {
  const host = window.location.hostname.toLowerCase();
  const isNative = Boolean(
    window.Capacitor?.isNativePlatform?.() ||
    ['android', 'ios'].includes(window.Capacitor?.getPlatform?.()) ||
    ['localhost', '127.0.0.1'].includes(host) ||
    ['capacitor:', 'ionic:'].includes(window.location.protocol) ||
    window.navigator.userAgent.toLowerCase().includes('capacitor')
  );
  if (isNative) return;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  function hasSignedInSession() {
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
        const stored = JSON.parse(window.localStorage.getItem(key) || 'null');
        const session = stored?.currentSession || stored;
        const user = session?.user;
        if (user?.id && !user.is_anonymous) return true;
      }
    } catch (_) {
      // If browser storage is unavailable, show the guest intro and let the visitor skip it.
    }
    return false;
  }

  if (hasSignedInSession()) return;
  document.documentElement.classList.add('web-first-visit-pending');

  const start = () => {
    if (!document.body || document.querySelector('.web-first-visit')) return;
    const lang = (document.documentElement.lang || 'en').slice(0, 2);
    const skipLabel = lang === 'de' ? 'Überspringen' : lang === 'es' ? 'Saltar' : 'Skip';
    const soundLabel = lang === 'de' ? 'Ton einschalten' : lang === 'es' ? 'Activar sonido' : 'Enable sound';
    const muteLabel = lang === 'de' ? 'Ton ausschalten' : lang === 'es' ? 'Desactivar sonido' : 'Mute sound';
    const introLabel = lang === 'de'
      ? 'Skysbridge wird geöffnet'
      : lang === 'es' ? 'Abriendo Skysbridge' : 'Opening Skysbridge';
    const intro = document.createElement('div');
    intro.className = 'web-first-visit';
    intro.setAttribute('role', 'region');
    intro.setAttribute('aria-label', introLabel);
    intro.innerHTML =
      '<div class="web-first-visit__backdrop" aria-hidden="true"></div>' +
      '<div class="web-first-visit__content">' +
      '<div class="web-first-visit__frame">' +
      '<video class="web-first-visit__video" autoplay playsinline preload="auto" aria-hidden="true"></video>' +
      '</div>' +
      '<div class="web-first-visit__controls">' +
      '<button class="web-first-visit__sound" type="button"></button>' +
      '<button class="web-first-visit__skip" type="button"></button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(intro);

    const video = intro.querySelector('video');
    const skip = intro.querySelector('.web-first-visit__skip');
    const sound = intro.querySelector('.web-first-visit__sound');
    skip.textContent = skipLabel;
    const setSoundIcon = muted => {
      sound.innerHTML = muted
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm11.5 3 5 5m0-5-5 5"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm11.5-1a6 6 0 0 1 0 8m2.5-11a10 10 0 0 1 0 14"/></svg>';
      sound.setAttribute('aria-label', muted ? soundLabel : muteLabel);
      sound.setAttribute('title', muted ? soundLabel : muteLabel);
      sound.setAttribute('aria-pressed', String(!muted));
    };
    video.poster = 'assets/skysbridge-first-visit-guest-poster.jpg';
    video.src = 'assets/skysbridge-first-visit-guest.mp4';

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
    sound.addEventListener('click', async () => {
      try {
        video.muted = !video.muted;
        if (!video.muted) await video.play();
        setSoundIcon(video.muted);
      } catch (_) {
        video.muted = true;
        setSoundIcon(true);
      }
    });
    video.addEventListener('ended', close, { once: true });
    video.addEventListener('error', close, { once: true });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    }, { once: true });
    window.setTimeout(close, 10000);
    const playback = video.play();
    if (playback && typeof playback.catch === 'function') playback.catch(() => {
      video.muted = true;
      setSoundIcon(true);
      video.play().catch(() => {});
    });
    setSoundIcon(video.muted);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
