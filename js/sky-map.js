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

  function positionAquariusConstellation(container) {
    const constellation = container.querySelector("[data-aquarius-constellation]");
    if (!constellation) return;
    const wallRect = container.getBoundingClientRect();
    if (!wallRect.width || !wallRect.height) return;

    const stars = [...container.querySelectorAll(".memorial-card")].map(star => {
      const rect = star.getBoundingClientRect();
      return {
        x: ((rect.left + rect.width / 2 - wallRect.left) / wallRect.width) * 100,
        y: ((rect.top + rect.height / 2 - wallRect.top) / wallRect.height) * 100
      };
    });
    const candidates = [
      { x: 14, y: 14 }, { x: 86, y: 14 }, { x: 14, y: 86 }, { x: 86, y: 86 },
      { x: 50, y: 14 }, { x: 50, y: 86 }, { x: 14, y: 50 }, { x: 86, y: 50 }
    ];
    const position = candidates
      .map(candidate => ({
        ...candidate,
        clearance: stars.length
          ? Math.min(...stars.map(star => Math.hypot(
              (candidate.x - star.x) * wallRect.width,
              (candidate.y - star.y) * wallRect.height
            )))
          : Infinity
      }))
      .sort((a, b) => b.clearance - a.clearance)[0];

    const { x, y } = position;
    const scale = Math.max(.24, Math.min(.52, x / 27, (100 - x) / 34, y / 24, (100 - y) / 28));
    constellation.setAttribute("transform", `translate(${x} ${y}) scale(${scale}) translate(-50 -50)`);
  }


  const FEATURED_STARS = [
    { id: "morning", symbol: "✦", labels: { en: "Morning Star", de: "Morgenstern", es: "Lucero del alba" } },
    { id: "evening", symbol: "✧", labels: { en: "Evening Star", de: "Abendstern", es: "Lucero vespertino" } },
    { id: "heart", symbol: "♥", labels: { en: "Heart Star", de: "Herzensstern", es: "Estrella del corazón" } },
    { id: "spark", symbol: "✧", labels: { en: "Spark Star", de: "Funkenstern", es: "Estrella chispeante" } }
  ];

  const FEATURED_STAR_ANCHORS = [
    [12, 15], [88, 15], [12, 85], [88, 85],
    [32, 14], [68, 14], [32, 86], [68, 86],
    [10, 50], [90, 50], [50, 14], [50, 86]
  ];

  function ensureFeaturedStars(container) {
    if (container.querySelector(".featured-celestial-stars")) return;
    if (!document.querySelector("#featured-celestial-stars-style")) {
      const style = document.createElement("style");
      style.id = "featured-celestial-stars-style";
      style.textContent = `
        .celestial-wall { position: relative; }
        .featured-celestial-star {
          position: absolute;
          z-index: 1;
          display: grid;
          justify-items: center;
          gap: 3px;
          width: 104px;
          transform: translate(-50%, -50%);
          pointer-events: none;
          user-select: none;
          opacity: .86;
          text-align: center;
          filter: drop-shadow(0 0 11px var(--featured-glow));
        }
        .featured-celestial-star__glyph {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border: 1px solid color-mix(in srgb, var(--featured-color), transparent 48%);
          border-radius: 50%;
          color: var(--featured-color);
          background: radial-gradient(circle, color-mix(in srgb, var(--featured-color), transparent 83%), rgba(4, 18, 31, .54) 72%);
          box-shadow: 0 0 18px var(--featured-glow), inset 0 0 10px color-mix(in srgb, var(--featured-color), transparent 82%);
          font-size: 20px;
          line-height: 1;
          animation: featured-star-glimmer 4.8s ease-in-out infinite;
        }
        .featured-celestial-star__label {
          color: color-mix(in srgb, var(--featured-color), white 24%);
          font: 500 10px/1.15 Inter, sans-serif;
          letter-spacing: .025em;
          text-shadow: 0 1px 5px #03101a, 0 0 9px #03101a;
          white-space: nowrap;
        }
        .featured-celestial-star--morning { --featured-color: #ffd98a; --featured-glow: rgba(255, 194, 96, .58); }
        .featured-celestial-star--evening { --featured-color: #c8ddff; --featured-glow: rgba(130, 172, 255, .48); }
        .featured-celestial-star--heart { --featured-color: #ffc2c8; --featured-glow: rgba(255, 117, 149, .48); }
        .featured-celestial-star--spark { --featured-color: #fff5d5; --featured-glow: rgba(255, 241, 191, .56); }
        @keyframes featured-star-glimmer {
          0%, 100% { transform: scale(.94); opacity: .84; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .featured-celestial-star__glyph { animation: none; }
        }
        @media (max-width: 520px) {
          .featured-celestial-star { width: 88px; }
          .featured-celestial-star__glyph { width: 25px; height: 25px; font-size: 17px; }
          .featured-celestial-star__label { font-size: 9px; }
        }
      `;
      document.head.append(style);
    }

    const language = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    const layer = document.createElement("div");
    layer.className = "featured-celestial-stars";
    layer.setAttribute("aria-label", language === "de" ? "Besondere Sterne" : language === "es" ? "Estrellas especiales" : "Featured stars");
    layer.setAttribute("role", "group");

    FEATURED_STARS.forEach(star => {
      const item = document.createElement("span");
      item.className = `featured-celestial-star featured-celestial-star--${star.id}`;
      item.dataset.featuredStar = star.id;
      item.setAttribute("role", "img");
      item.setAttribute("aria-label", star.labels[language] || star.labels.en);
      const glyph = document.createElement("span");
      glyph.className = "featured-celestial-star__glyph";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = star.symbol;
      const label = document.createElement("span");
      label.className = "featured-celestial-star__label";
      label.setAttribute("aria-hidden", "true");
      label.textContent = star.labels[language] || star.labels.en;
      item.append(glyph, label);
      layer.append(item);
    });

    container.append(layer);
  }

  function positionFeaturedStars(container) {
    ensureFeaturedStars(container);
    const wallRect = container.getBoundingClientRect();
    if (!wallRect.width || !wallRect.height) return;

    const occupied = [...container.querySelectorAll(".memorial-card")].map(card => {
      const rect = card.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - wallRect.left,
        y: rect.top + rect.height / 2 - wallRect.top
      };
    });
    const placed = [];
    const ornaments = [...container.querySelectorAll(".featured-celestial-star")];
    ornaments.forEach(ornament => {
      const anchor = FEATURED_STAR_ANCHORS
        .map(([x, y]) => {
          const px = wallRect.width * x / 100;
          const py = wallRect.height * y / 100;
          const memorialClearance = occupied.length
            ? Math.min(...occupied.map(point => Math.hypot(px - point.x, py - point.y)))
            : Infinity;
          const ornamentClearance = placed.length
            ? Math.min(...placed.map(point => Math.hypot(px - point.x, py - point.y)))
            : Infinity;
          return { x, y, px, py, clearance: Math.min(memorialClearance, ornamentClearance - 72) };
        })
        .sort((a, b) => b.clearance - a.clearance)[0];
      ornament.style.left = `${anchor.x}%`;
      ornament.style.top = `${anchor.y}%`;
      placed.push({ x: anchor.px, y: anchor.py });
    });
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
    positionAquariusConstellation(container);
    container.style.setProperty("--wall-extra-height", "0px");

    const satellites = stars.filter(card => card !== center);
    if (!satellites.length) {
      positionLeoConstellation(container);
      positionAquariusConstellation(container);
      positionFeaturedStars(container);
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
    const fullscreenViewport = fullscreen;
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

      if (fullscreenViewport) {
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

    const extraHeight = fullscreenViewport
      ? 0
      : Math.max(0, Math.ceil(satellites.length / positions.length) - 1) * 560;
    container.style.setProperty("--wall-extra-height", `${extraHeight}px`);
    positionLeoConstellation(container);
    positionAquariusConstellation(container);
    positionFeaturedStars(container);
  }

  window.SkysbridgeSkyMap = { layout };
})();
