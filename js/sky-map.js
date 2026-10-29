(() => {
  "use strict";

  function positionLeoConstellation(container) {
    const sky = container.querySelector('[data-star="sky"]');
    const constellation = container.querySelector("[data-leo-constellation]");
    if (!sky || !constellation) return;
    const wallRect = container.getBoundingClientRect();
    const skyRect = sky.getBoundingClientRect();
    if (!wallRect.width || !wallRect.height || !skyRect.width || !skyRect.height) return;
    const x = ((skyRect.left + skyRect.width / 2 - wallRect.left) / wallRect.width) * 100;
    const y = ((skyRect.top + skyRect.height / 2 - wallRect.top) / wallRect.height) * 100;
    const scale = Math.max(.25, Math.min(1.05, x / 13, (100 - x) / 40, y / 27, (100 - y) / 14));
    constellation.setAttribute("transform", `translate(${x} ${y}) scale(${scale}) translate(-50 -50)`);
  }

  function layout(cards, preferredCenter, plane) {
    const container = plane || preferredCenter?.closest(".celestial-wall") || document.querySelector(".celestial-wall");
    if (!container) return;

    const stars = [...new Set(cards || [])].filter(card => card && container.contains(card));
    const center = preferredCenter && stars.includes(preferredCenter)
      ? preferredCenter
      : preferredCenter && container.contains(preferredCenter)
        ? preferredCenter
        : stars[0];
    if (!center) return;

    const centerX = 50;
    const centerY = 50;
    center.style.setProperty("--star-x", `${centerX}%`);
    center.style.setProperty("--star-y", `${centerY}%`);
    positionLeoConstellation(container);
    container.style.setProperty("--wall-extra-height", "0px");

    const satellites = stars.filter(card => card !== center);
    if (!satellites.length) {
      positionLeoConstellation(container);
      return;
    }

    const positions = [
      [72, 34], [76, 62], [25, 66], [19, 35], [87, 43], [61, 76],
      [35, 79], [31, 24], [90, 72], [12, 56], [66, 19], [44, 88]
    ];
    const viewportWidth = window.innerWidth || container.clientWidth;
    const planeWidth = container.clientWidth || viewportWidth;
    const fullscreen = container.classList.contains("is-fullscreen");
    const availableHeight = container.clientHeight || window.innerHeight;
    const nativeApp = Boolean(window.Capacitor?.isNativePlatform?.());
    const websiteFullscreen = fullscreen && !nativeApp;
    const baseHeight = fullscreen
      ? Math.max(630, availableHeight)
      : viewportWidth <= 760
        ? 630
        : Math.max(620, Math.min(770, viewportWidth * .66));
    const labelWidth = Math.min(230, viewportWidth * .5 - 18);
    const edgePadding = 12;
    const minX = Math.min(50, (labelWidth / 2 + edgePadding) / planeWidth * 100);
    const maxX = 100 - minX;
    const centerIsSky = center.dataset.star === "sky";

    satellites.forEach((card, index) => {
      const positionIndex = centerIsSky
        ? index
        : card.dataset.star === "sky"
          ? 0
          : index + 1;
      const label = card.querySelector("strong");

      if (websiteFullscreen) {
        // Spread memorial stars evenly through the viewport instead of stacking
        // additional rows below the visible portion of the expanded map.
        const radius = Math.sqrt((index + 0.5) / satellites.length) * 0.9;
        const angle = index * 2.399963229728653 + Math.PI / 4;
        const x = 50 + Math.cos(angle) * 44 * radius;
        const y = 50 + Math.sin(angle) * 43 * radius;
        const placedX = label ? Math.max(minX, Math.min(maxX, x)) : x;
        card.style.setProperty("--star-x", `${placedX}%`);
        card.style.setProperty("--star-y", `${y}%`);
        return;
      }

      const cycle = Math.floor(positionIndex / positions.length);
      const [x, baseY] = positions[positionIndex % positions.length];
      const y = (23 + (baseY - 19) * .78) / 100 * baseHeight + cycle * 400;
      const placedX = label ? Math.max(minX, Math.min(maxX, x)) : x;
      card.style.setProperty("--star-x", `${placedX}%`);
      card.style.setProperty("--star-y", `${y}px`);
    });

    const extraHeight = websiteFullscreen
      ? 0
      : Math.max(0, Math.ceil(satellites.length / positions.length) - 1) * 560;
    container.style.setProperty("--wall-extra-height", `${extraHeight}px`);
    positionLeoConstellation(container);
  }

  window.SkysbridgeSkyMap = { layout };
})();
