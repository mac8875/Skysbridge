(() => {
  const wall = document.querySelector('.celestial-wall');
  if (!wall) return;

  let plane = wall.querySelector('.celestial-plane');
  if (!plane) {
    plane = document.createElement('div');
    plane.className = 'celestial-plane';
    const existingContent = [...wall.childNodes];
    wall.appendChild(plane);
    plane.append(...existingContent);
  }

  const language = document.documentElement.lang.toLowerCase();
  wall.setAttribute('role', 'region');
  wall.setAttribute('tabindex', '0');
  wall.setAttribute('aria-label', language.startsWith('de')
    ? 'Sternenkarte – vertikal scrollbar'
    : language.startsWith('es')
      ? 'Mapa estelar: desplázate verticalmente'
      : 'Star map – scroll vertically');
  const hintText = language.startsWith('de')
    ? 'Zum Erkunden nach unten scrollen'
    : language.startsWith('es')
      ? 'Desliza para explorar el cielo'
      : 'Scroll to explore the sky';
  const hint = document.createElement('div');
  hint.className = 'sky-map-scroll-hint';
  hint.setAttribute('role', 'note');
  hint.innerHTML = `<span class="sky-map-scroll-arrow">↓</span>${hintText}`;
  wall.insertBefore(hint, plane);

  let seed = 8875;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const addAmbientStar = (className, x, y, size, alpha, duration, delay, warmth) => {
    const star = document.createElement('span');
    star.className = className;
    star.setAttribute('aria-hidden', 'true');
    star.style.setProperty('--x', `${x.toFixed(2)}%`);
    star.style.setProperty('--y', `${y.toFixed(2)}%`);
    star.style.setProperty('--size', `${size.toFixed(2)}px`);
    star.style.setProperty('--alpha', alpha.toFixed(2));
    star.style.setProperty('--duration', `${duration.toFixed(2)}s`);
    star.style.setProperty('--delay', `${delay.toFixed(2)}s`);
    star.style.setProperty('--warmth', warmth);
    plane.appendChild(star);
  };

  for (let index = 0; index < 118; index += 1) {
    const size = random() < .82 ? .7 + random() * 1.25 : 2 + random() * 1.8;
    addAmbientStar(
      'ambient-star', random() * 100, random() * 100, size,
      .28 + random() * .66, 3.8 + random() * 7.4, -random() * 9,
      random() > .82 ? '#f7e4b0' : random() > .55 ? '#d9ecff' : '#ffffff'
    );
  }

  for (let index = 0; index < 72; index += 1) {
    const x = random() * 112 - 6;
    const center = 82 - x * .58;
    const spread = random() < .78 ? 9 : 16;
    addAmbientStar(
      'ambient-star milky-star', x, center + (random() - .5) * spread,
      .5 + random() * 1.25, .22 + random() * .5,
      5.5 + random() * 8, -random() * 10,
      random() > .74 ? '#f3e6c5' : '#dfefff'
    );
  }

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-map-entering');
        revealObserver.unobserve(entry.target);
      }
    }, { root: wall, rootMargin: '0px 0px -8% 0px', threshold: .12 })
    : null;

  const observeStar = card => {
    if (revealObserver) revealObserver.observe(card);
    else card.classList.add('is-map-entering');
  };

  const layout = (cards = [], skyCard = null, viewerCenterId = null) => {
    const mobile = window.matchMedia('(max-width: 700px)').matches;
    const columns = mobile ? 1 : 3;
    const xPositions = mobile ? [64, 36, 62, 38, 65, 42] : [20, 50, 80];
    const viewerCard = cards.find(card => card.dataset.publicMemorial === String(viewerCenterId));
    const otherCards = cards.filter(card => card !== viewerCard);
    const topStart = viewerCard ? (mobile ? 625 : 610) : (mobile ? 390 : 365);
    const rowGap = mobile ? 245 : 260;
    const rowCount = Math.max(1, Math.ceil(otherCards.length / columns));
    const sceneHeight = Math.max(mobile ? 820 : 800, topStart + rowCount * rowGap + 110);
    plane.style.setProperty('--map-scene-height', `${sceneHeight}px`);

    if (skyCard) {
      skyCard.style.setProperty('--star-x', viewerCard ? '78%' : '50%');
      skyCard.style.setProperty('--star-y', mobile ? '170px' : '175px');
    }
    if (viewerCard) {
      viewerCard.style.setProperty('--star-x', '50%');
      viewerCard.style.setProperty('--star-y', mobile ? '390px' : '380px');
    }

    otherCards.forEach((card, index) => {
      const row = Math.floor(index / columns);
      const column = mobile ? index % xPositions.length : index % columns;
      card.style.setProperty('--star-x', `${xPositions[column]}%`);
      card.style.setProperty('--star-y', `${topStart + row * rowGap}px`);
    });

    cards.forEach(observeStar);
    if (skyCard) observeStar(skyCard);
  };

  let scrollTimer;
  wall.addEventListener('scroll', () => {
    wall.classList.add('is-scrolling');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => wall.classList.remove('is-scrolling'), 220);
  }, { passive: true });

  window.SkysbridgeSkyMap = {
    init: () => {},
    layout,
    plane,
  };
})();
