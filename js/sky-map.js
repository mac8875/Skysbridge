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

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 580;
    const centerX = 50;
    const centerY = 50;
    center.style.setProperty("--star-x", `${centerX}%`);
    center.style.setProperty("--star-y", `${centerY}%`);

    const satellites = stars.filter(card => card !== center);
    if (!satellites.length) return;

    const radiusX = Math.max(48, Math.min(width * 0.30, width / 2 - 70));
    const radiusY = Math.max(68, Math.min(height * 0.27, height / 2 - 70));
    const perRing = 6;

    satellites.forEach((card, index) => {
      const ring = Math.floor(index / perRing);
      const ringStart = ring * perRing;
      const ringCount = Math.min(perRing, satellites.length - ringStart);
      const slot = index - ringStart;
      const angle = -Math.PI / 2 + (Math.PI * 2 * slot) / ringCount + ring * 0.18;
      const spread = Math.min(1, 0.72 + ring * 0.22);
      const x = Math.max(13, Math.min(87, centerX + (Math.cos(angle) * radiusX * spread / width) * 100));
      const y = Math.max(17, Math.min(83, centerY + (Math.sin(angle) * radiusY * spread / height) * 100));
      card.style.setProperty("--star-x", `${x.toFixed(2)}%`);
      card.style.setProperty("--star-y", `${y.toFixed(2)}%`);
    });
  }

  window.SkysbridgeSkyMap = { layout };
})();
