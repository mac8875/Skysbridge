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
})();
