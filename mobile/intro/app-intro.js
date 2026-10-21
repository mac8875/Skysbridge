(() => {
  const overlay = document.getElementById('skysbridge-app-intro');
  if (!overlay) return;

  const animation = overlay.querySelector('video');
  let finished = false;
  let fallbackTimer;

  const finishIntro = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallbackTimer);
    overlay.classList.add('is-fading');
    const removeOverlay = () => overlay.remove();
    overlay.addEventListener('transitionend', removeOverlay, { once: true });
    setTimeout(removeOverlay, 950);
  };

  animation.addEventListener('ended', finishIntro, { once: true });
  animation.addEventListener('error', finishIntro, { once: true });
  // The fallback covers devices that suspend video playback before `ended`.
  fallbackTimer = setTimeout(finishIntro, 12000);
  animation.play().catch(finishIntro);
})();
