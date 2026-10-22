(() => {
  const capacitor = window.Capacitor;
  const host = window.location.hostname.toLowerCase();
  const nativeHost = ['localhost', '127.0.0.1'].includes(host);
  const nativeProtocol = ['capacitor:', 'ionic:'].includes(window.location.protocol);
  const nativePlatform = Boolean(
    capacitor?.isNativePlatform?.() ||
    ['android', 'ios'].includes(capacitor?.getPlatform?.())
  );
  const isNative = nativeHost || nativeProtocol || nativePlatform ||
    /\bCapacitor\b/i.test(window.navigator.userAgent);
  if (isNative) document.documentElement.classList.add('native-app');

  const showAndroidBetaBanner = () => {
    if (document.querySelector('.android-beta-banner')) return;
    let dismissedAt = 0;
    try {
      dismissedAt = Number(window.localStorage.getItem('skysbridge-android-beta-banner-dismissed') || 0);
    } catch (_) {}
    if (dismissedAt && Date.now() - dismissedAt < 30 * 24 * 60 * 60 * 1000) return;

    const language = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    const copy = {
      en: {
        message: 'New: The Skysbridge Android app is now available in beta.',
        action: 'Get the Android beta',
        dismiss: 'Dismiss app announcement'
      },
      de: {
        message: 'Neu: Die Skysbridge-App ist jetzt als Beta-Version für Android verfügbar.',
        action: 'Android-Beta herunterladen',
        dismiss: 'App-Hinweis schließen'
      },
      es: {
        message: 'Nuevo: La app de Skysbridge ya está disponible en versión beta para Android.',
        action: 'Descargar beta para Android',
        dismiss: 'Cerrar aviso de la app'
      }
    }[language] || {
      message: 'New: The Skysbridge Android app is now available in beta.',
      action: 'Get the Android beta',
      dismiss: 'Dismiss app announcement'
    };

    const banner = document.createElement('aside');
    banner.className = 'android-beta-banner';
    banner.setAttribute('aria-label', copy.message);
    banner.innerHTML = `
      <div class="android-beta-banner__content">
        <span class="android-beta-banner__message"></span>
        <a class="android-beta-banner__link" data-web-download-link href="https://github.com/mac8875/Skysbridge/releases/latest/download/skysbridge-android.apk" target="_blank" rel="noopener">
          <span class="android-beta-banner__action"></span><svg class="android-beta-banner__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.1 4.3 5.7 1.9a.6.6 0 0 1 1-.6l1.5 2.5a8.3 8.3 0 0 1 7.6 0l1.5-2.5a.6.6 0 0 1 1 .6l-1.4 2.4A7.8 7.8 0 0 1 21 11H3a7.8 7.8 0 0 1 4.1-6.7ZM8 7.8a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Zm8 0a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6ZM3 12h18v6.5a1.5 1.5 0 0 1-1.5 1.5H18v2a1 1 0 0 1-2 0v-2H8v2a1 1 0 0 1-2 0v-2h-1.5A1.5 1.5 0 0 1 3 18.5V12Zm-2 1a1 1 0 0 1 2 0v4a1 1 0 0 1-2 0v-4Zm20 0a1 1 0 0 1 2 0v4a1 1 0 0 1-2 0v-4Z"/></svg>
        </a>
      </div>
      <button class="android-beta-banner__close" type="button" aria-label=""></button>
    `;
    banner.querySelector('.android-beta-banner__message').textContent = copy.message;
    banner.querySelector('.android-beta-banner__action').textContent = copy.action;
    const close = banner.querySelector('.android-beta-banner__close');
    close.setAttribute('aria-label', copy.dismiss);
    close.textContent = '×';
    close.addEventListener('click', () => {
      try {
        window.localStorage.setItem('skysbridge-android-beta-banner-dismissed', String(Date.now()));
      } catch (_) {}
      banner.remove();
    });

    const header = document.querySelector('.site-header');
    if (header) header.insertAdjacentElement('afterend', banner);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showAndroidBetaBanner, { once: true });
  } else {
    showAndroidBetaBanner();
  }
})();
