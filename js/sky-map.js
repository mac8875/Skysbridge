(() => {
  "use strict";

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
    container.style.setProperty("--wall-extra-height", "0px");

    const satellites = stars.filter(card => card !== center);
    if (!satellites.length) return;

    const positions = [
      [72, 34], [76, 62], [25, 66], [19, 35], [87, 43], [61, 76],
      [35, 79], [31, 24], [90, 72], [12, 56], [66, 19], [44, 88]
    ];
    const viewportWidth = window.innerWidth || container.clientWidth;
    const planeWidth = container.clientWidth || viewportWidth;
    const fullscreen = container.classList.contains("is-fullscreen");
    const availableHeight = container.clientHeight || window.innerHeight;
    const baseHeight = fullscreen
      ? Math.max(630, availableHeight * 1.15)
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
      const cycle = Math.floor(positionIndex / positions.length);
      const [x, baseY] = positions[positionIndex % positions.length];
      const y = (23 + (baseY - 19) * .78) / 100 * baseHeight + cycle * 400;
      const label = card.querySelector("strong");
      const placedX = label ? Math.max(minX, Math.min(maxX, x)) : x;
      card.style.setProperty("--star-x", `${placedX}%`);
      card.style.setProperty("--star-y", `${y}px`);
    });

    const extraHeight = Math.max(0, Math.ceil(satellites.length / positions.length) - 1) * 560;
    container.style.setProperty("--wall-extra-height", `${extraHeight}px`);
  }

  window.SkysbridgeSkyMap = { layout };
})();
