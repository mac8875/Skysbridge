(() => {
  "use strict";

  function setupWallFullscreen() {
    const wall = document.querySelector("#memorialGrid");
    const toggle = wall?.querySelector("[data-wall-fullscreen-toggle]");
    const label = toggle?.querySelector("[data-wall-fullscreen-label]");
    if (!wall || !toggle) return;

    const expandLabel = toggle.getAttribute("aria-label") || "Expand map";
    const closeLabel = document.documentElement.lang === "de"
      ? "Vollbild schließen"
      : document.documentElement.lang === "es"
        ? "Cerrar pantalla completa"
        : "Close full-screen map";
    let previousFocus = null;
    let previousScrollY = 0;
    let originalParent = null;
    let originalNextSibling = null;

    function refreshLayout() {
      const stars = [...wall.querySelectorAll(".memorial-card")];
      const center = stars.find(star => star.classList.contains("is-viewer-center"))
        || stars.find(star => star.dataset.star === "sky")
        || stars[0];
      window.SkysbridgeSkyMap?.layout(stars, center, wall);
    }

    function setExpanded(expanded) {
      if (expanded === wall.classList.contains("is-fullscreen")) return;
      if (expanded) {
        previousFocus = document.activeElement;
        previousScrollY = window.scrollY;
        originalParent = wall.parentNode;
        originalNextSibling = wall.nextSibling;
        document.body.appendChild(wall);
        wall.classList.add("is-fullscreen");
        document.documentElement.classList.add("wall-fullscreen-open");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", closeLabel);
        toggle.setAttribute("title", closeLabel);
        if (label) label.textContent = closeLabel;
        requestAnimationFrame(() => {
          refreshLayout();
          toggle.focus({ preventScroll: true });
        });
      } else {
        wall.classList.remove("is-fullscreen");
        document.documentElement.classList.remove("wall-fullscreen-open");
        if (originalParent?.isConnected) {
          const insertionPoint = originalNextSibling?.parentNode === originalParent ? originalNextSibling : null;
          originalParent.insertBefore(wall, insertionPoint);
        }
        originalParent = null;
        originalNextSibling = null;
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", expandLabel);
        toggle.setAttribute("title", expandLabel);
        if (label) label.textContent = expandLabel;
        window.scrollTo(0, previousScrollY);
        requestAnimationFrame(refreshLayout);
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      }
    }

    toggle.addEventListener("click", event => {
      event.stopPropagation();
      setExpanded(!wall.classList.contains("is-fullscreen"));
    });
    wall.addEventListener("pointerup", event => {
      const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.());
      if (!isNativeApp || !wall.classList.contains("is-fullscreen")) return;
      const card = event.target instanceof Element ? event.target.closest(".memorial-card") : null;
      if (!card || card.disabled) return;

      // Android WebView can omit the synthesized click after fullscreen touch gestures.
      // Let the normal button click run first; only provide a fallback if no detail modal opened.
      window.setTimeout(() => {
        const detailModal = document.querySelector("#modal");
        if (card.isConnected && detailModal?.hidden) card.click();
      }, 0);
    }, { capture: true, passive: true });
    wall.addEventListener("click", event => {
      if (event.target.closest(".memorial-card, [data-wall-fullscreen-toggle]")) return;
      setExpanded(!wall.classList.contains("is-fullscreen"));
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && wall.classList.contains("is-fullscreen")) {
        event.preventDefault();
        setExpanded(false);
      }
    });
    window.addEventListener("resize", () => requestAnimationFrame(refreshLayout), { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupWallFullscreen, { once: true });
  } else {
    setupWallFullscreen();
  }
})();
