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

    const satellites = stars.filter(card => card !== center);
    if (!satellites.length) return;

    const positions = [
      [72, 34], [76, 62], [25, 66], [19, 35], [87, 43], [61, 76],
      [35, 79], [31, 24], [90, 72], [12, 56], [66, 19], [44, 88]
    ];
    const centerIsSky = center.dataset.star === "sky";

    satellites.forEach((card, index) => {
      const positionIndex = centerIsSky
        ? index
        : card.dataset.star === "sky"
          ? 0
          : index + 1;
      const [x, y] = positions[positionIndex % positions.length];
      card.style.setProperty("--star-x", `${x}%`);
      card.style.setProperty("--star-y", `${y}%`);
    });
  }

  window.SkysbridgeSkyMap = { layout };
})();
