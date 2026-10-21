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
          <span class="android-beta-banner__action"></span><span aria-hidden="true">↗</span>
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
