(() => {
  const capacitor = window.Capacitor;
  const isNative = Boolean(
    capacitor?.isNativePlatform?.() ||
    ['android', 'ios'].includes(capacitor?.getPlatform?.())
  );
  if (isNative) document.documentElement.classList.add('native-app');
})();
