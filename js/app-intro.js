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
    stylesheet.href = '/css/app-intro.css?v=18';
    document.head.appendChild(stylesheet);
  }

  const start = () => {
    if (!document.body || document.querySelector('.app-intro')) return;
    const lang = (document.documentElement.lang || 'en').slice(0, 2);
    const skipLabel = lang === 'de' ? 'Überspringen' : lang === 'es' ? 'Saltar' : 'Skip';
    const soundLabel = lang === 'de' ? 'Ton einschalten' : lang === 'es' ? 'Activar sonido' : 'Enable sound';
    const muteLabel = lang === 'de' ? 'Ton ausschalten' : lang === 'es' ? 'Desactivar sonido' : 'Mute sound';
    const label = lang === 'de' ? 'Skysbridge wird geladen' : lang === 'es' ? 'Cargando Skysbridge' : 'Loading Skysbridge';
    const intro = document.createElement('div');
    intro.className = 'app-intro';
    intro.setAttribute('role', 'status');
    intro.setAttribute('aria-label', label);
    intro.innerHTML = `
      <div class="app-intro__scene" aria-hidden="true">
        <img class="app-intro__poster" src="/assets/skysbridge-intro-poster.jpg" alt="" aria-hidden="true">\n        <video class="app-intro__animation" playsinline webkit-playsinline preload="auto" disablepictureinpicture disableremoteplayback aria-hidden="true">
          <source src="/assets/skysbridge-app-intro.mp4" type="video/mp4">
        </video>
      </div>
      <div class="app-intro__controls">
        <button class="app-intro__sound" type="button"></button>
        <button class="app-intro__skip" type="button">${skipLabel}</button>
      </div>
    `;
    document.body.appendChild(intro);
    const video = intro.querySelector('video');
    const scene = intro.querySelector('.app-intro__scene');
    const sound = intro.querySelector('.app-intro__sound');
    const setSoundIcon = muted => {
      sound.innerHTML = muted
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm11.5 3 5 5m0-5-5 5"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm11.5-1a6 6 0 0 1 0 8m2.5-11a10 10 0 0 1 0 14"/></svg>';
      sound.setAttribute('aria-label', muted ? soundLabel : muteLabel);
      sound.setAttribute('title', muted ? soundLabel : muteLabel);
      sound.setAttribute('aria-pressed', String(!muted));
    };
    const showFallback = () => {
      video?.remove();
      intro.classList.add('app-intro--fallback');
      if (!scene?.querySelector('.app-intro__fallback-label')) {
        const fallback = document.createElement('span');
        fallback.className = 'app-intro__fallback-label';
        fallback.textContent = 'Sky’s Bridge';
        scene?.appendChild(fallback);
      }
    };
    video?.addEventListener('error', showFallback, { once: true });
    // Android WebView may briefly paint its native play overlay before decoding.
    // Keep the video hidden until a real frame is available.
    let revealed = false;
    const reveal = () => {
      if (revealed || !video || video.paused || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      revealed = true;
      intro.classList.add('app-intro--playing');
    };
    video?.addEventListener('playing', reveal);
    if (typeof video?.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => reveal());
    }
    video?.play()?.catch(() => {
      if (!video) return;
      video.muted = true;
      setSoundIcon(true);
      video.play().catch(showFallback);
    });
    if (video) setSoundIcon(video.muted);
    try { window.SkysbridgeNative?.setFullscreen(true); } catch {}

    const close = () => {
      if (!intro.isConnected || intro.classList.contains('is-leaving')) return;
      intro.classList.add('is-leaving');
      video?.pause();
      window.setTimeout(() => {
        intro.remove();
        document.documentElement.classList.remove('skysbridge-intro-pending');
        try { window.SkysbridgeNative?.setFullscreen(false); } catch {}
      }, 650);
    };
    video?.addEventListener('ended', () => window.setTimeout(close, 500), { once: true });
    sound?.addEventListener('click', async () => {
      if (!video) return;
      try {
        video.muted = !video.muted;
        if (!video.muted) await video.play();
        setSoundIcon(video.muted);
      } catch (_) {
        video.muted = true;
        setSoundIcon(true);
      }
    });
    intro.querySelector('.app-intro__skip')?.addEventListener('click', close, { once: true });
    window.setTimeout(close, 7500);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
