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


  function overlaps(a, b, gap = 0) {
    return a.left < b.right + gap &&
      a.right + gap > b.left &&
      a.top < b.bottom + gap &&
      a.bottom + gap > b.top;
  }

  function layoutWithoutLabelOverlaps(stars, center, container, baseHeight, initialExtra, fullscreen) {
    const wall = container.getBoundingClientRect();
    if (!wall.width || !wall.height) return 0;

    const items = stars.map((card, index) => {
      const cardRect = card.getBoundingClientRect();
      const cx = cardRect.left + cardRect.width / 2 - wall.left;
      const cy = cardRect.top + cardRect.height / 2 - wall.top;
      const label = card.querySelector("strong");
      const labelRect = label?.getBoundingClientRect() || cardRect;
      const symbol = card.querySelector(".memorial-symbol") || card.querySelector(".sky-symbol") || card;
      const symbolRect = symbol.getBoundingClientRect();
      return {
        card,
        index,
        x: cx,
        y: cy,
        isCenter: card === center,
        label: {
          left: labelRect.left - (cardRect.left + cardRect.width / 2),
          right: labelRect.right - (cardRect.left + cardRect.width / 2),
          top: labelRect.top - (cardRect.top + cardRect.height / 2),
          bottom: labelRect.bottom - (cardRect.top + cardRect.height / 2)
        },
        symbol: {
          left: symbolRect.left - (cardRect.left + cardRect.width / 2),
          right: symbolRect.right - (cardRect.left + cardRect.width / 2),
          top: symbolRect.top - (cardRect.top + cardRect.height / 2),
          bottom: symbolRect.bottom - (cardRect.top + cardRect.height / 2)
        }
      };
    });

    const centerItem = items.find(item => item.isCenter);
    if (!centerItem) return 0;

    const occupied = [centerItem];
    const satellites = items
      .filter(item => !item.isCenter)
      .sort((a, b) => {
        const areaA = (a.label.right - a.label.left) * (a.label.bottom - a.label.top);
        const areaB = (b.label.right - b.label.left) * (b.label.bottom - b.label.top);
        return areaB - areaA || a.index - b.index;
      });

    const maxHeight = fullscreen
      ? container.clientHeight
      : baseHeight + initialExtra + Math.max(420, satellites.length * 190);
    const makeRect = (item, kind, x, y) => ({
      left: x + item[kind].left,
      right: x + item[kind].right,
      top: y + item[kind].top,
      bottom: y + item[kind].bottom
    });

    const conflicts = (item, x, y) => {
      const labelRect = makeRect(item, "label", x, y);
      const symbolRect = makeRect(item, "symbol", x, y);
      return occupied.some(other => {
        const otherLabel = makeRect(other, "label", other.x, other.y);
        const otherSymbol = makeRect(other, "symbol", other.x, other.y);
        return overlaps(labelRect, otherLabel, 16) ||
          overlaps(labelRect, otherSymbol, 12) ||
          overlaps(symbolRect, otherLabel, 12) ||
          overlaps(symbolRect, otherSymbol, 18);
      });
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const step = 58;
    satellites.forEach((item, order) => {
      const minX = Math.max(12, 12 - item.label.left);
      const maxX = Math.min(wall.width - 12, wall.width - 12 - item.label.right);
      const minY = Math.max(12, 12 - item.label.top);
      const maxY = Math.min(maxHeight - 12, maxHeight - 12 - item.label.bottom);
      const anchorX = clamp(item.x, minX, maxX);
      const anchorY = clamp(item.y, minY, maxY);
      const candidates = [{ x: anchorX, y: anchorY }];

      for (let ring = 1; ring <= Math.ceil((wall.width + maxHeight) / step); ring += 1) {
        const radius = ring * step;
        for (let point = 0; point < 20; point += 1) {
          const angle = (point / 20) * Math.PI * 2 + order * 2.399963229728653;
          candidates.push({
            x: clamp(anchorX + Math.cos(angle) * radius, minX, maxX),
            y: clamp(anchorY + Math.sin(angle) * radius, minY, maxY)
          });
        }
      }

      let chosen = candidates.find(candidate => !conflicts(item, candidate.x, candidate.y));
      if (!chosen) {
        const columns = Math.max(1, Math.floor((wall.width - 24) / 150));
        for (let row = 0; row < satellites.length + 2 && !chosen; row += 1) {
          for (let column = 0; column < columns && !chosen; column += 1) {
            const candidate = {
              x: clamp(minX + column * 150, minX, maxX),
              y: clamp(baseHeight + initialExtra + row * 150, minY, maxY)
            };
            if (!conflicts(item, candidate.x, candidate.y)) chosen = candidate;
          }
        }
      }

      if (!chosen) chosen = { x: anchorX, y: anchorY };
      item.x = chosen.x;
      item.y = chosen.y;
      item.card.style.setProperty("--star-x", `${chosen.x}px`);
      item.card.style.setProperty("--star-y", `${chosen.y}px`);
      occupied.push(item);
    });

    return Math.max(...occupied.map(item => item.y + item.label.bottom), 0);
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

    const initialExtra = fullscreenViewport
      ? 0
      : Math.max(0, Math.ceil(satellites.length / positions.length) - 1) * 560;
    container.style.setProperty("--wall-extra-height", `${initialExtra}px`);
    const lowestLabel = layoutWithoutLabelOverlaps(
      stars,
      center,
      container,
      baseHeight,
      initialExtra,
      fullscreenViewport
    );
    const collisionExtra = fullscreenViewport
      ? 0
      : Math.max(0, Math.ceil((lowestLabel + 32 - (baseHeight + initialExtra)) / 120)) * 120;
    container.style.setProperty("--wall-extra-height", `${initialExtra + collisionExtra}px`);
    positionLeoConstellation(container);
    positionAquariusConstellation(container);
  }

  window.SkysbridgeSkyMap = { layout };
})();
