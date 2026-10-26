(() => {
  "use strict";

  const wall = document.querySelector(".celestial-wall");
  if (!wall) return;

  const LAYER_SETTINGS_KEY = "skysbridge.sky-layers.v1";
  const layerToggles = [...document.querySelectorAll("[data-sky-layer-toggle]")];
  const layerSettings = { planets: false, comets: false, rotateStars: false };
  const rotationToggle = document.querySelector("[data-sky-rotation-toggle]");
  try {
    const savedSettings = JSON.parse(localStorage.getItem(LAYER_SETTINGS_KEY) || "{}");
    for (const key of Object.keys(layerSettings)) layerSettings[key] = savedSettings[key] === true;
  } catch {}

  const canvas = document.createElement("canvas");
  canvas.className = "sky-three-d-layer";
  canvas.setAttribute("aria-hidden", "true");
  wall.prepend(canvas);

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  let width = 0;
  let height = 0;
  let animationFrame = 0;
  let previousTime = 0;
  let motionX = 0;
  let motionY = 0;
  let comet = null;
  let nextCometAt = performance.now() + 2500;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rotationToggle) rotationToggle.disabled = reducedMotion;
  let seed = 773;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  function applyLayerSettings() {
    wall.dataset.showPlanets = String(layerSettings.planets);
    wall.dataset.showComets = String(layerSettings.comets);
    wall.dataset.rotateStars = String(layerSettings.rotateStars);
    layerToggles.forEach(toggle => {
      const key = toggle.dataset.skyLayerToggle;
      if (key in layerSettings) toggle.checked = layerSettings[key];
    });
    if (rotationToggle) rotationToggle.setAttribute("aria-pressed", String(layerSettings.rotateStars));
    try { localStorage.setItem(LAYER_SETTINGS_KEY, JSON.stringify(layerSettings)); } catch {}
    if (reducedMotion) draw(0);
  }

  layerToggles.forEach(toggle => {
    toggle.addEventListener("change", () => {
      const key = toggle.dataset.skyLayerToggle;
      if (!(key in layerSettings)) return;
      layerSettings[key] = toggle.checked;
      if (key === "comets" && !toggle.checked) comet = null;
      if (key === "comets" && toggle.checked) nextCometAt = performance.now() + 10000;
      applyLayerSettings();
    });
  });

  rotationToggle?.addEventListener("click", () => {
    layerSettings.rotateStars = !layerSettings.rotateStars;
    applyLayerSettings();
  });

  const stars = Array.from({ length: 176 }, () => ({
    x: random() * 2 - 1,
    y: random() * 2 - 1,
    z: .2 + random() * 1.8,
    size: .45 + random() * 1.25,
    alpha: .2 + random() * .66,
    tint: random() > .78 ? "#f5e5bf" : random() > .48 ? "#c9e3fa" : "#ffffff"
  }));

  const objects = [
    { name: "Mercury", x: .64, y: -.57, z: .65, radius: 3, color: "#b5a89d" },
    { name: "Venus", x: -.52, y: .48, z: .73, radius: 5, color: "#f6dca2", glow: "#d6a85f" },
    { name: "Mars", x: .72, y: .47, z: .62, radius: 4.5, color: "#d77d63", glow: "#ba604b" },
    { name: "Jupiter", x: .78, y: -.14, z: 1.05, radius: 10, color: "#e8c9a3", glow: "#b98358", banded: true },
    { name: "Saturn", x: -.78, y: .04, z: .78, radius: 8, color: "#e7d2a2", glow: "#b79c6d", ringed: true },
    { name: "Uranus", x: .24, y: .72, z: .55, radius: 4, color: "#b3dadd" },
    { name: "Neptune", x: .16, y: -.75, z: .52, radius: 4, color: "#7799df" }
  ];

  function resize() {
    const bounds = wall.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(0);
  }

  function project(x, y, z, time = 0) {
    const depth = z + .42;
    const scale = Math.min(width, height) * .72 / depth;
    const drift = reducedMotion ? 0 : Math.sin(time * .00012 + z * 2) * 2;
    return {
      x: width / 2 + (x + motionX * .045) * scale + drift,
      y: height / 2 + (y + motionY * .04) * scale - drift * .35,
      scale
    };
  }

  function drawStar(star, time) {
    const point = project(star.x, star.y, star.z, time);
    if (point.x < -3 || point.x > width + 3 || point.y < -3 || point.y > height + 3) return;
    const radius = Math.max(.35, star.size * (1.42 / (star.z + .42)));
    const shimmer = reducedMotion ? 1 : .72 + .28 * Math.sin(time * .001 + star.x * 16 + star.y * 9);
    context.globalAlpha = star.alpha * shimmer;
    context.fillStyle = star.tint;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawObject(object, time) {
    const point = project(object.x, object.y, object.z, time);
    const radius = object.radius * Math.max(.78, Math.min(1.3, point.scale / (Math.min(width, height) * .72)));
    const glow = context.createRadialGradient(point.x, point.y, radius * .25, point.x, point.y, radius * 3.2);
    glow.addColorStop(0, `${object.glow || object.color}44`);
    glow.addColorStop(1, "#00000000");
    context.globalAlpha = .78;
    context.fillStyle = glow;
    context.beginPath();
    context.arc(point.x, point.y, radius * 3.2, 0, Math.PI * 2);
    context.fill();

    const sphere = context.createRadialGradient(point.x - radius * .38, point.y - radius * .42, radius * .08, point.x, point.y, radius);
    sphere.addColorStop(0, "#fff2ce");
    sphere.addColorStop(.45, object.color);
    sphere.addColorStop(1, object.glow || object.color);
    context.globalAlpha = .92;
    context.fillStyle = sphere;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();

    if (object.banded) {
      context.globalAlpha = .17;
      context.strokeStyle = "#9f785c";
      context.lineWidth = 1.2;
      context.beginPath();
      context.ellipse(point.x, point.y + radius * .05, radius * .9, radius * .22, 0, .2, Math.PI - .2);
      context.stroke();
    }
    if (object.ringed) {
      context.globalAlpha = .68;
      context.strokeStyle = "#d8c18b";
      context.lineWidth = Math.max(1.3, radius * .22);
      context.beginPath();
      context.ellipse(point.x, point.y, radius * 1.8, radius * .62, -.24, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = .9;
      context.fillStyle = sphere;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  function launchComet(time) {
    const edge = Math.floor(random() * 4);
    const margin = 32;
    let x;
    let y;
    let angle;
    if (edge === 0) {
      x = -margin;
      y = random() * height;
      angle = (random() - .5) * Math.PI * .56;
    } else if (edge === 1) {
      x = width + margin;
      y = random() * height;
      angle = Math.PI + (random() - .5) * Math.PI * .56;
    } else if (edge === 2) {
      x = random() * width;
      y = -margin;
      angle = Math.PI / 2 + (random() - .5) * Math.PI * .56;
    } else {
      x = random() * width;
      y = height + margin;
      angle = -Math.PI / 2 + (random() - .5) * Math.PI * .56;
    }
    const duration = 1700 + random() * 900;
    const distance = Math.hypot(width, height) * (.76 + random() * .34);
    comet = {
      x, y,
      vx: Math.cos(angle) * distance / duration,
      vy: Math.sin(angle) * distance / duration,
      startedAt: time,
      duration,
      tailLength: Math.max(64, Math.min(width, height) * (.18 + random() * .12)),
      color: random() > .5 ? "#fff2c7" : "#d7ecff"
    };
    nextCometAt = time + 10000;
  }

  function drawComet(time) {
    if (!time) return;
    if (comet && time >= comet.startedAt + comet.duration) comet = null;
    if (!comet && time >= nextCometAt) launchComet(time);
    if (!comet) return;

    const progress = Math.max(0, Math.min(1, (time - comet.startedAt) / comet.duration));
    const headX = comet.x + comet.vx * (time - comet.startedAt);
    const headY = comet.y + comet.vy * (time - comet.startedAt);
    const speed = Math.hypot(comet.vx, comet.vy);
    const tailX = headX - comet.vx / speed * comet.tailLength;
    const tailY = headY - comet.vy / speed * comet.tailLength;
    const fade = Math.min(1, progress * 5, (1 - progress) * 5);
    const trail = context.createLinearGradient(tailX, tailY, headX, headY);
    trail.addColorStop(0, "#ffffff00");
    trail.addColorStop(.72, `${comet.color}55`);
    trail.addColorStop(1, `${comet.color}ee`);

    context.save();
    context.globalCompositeOperation = "lighter";
    context.globalAlpha = fade;
    context.lineCap = "round";
    context.strokeStyle = trail;
    context.lineWidth = 3.2;
    context.beginPath();
    context.moveTo(tailX, tailY);
    context.lineTo(headX, headY);
    context.stroke();

    const glow = context.createRadialGradient(headX, headY, 0, headX, headY, 17);
    glow.addColorStop(0, "#ffffffee");
    glow.addColorStop(.22, `${comet.color}cc`);
    glow.addColorStop(1, "#ffffff00");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(headX, headY, 17, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function draw(time) {
    context.clearRect(0, 0, width, height);
    const orderedStars = stars.slice().sort((a, b) => b.z - a.z);
    orderedStars.forEach(star => drawStar(star, time));
    if (layerSettings.planets) objects.forEach(object => drawObject(object, time));
    if (layerSettings.comets) drawComet(time);
    context.globalAlpha = 1;
  }

  function animate(time) {
    if (document.hidden) {
      animationFrame = 0;
      return;
    }
    if (time - previousTime > 32) {
      draw(time);
      previousTime = time;
    }
    animationFrame = window.requestAnimationFrame(animate);
  }

  function start() {
    if (reducedMotion || document.hidden || animationFrame) return;
    animationFrame = window.requestAnimationFrame(animate);
  }

  function stop() {
    if (!animationFrame) return;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  wall.addEventListener("pointermove", event => {
    const bounds = wall.getBoundingClientRect();
    motionX = ((event.clientX - bounds.left) / bounds.width - .5) * 2;
    motionY = ((event.clientY - bounds.top) / bounds.height - .5) * 2;
    if (reducedMotion) draw(0);
  }, { passive: true });
  wall.addEventListener("pointerleave", () => { motionX = motionY = 0; }, { passive: true });
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  window.addEventListener("resize", resize, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(wall);
  resize();
  applyLayerSettings();
  start();
})();
