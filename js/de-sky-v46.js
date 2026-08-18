// SKYBRIDGE V46 — robust German Sky modal handler
(() => {
  const modal = document.querySelector('#modal');
  const modalContent = document.querySelector('#modalContent');
  const modalCard = modal?.querySelector('.modal-card');

  if (!modal || !modalContent) return;

  const story = [
    'Als ich von Sky erfuhr, war das der glücklichste Moment meines Lebens. Ihn wieder gehen lassen zu müssen, wurde zu meinem tiefsten Schmerz.',
    'Sky war nur kurze Zeit bei uns, und doch hat er unser Leben für immer verändert. Durch ihn haben wir verstanden, dass Liebe nicht in Jahren gemessen wird, sondern in der Tiefe der Verbindung, die bleibt.',
    'Nach seinem Tod haben wir erlebt, wie still und einsam Trauer werden kann. Viele Eltern tragen ihren Schmerz allein, weil sie glauben, niemand könne wirklich verstehen, was sie verloren haben.',
    'Aus der Liebe zu Sky entstand Skysbridge: ein würdevoller Ort, an dem Kinder, die viel zu früh gehen mussten, einen Namen, einen Stern und einen sichtbaren Platz in unserer Erinnerung behalten.',
    'Sky ist der erste Stern auf unserer Sternenwand. Sein Licht steht am Anfang eines Ortes, an dem die Geschichten vieler Kinder weiterleuchten dürfen.'
  ];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[char]);
  }

  function openSky() {
    const storyHtml = story.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('');

    modalContent.innerHTML = `
      <article class="star-remembrance">
        <header class="star-remembrance-header">
          <p class="eyebrow">Ein Licht, das bleibt</p>
          <span class="star-remembrance-symbol" aria-hidden="true">
            <img src="assets/memorial-star.svg" alt="">
          </span>
          <h2 id="modalTitle">Sky</h2>
          <p class="star-remembrance-subtitle">Sein Leben war kurz. Sein Licht bleibt.</p>
        </header>

        <div class="star-story-copy">
          ${storyHtml}
        </div>

        <div class="star-story-divider" aria-hidden="true">
          <span>✦</span>
        </div>

        <section class="memory-section" aria-labelledby="memoryHeading">
          <p class="eyebrow">Persönliche Worte</p>
          <h3 id="memoryHeading">Eine Erinnerung an Sky teilen</h3>
          <p class="memory-intro">
            Du kannst hier ein paar persönliche Worte hinterlassen. Sie bleiben zunächst privat und werden vor einer möglichen Veröffentlichung sorgfältig geprüft.
          </p>

          <form class="form-grid memory-form" id="memoryForm">
            <label>Dein Name
              <input name="author_name" maxlength="80" autocomplete="name" required>
            </label>
            <label>Deine persönlichen Worte
              <textarea name="message" maxlength="800" required></textarea>
            </label>
            <button class="button button-gold" type="submit">Zur Prüfung senden</button>
            <div class="notice memory-notice" id="memoryStatus">
              Deine Nachricht wird erst nach einer sorgfältigen Prüfung sichtbar.
            </div>
          </form>
        </section>
      </article>
    `;

    if (modalCard) {
      modalCard.className = 'modal-card star-modal-card';
      modalCard.scrollTop = 0;
    }

    modal.hidden = false;
    modal.style.removeProperty('display');
    document.body.style.overflow = 'hidden';
  }

  function closeSky() {
    modal.hidden = true;
    modal.style.setProperty('display', 'none', 'important');
    document.body.style.overflow = '';
    if (modalCard) {
      modalCard.className = 'modal-card';
      modalCard.scrollTop = 0;
    }
    modalContent.innerHTML = '';
  }

  // Capture phase guarantees Sky opens even if the older German app script fails.
  document.querySelectorAll('[data-star="sky"]').forEach(element => {
    element.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openSky();
    }, true);
  });

  document.querySelector('.modal-close')?.addEventListener('click', closeSky);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeSky();
  });
})();
