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
  let nextCometAt = performance.now() + 5000;
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
      if (key === "comets" && toggle.checked) nextCometAt = performance.now() + 6500;
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
    { name: "Mercury", x: .64, y: -.57, z: .65, radius: 4.2, color: "#aaa49c", glow: "#716e6b", surface: "craters" },
    { name: "Venus", x: -.52, y: .48, z: .73, radius: 6, color: "#e7c98e", glow: "#c49552", surface: "clouds" },
    { name: "Mars", x: .72, y: .47, z: .62, radius: 5.5, color: "#c87559", glow: "#8e4335", surface: "mars" },
    { name: "Jupiter", x: .78, y: -.14, z: 1.05, radius: 11.5, color: "#d9b38e", glow: "#a56d4f", surface: "bands" },
    { name: "Saturn", x: -.78, y: .04, z: .78, radius: 9.5, color: "#dec99a", glow: "#a98b58", ringed: true },
    { name: "Uranus", x: .24, y: .72, z: .55, radius: 5.2, color: "#a8d5da", glow: "#63a9b4" },
    { name: "Neptune", x: .16, y: -.75, z: .52, radius: 5.2, color: "#648ed9", glow: "#365cac" }
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
    const ringRx = radius * 1.92;
    const ringRy = radius * .66;
    if (object.ringed) {
      context.save();
      context.globalAlpha = .74;
      context.strokeStyle = "#c4a975";
      context.lineWidth = Math.max(1, radius * .12);
      context.beginPath();
      context.ellipse(point.x, point.y, ringRx, ringRy, -.25, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = .4;
      context.strokeStyle = "#f0dfb3";
      context.lineWidth = Math.max(.6, radius * .045);
      context.beginPath();
      context.ellipse(point.x, point.y, radius * 1.55, radius * .5, -.25, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    const glow = context.createRadialGradient(point.x, point.y, radius * .3, point.x, point.y, radius * 3.1);
    glow.addColorStop(0, `${object.glow || object.color}3b`);
    glow.addColorStop(1, "#00000000");
    context.globalAlpha = .52;
    context.fillStyle = glow;
    context.beginPath();
    context.arc(point.x, point.y, radius * 3.2, 0, Math.PI * 2);
    context.fill();

    const sphere = context.createRadialGradient(point.x - radius * .38, point.y - radius * .42, radius * .05, point.x, point.y, radius * 1.2);
    sphere.addColorStop(0, "#fff8e8");
    sphere.addColorStop(.25, object.color);
    sphere.addColorStop(.72, object.color);
    sphere.addColorStop(1, object.glow || object.color);
    context.globalAlpha = .98;
    context.fillStyle = sphere;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();

    if (object.surface === "bands" || object.surface === "clouds") {
      context.save();
      context.beginPath();
      context.arc(point.x, point.y, radius * .98, 0, Math.PI * 2);
      context.clip();
      const bands = object.surface === "bands"
        ? [{ y: -.58, w: .13, c: "#8d614e", a: .42 }, { y: -.29, w: .09, c: "#f1d5ae", a: .45 }, { y: .02, w: .16, c: "#9d7058", a: .4 }, { y: .39, w: .1, c: "#f0d9b6", a: .45 }, { y: .66, w: .12, c: "#9a6c55", a: .36 }]
        : [{ y: -.42, w: .11, c: "#fff0ce", a: .25 }, { y: -.08, w: .08, c: "#bf985f", a: .2 }, { y: .3, w: .12, c: "#fff0ce", a: .22 }, { y: .62, w: .08, c: "#bc9158", a: .18 }];
      bands.forEach(band => {
        context.globalAlpha = band.a;
        context.strokeStyle = band.c;
        context.lineWidth = Math.max(1, radius * band.w);
        context.beginPath();
        context.moveTo(point.x - radius, point.y + radius * band.y);
        context.bezierCurveTo(point.x - radius * .32, point.y + radius * (band.y - .1), point.x + radius * .32, point.y + radius * (band.y + .1), point.x + radius, point.y + radius * band.y);
        context.stroke();
      });
      context.restore();
    }

    if (object.surface === "craters" || object.surface === "mars") {
      const craters = object.surface === "mars"
        ? [{ x: -.34, y: .12, r: .16 }, { x: .35, y: -.16, r: .12 }]
        : [{ x: -.28, y: .12, r: .2 }, { x: .32, y: -.18, r: .13 }, { x: .1, y: .48, r: .09 }];
      craters.forEach(crater => {
        context.globalAlpha = .22;
        context.fillStyle = object.glow;
        context.beginPath();
        context.arc(point.x + radius * crater.x, point.y + radius * crater.y, radius * crater.r, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = .18;
        context.strokeStyle = "#fff0dc";
        context.lineWidth = Math.max(.45, radius * .035);
        context.beginPath();
        context.arc(point.x + radius * crater.x - radius * .025, point.y + radius * crater.y - radius * .025, radius * crater.r * .72, Math.PI * 1.05, Math.PI * 1.9);
        context.stroke();
      });
    }

    const terminator = context.createLinearGradient(point.x - radius, point.y, point.x + radius, point.y);
    terminator.addColorStop(0, "#ffffff00");
    terminator.addColorStop(.5, "#07101a08");
    terminator.addColorStop(1, "#07101a66");
    context.globalAlpha = .8;
    context.fillStyle = terminator;
    context.beginPath();
    context.arc(point.x, point.y, radius * .99, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = .24;
    context.fillStyle = "#fff9e9";
    context.beginPath();
    context.ellipse(point.x - radius * .38, point.y - radius * .52, radius * .17, radius * .1, -.5, 0, Math.PI * 2);
    context.fill();

    if (object.ringed) {
      context.globalAlpha = .78;
      context.strokeStyle = "#dbc995";
      context.lineWidth = Math.max(1.1, radius * .13);
      context.beginPath();
      context.ellipse(point.x, point.y, ringRx, ringRy, -.25, Math.PI * .08, Math.PI * .92);
      context.stroke();
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
    const duration = 5200 + random() * 2000;
    const distance = Math.hypot(width, height) * (.86 + random() * .28);
    comet = {
      x, y,
      vx: Math.cos(angle) * distance / duration,
      vy: Math.sin(angle) * distance / duration,
      startedAt: time,
      duration,
      tailLength: Math.max(90, Math.min(width, height) * (.24 + random() * .08)),
      curve: (random() - .5) * 18,
      color: random() > .5 ? "#d9efff" : "#f2dba9"
    };
    nextCometAt = time + 26000 + random() * 12000;
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
    const directionX = comet.vx / speed;
    const directionY = comet.vy / speed;
    const normalX = -directionY;
    const normalY = directionX;
    const tailX = headX - directionX * comet.tailLength;
    const tailY = headY - directionY * comet.tailLength;
    const controlX = headX - directionX * comet.tailLength * .48 + normalX * comet.curve;
    const controlY = headY - directionY * comet.tailLength * .48 + normalY * comet.curve;
    const fade = Math.min(1, progress * 3.5, (1 - progress) * 3.5);
    const trail = context.createLinearGradient(tailX, tailY, headX, headY);
    trail.addColorStop(0, "#ffffff00");
    trail.addColorStop(.34, `${comet.color}18`);
    trail.addColorStop(.78, `${comet.color}66`);
    trail.addColorStop(1, `${comet.color}bb`);

    context.save();
    context.globalCompositeOperation = "lighter";
    context.globalAlpha = fade;
    context.fillStyle = trail;
    context.beginPath();
    context.moveTo(headX + normalX * 5.5, headY + normalY * 5.5);
    context.quadraticCurveTo(controlX + normalX * 2.8, controlY + normalY * 2.8, tailX, tailY);
    context.quadraticCurveTo(controlX - normalX * 2.8, controlY - normalY * 2.8, headX - normalX * 5.5, headY - normalY * 5.5);
    context.closePath();
    context.fill();

    context.lineCap = "round";
    context.strokeStyle = `${comet.color}70`;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(tailX, tailY);
    context.quadraticCurveTo(controlX, controlY, headX - directionX * 4, headY - directionY * 4);
    context.stroke();

    const glow = context.createRadialGradient(headX, headY, 0, headX, headY, 20);
    glow.addColorStop(0, "#ffffffee");
    glow.addColorStop(.22, `${comet.color}dd`);
    glow.addColorStop(1, "#ffffff00");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(headX, headY, 20, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = fade;
    context.fillStyle = "#fffdf4";
    context.beginPath();
    context.arc(headX, headY, 2.1, 0, Math.PI * 2);
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
