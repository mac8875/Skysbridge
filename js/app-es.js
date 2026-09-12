// SKYBRIDGE V36 — administrators can manage and delete published memorial stars
(() => {
  const cfg = window.SKYSBRIDGE_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_");

  const db = configured
    ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const roomCopy = {"Newly Bereaved": "Duelo reciente", "A gentle place for the days when everything still feels unreal.": "Un lugar acogedor para los días en que todo parece todavía irreal.", "Fathers' Space": "Espacio para padres", "A protected place for fathers whose grief is too often left unspoken.": "Un lugar protegido para los padres cuyo duelo tantas veces queda en silencio.", "Remembering Together": "Recordar juntos", "A place for names, anniversaries, memories and the rituals that keep love close.": "Un lugar para nombres, aniversarios, recuerdos y rituales que mantienen cerca el amor."};
  const roomText = value => roomCopy[value] || value;
  let currentUser = null;
  let currentProfile = null;
  let activeRoomId = null;

  const modal = document.querySelector("#modal");
  const modalContent = document.querySelector("#modalContent");
  const modalCard = modal?.querySelector(".modal-card");
  const menuButton = document.querySelector(".menu-button");
  const nav = document.querySelector(".main-nav");
  const authButtons = Array.from(document.querySelectorAll("[data-open-auth]"));

  function setHidden(element, hidden) {
    if (!element) return;

    element.hidden = hidden;

    if (hidden) {
      element.style.setProperty("display", "none", "important");
    } else {
      element.style.removeProperty("display");
    }
  }

  function rememberAuthButtonLabels() {
    authButtons.forEach(button => {
      if (!button.dataset.guestLabel) {
        button.dataset.guestLabel = button.textContent.trim();
      }
    });
  }

  function updateAuthButtons(isSignedIn) {
    rememberAuthButtonLabels();

    authButtons.forEach(button => {
      button.textContent = isSignedIn
        ? "Abrir el área de miembros"
        : button.dataset.guestLabel;
    });
  }

  function openMemberArea() {
    nav?.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");

    const memberPanel = document.querySelector("#memberPanel");
    const target =
      memberPanel && !memberPanel.hidden
        ? memberPanel
        : document.querySelector("#community");

    target?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  menuButton?.addEventListener("click", () => {
    nav?.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", nav?.classList.contains("open"));
  });

  document.querySelector(".modal-close")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  function openModal(html, cardClass = "") {
    if (!modal || !modalContent) return;

    modalContent.innerHTML = html;

    if (modalCard) {
      modalCard.className = `modal-card ${cardClass}`.trim();
      modalCard.scrollTop = 0;
    }

    setHidden(modal, false);
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!modal || !modalContent) return;

    setHidden(modal, true);
    modalContent.innerHTML = "";

    if (modalCard) {
      modalCard.className = "modal-card";
      modalCard.scrollTop = 0;
    }

    document.body.style.overflow = "";
  }

  function setStatus(element, message, type = "") {
    if (!element) return;
    setHidden(element, false);
    element.className = `notice ${type}`.trim();
    element.textContent = message;
  }

  function requireDatabase(element) {
    if (db) return true;
    setStatus(element, "La conexión no está configurada en js/config.js.", "error");
    return false;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("es", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function renderStoryParagraphs(value) {
    const story = String(value || "Siempre amado. Siempre recordado.").trim();
    const explicitParagraphs = story
      .split(/\n\s*\n/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean);

    let paragraphs = explicitParagraphs;

    if (explicitParagraphs.length === 1) {
      const sentences = story
        .match(/[^.!?]+[.!?]+(?:["'’”])?|[^.!?]+$/g)
        ?.map(sentence => sentence.trim())
        .filter(Boolean) || [story];

      if (sentences.length > 2) {
        paragraphs = [];

        for (let index = 0; index < sentences.length; index += 2) {
          paragraphs.push(sentences.slice(index, index + 2).join(" "));
        }
      }
    }

    return paragraphs
      .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
  }


  authButtons.forEach(button => {
    button.addEventListener("click", () => {
      if (currentUser) {
        openMemberArea();
        return;
      }

      showAuth();
    });
  });

  function showAuth(forMemorial = false, initialMode = "login") {
    openModal(`
      <h2 id="modalTitle">${forMemorial ? "Inicia sesión para honrar a un hijo" : "Únete a Skysbridge"}</h2>
      ${forMemorial ? "<p>Para proteger la historia de cada hijo, inicia sesión o crea una cuenta antes de crear un recuerdo.</p>" : ""}
      <div class="tabs">
        <button class="button button-gold" id="loginTab">Iniciar sesión</button>
        <button class="button button-outline" id="signupTab">Crear cuenta</button>
      </div>
      <form class="form-grid" id="authForm">
        <label>Correo electrónico
          <input type="email" name="email" required autocomplete="email">
        </label>
        <label>Contraseña
          <input type="password" name="password" required minlength="8" autocomplete="current-password">
        </label>
        <button class="button button-gold" type="submit">Iniciar sesión</button>
        <div class="notice" id="authStatus">${forMemorial ? "Después de iniciar sesión, el formulario se abrirá automáticamente." : "Tu cuenta y tu actividad en las salas son privadas por defecto."}</div>
      </form>
    `);

    let mode = initialMode === "signup" ? "signup" : "login";
    const form = document.querySelector("#authForm");
    const status = document.querySelector("#authStatus");

    document.querySelector("#loginTab").onclick = () => setMode("login");
    document.querySelector("#signupTab").onclick = () => setMode("signup");

    function setMode(nextMode) {
      mode = nextMode;
      form.querySelector("button[type=submit]").textContent =
        mode === "login" ? "Iniciar sesión" : "Crear cuenta";
      document.querySelector("#loginTab").className =
        `button ${mode === "login" ? "button-gold" : "button-outline"}`;
      document.querySelector("#signupTab").className =
        `button ${mode === "signup" ? "button-gold" : "button-outline"}`;
    }

    setMode(mode);

    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;

      setStatus(status, "Espera, por favor…");
      const values = new FormData(form);
      const email = values.get("email");
      const password = values.get("password");

      const result = mode === "login"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({ email, password });

      if (result.error) {
        setStatus(status, ({"Invalid login credentials":"El correo o la contraseña no son correctos.","Email not confirmed":"Confirma tu correo electrónico antes de iniciar sesión.","User already registered":"Ya existe una cuenta con este correo electrónico."})[result.error.message] || result.error.message, "error");
        return;
      }

      setStatus(
        status,
        mode === "signup"
          ? "Revisa tu correo electrónico para confirmar tu cuenta."
          : "Has iniciado sesión correctamente.",
        "success"
      );

      setTimeout(async () => {
        closeModal();
        await refreshSession();
        if (forMemorial && mode === "login" && currentUser) {
          showMemorial();
        } else {
          openMemberArea();
        }
      }, 700);
    };
  }

  document.querySelectorAll("[data-open-memorial]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!currentUser && db) {
        const { data: { user } } = await db.auth.getUser();
        if (user) currentUser = user;
      }

      if (currentUser) {
        showMemorial();
      } else {
        showAuth(true);
      }
    });
  });

  function showMemorial() {
    openModal(`
      <h2 id="modalTitle">Honrar a un hijo</h2>
      <p>Los recuerdos enviados permanecen privados hasta que solicites su publicación y un moderador los apruebe.</p>
      <form class="form-grid" id="memorialForm">
        <label>Nombre de tu hijo
          <input name="child_name" required maxlength="80">
        </label>
        <label>Tu recuerdo
          <textarea name="remembrance" maxlength="5000" required></textarea>
        </label>
        <div class="date-grid">
          <label>Fecha de nacimiento (opcional)
            <input type="date" name="birth_date">
          </label>
          <label>Fecha de fallecimiento (opcional)
            <input type="date" name="passing_date">
          </label>
        </div>
        <label>País (opcional)
          <input name="country" maxlength="80">
        </label>
        <fieldset class="star-picker">
          <legend>Elige una estrella</legend>
          <div class="star-picker-grid">
            <label class="star-choice"><input type="radio" name="star_style" value="radiant" checked><span class="star-choice-preview star-radiant" aria-hidden="true"></span><span>Radiante</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="classic"><span class="star-choice-preview star-classic" aria-hidden="true"></span><span>Clásica</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="guiding"><span class="star-choice-preview star-guiding" aria-hidden="true"></span><span>Luz guía</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="halo"><span class="star-choice-preview star-halo" aria-hidden="true"></span><span>Halo</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="signature"><span class="star-choice-preview star-signature" aria-hidden="true"></span><span>La estrella de Sky</span></label>
          </div>
        </fieldset>
        <label>
          <input type="checkbox" name="public_requested">
          Solicitar un lugar en el cielo público de estrellas
        </label>
        <button class="button button-gold">Enviar de forma privada para revisión</button>
        <div class="notice" id="memorialStatus">Tú decides sobre la publicación.</div>
      </form>
    `);

    const form = document.querySelector("#memorialForm");
    const status = document.querySelector("#memorialStatus");

    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;

      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        setStatus(status, "Inicia sesión antes de enviar un recuerdo.", "error");
        return;
      }

      const values = new FormData(form);
      const payload = {
        user_id: user.id,
        child_name: values.get("child_name"),
        remembrance: values.get("remembrance"),
        country: values.get("country") || null,
        star_style: values.get("star_style") || "radiant",
        birth_date: values.get("birth_date") || null,
        passing_date: values.get("passing_date") || null,
        public_requested: values.get("public_requested") === "on"
      };

      let { error } = await db.from("memorials").insert(payload);

      if (error && /birth_date|passing_date|star_style/i.test(error.message || "")) {
        delete payload.birth_date;
        delete payload.passing_date;
        delete payload.star_style;
        ({ error } = await db.from("memorials").insert(payload));
      }

      if (error) {
        setStatus(status, error.message, "error");
        return;
      }

      form.reset();
      setStatus(status, "El recuerdo se ha enviado de forma privada para revisión.", "success");
    };
  }

  document.querySelectorAll("[data-star]").forEach(element => {
    element.addEventListener("click", () => showStar(element.dataset.star));
  });

  async function showStar(slug) {
    let star = {
      name: "Sky",
      story:
        "Vivió solo unos meses. Pero ninguna medida del tiempo puede expresar lo que significa para nosotros. Nos enseñó que el amor no se cuenta en años, sino en la profundidad del vínculo que permanece.\n\nDespués de perderlo, descubrimos lo silencioso y solitario que puede ser el duelo. Seguimos amando y echando de menos a nuestro hijo; sigue siendo parte de la familia. Sin embargo, el mundo suele guardar silencio en torno a su nombre.\n\nAños después, el amor por Sky dio origen a Skysbridge: un lugar donde los hijos que se fueron demasiado pronto pueden tener un nombre, ser honrados y recordados con dignidad, y donde sus historias pueden permanecer.\n\nSky es la primera luz del cielo lleno de estrellas. Con su estrella comenzó este lugar y, junto a él, cada hijo puede tener su propia luz."
    };

    if (db) {
      const { data } = await db
        .from("stars")
        .select("name,story")
        .eq("slug", slug)
        .eq("is_public", true)
        .maybeSingle();

      if (data && slug !== "sky") star = data;
    }

    const personalSkyOpening =
      "El momento en que supe que Sky existía fue uno de los más felices de mi vida. Tener que dejarlo ir se convirtió en el dolor más profundo que he conocido.";

    if (
      slug === "sky" &&
      !String(star.story || "").includes(personalSkyOpening)
    ) {
      star.story = `${personalSkyOpening}\n\n${star.story || ""}`.trim();
    }

    const starName = escapeHtml(slug === "sky" ? "Sky" : (star.name || "Un hijo recordado"));
    const storyHtml = renderStoryParagraphs(star.story);

    openModal(`
      <article class="star-remembrance ${slug === "sky" ? `is-${window.SkyRemembrance.state()}` : ""}">
        <header class="star-remembrance-header">
          <p class="eyebrow">Una luz que permanece</p>
          <span class="star-remembrance-symbol" aria-hidden="true">${slug === "sky" ? window.SkyRemembrance.symbol(true) : '<img src="assets/memorial-star.svg?v=55" alt="">'}</span>
          <h2 id="modalTitle">${starName}</h2>
          <p class="star-remembrance-subtitle">Su vida fue breve. Su luz permanece.</p>
          ${slug === "sky" ? '<p class="memorial-detail-meta">Nació el <time datetime="2019-02-09">9 de febrero de 2019</time></p>' : ""}
        </header>

        ${slug === "sky" ? `<figure class="sky-footprints">
          <div class="sky-footprints-image"><img src="assets/sky-footprints-original.jpg" width="864" height="1536" alt="Las dos huellas azules de Sky, conservadas en papel" decoding="async"></div>
          <figcaption>Las huellas de Sky</figcaption>
        </figure>` : ""}

        <div class="star-story-copy">
          ${storyHtml}
        </div>

        <div class="star-story-divider" aria-hidden="true">
          <span>✦</span>
        </div>

        <section class="memory-section" aria-labelledby="memoryHeading">
          <p class="eyebrow">Palabras para recordar</p>
          <h3 id="memoryHeading">Comparte un recuerdo de ${starName}</h3>
          <p class="memory-intro">
            Tus palabras permanecerán privadas hasta que se hayan revisado con cuidado.
          </p>

          <form class="form-grid memory-form" id="memoryForm">
            <label>Tu nombre
              <input name="author_name" maxlength="80" autocomplete="name" required>
            </label>
            <label>Comparte un recuerdo
              <textarea name="message" maxlength="800" required></textarea>
            </label>
            <button class="button button-gold" type="submit">Enviar el recuerdo de forma privada</button>
            <div class="notice memory-notice" id="memoryStatus">
              Los recuerdos se revisan antes de hacerse visibles.
            </div>
          </form>
        </section>
      </article>
    `, "star-modal-card");

    const form = document.querySelector("#memoryForm");
    const status = document.querySelector("#memoryStatus");

    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;

      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        setStatus(status, "Inicia sesión antes de compartir un recuerdo.", "error");
        return;
      }

      const values = new FormData(form);
      const { error } = await db.from("memories").insert({
        star_slug: slug,
        user_id: user.id,
        author_name: values.get("author_name"),
        message: values.get("message")
      });

      if (error) {
        setStatus(status, error.message, "error");
        return;
      }

      form.reset();
      setStatus(status, "Tu recuerdo se ha enviado de forma privada para revisión.", "success");
    };
  }


  function buildCelestialSky() {
    const sky = document.querySelector(".celestial-wall");
    if (!sky || sky.querySelector(".ambient-star")) return;

    let seed = 8875;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let index = 0; index < 118; index += 1) {
      const star = document.createElement("span");
      const size = random() < .82 ? .7 + random() * 1.25 : 2 + random() * 1.8;
      star.className = "ambient-star";
      star.setAttribute("aria-hidden", "true");
      star.style.setProperty("--x", `${(random() * 100).toFixed(2)}%`);
      star.style.setProperty("--y", `${(random() * 100).toFixed(2)}%`);
      star.style.setProperty("--size", `${size.toFixed(2)}px`);
      star.style.setProperty("--alpha", (.28 + random() * .66).toFixed(2));
      star.style.setProperty("--duration", `${(3.8 + random() * 7.4).toFixed(2)}s`);
      star.style.setProperty("--delay", `${(-random() * 9).toFixed(2)}s`);
      star.style.setProperty("--warmth", random() > .82 ? "#f7e4b0" : random() > .55 ? "#d9ecff" : "#ffffff");
      sky.appendChild(star);
    }

    for (let index = 0; index < 72; index += 1) {
      const star = document.createElement("span");
      const x = random() * 112 - 6;
      const diagonalCenter = 82 - x * .58;
      const spread = random() < .78 ? 9 : 16;
      const y = diagonalCenter + (random() - .5) * spread;
      star.className = "ambient-star milky-star";
      star.setAttribute("aria-hidden", "true");
      star.style.setProperty("--x", `${x.toFixed(2)}%`);
      star.style.setProperty("--y", `${y.toFixed(2)}%`);
      star.style.setProperty("--size", `${(.5 + random() * 1.25).toFixed(2)}px`);
      star.style.setProperty("--alpha", (.22 + random() * .5).toFixed(2));
      star.style.setProperty("--duration", `${(5.5 + random() * 8).toFixed(2)}s`);
      star.style.setProperty("--delay", `${(-random() * 10).toFixed(2)}s`);
      star.style.setProperty("--warmth", random() > .74 ? "#f3e6c5" : "#dfefff");
      sky.appendChild(star);
    }
  }

  buildCelestialSky();

  let approvedMemorials = [];
  let viewerMemorialIds = new Set();
  let memorialLoadGeneration = 0;
  let wallUserId;

  function setWallLoading(loading) {
    document.querySelector("#memorialGrid")?.setAttribute("aria-busy", String(loading));
  }

  function sameMonthAndDay(value, today = new Date()) {
    if (!value) return false;
    const parts = String(value).slice(0, 10).split("-").map(Number);
    return parts.length === 3 && parts[1] === today.getMonth() + 1 && parts[2] === today.getDate();
  }

  function formatPlainDate(value) {
    if (!value) return "";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" }).format(date);
  }

  function memorialDateLine(item) {
    const birth = formatPlainDate(item.birth_date);
    const passing = formatPlainDate(item.passing_date);
    if (birth && passing) return `${birth} — ${passing}`;
    if (birth) return `Nació el ${birth}`;
    if (passing) return `En nuestra memoria desde el ${passing}`;
    return "";
  }

  function memorialDayState(item) {
    // A remembrance anniversary takes priority if both dates fall on the same day.
    if (sameMonthAndDay(item.passing_date)) return "anniversary";
    if (sameMonthAndDay(item.birth_date)) return "birthday";
    return "standard";
  }

  function memorialSymbolMarkup(state, detailed = false, requestedStyle = "radiant") {
    if (state === "anniversary" && detailed) {
      return `<img class="memorial-candle-image" src="assets/memorial-candle.svg" alt="${detailed ? "Una vela encendida en su memoria" : ""}">`;
    }

    const allowedStyles = ["radiant", "classic", "guiding", "halo", "signature"];
    const style = allowedStyles.includes(requestedStyle) ? requestedStyle : "radiant";
    return `<span class="memorial-star-shape star-${style}" aria-hidden="true"></span>`;
  }

  function openApprovedMemorial(item) {
    const state = memorialDayState(item);
    const dayLabel =
      state === "anniversary"
        ? "Hoy recordamos"
        : state === "birthday"
          ? "Hoy celebramos"
          : "Una luz que permanece";
    const dateLine = memorialDateLine(item);

    openModal(`
      <article class="memorial-detail-card is-${state}">
        <p class="eyebrow">${dayLabel}</p>
        <div class="memorial-detail-symbol">
          ${memorialSymbolMarkup(state, true, item.star_style)}
        </div>
        <h2 id="modalTitle">${escapeHtml(item.child_name || "Siempre amado")}</h2>
        ${dateLine ? `<p class="memorial-detail-meta">${escapeHtml(dateLine)}</p>` : ""}
        ${item.country ? `<p class="memorial-detail-meta">${escapeHtml(item.country)}</p>` : ""}
        <div class="star-story-divider" aria-hidden="true"><span>✦</span></div>
        <div class="memorial-detail-story">${renderStoryParagraphs(item.remembrance)}</div>
      </article>
    `, "star-modal-card");
  }

  function renderApprovedMemorials(resolved = false) {
    const grid = document.querySelector("#memorialGrid");
    const status = document.querySelector("#wallStatus");
    if (!grid || !status) return;
    if (grid.getAttribute("aria-busy") === "true" && resolved !== true) return;

    grid.querySelectorAll("[data-public-memorial]").forEach(card => card.remove());

    const skyCard = grid.querySelector('[data-star="sky"]');
    skyCard?.classList.remove("is-secondary-light");
    skyCard?.style.removeProperty("--star-x");
    skyCard?.style.removeProperty("--star-y");

    const search = String(document.querySelector("#memorialSearch")?.value || "").trim().toLowerCase();
    const sort = document.querySelector("#memorialSort")?.value || "newest";
    let rows = approvedMemorials.filter(item => !search || String(item.child_name || "").toLowerCase().includes(search));

    rows = [...rows].sort((a, b) => {
      if (sort === "az") return String(a.child_name || "").localeCompare(String(b.child_name || ""));
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });

    const viewerCenter = rows.find(item => viewerMemorialIds.has(item.id));
    if (viewerCenter && skyCard) {
      skyCard.classList.add("is-secondary-light");
      skyCard.style.setProperty("--star-x", "72%");
      skyCard.style.setProperty("--star-y", "34%");
    }

    rows.forEach((item, index) => {
      const state = memorialDayState(item);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `memorial-card is-${state}`;
      card.dataset.publicMemorial = item.id;
      if (item.id === viewerCenter?.id) card.classList.add("is-viewer-center");
      card.setAttribute("aria-label", `Abrir el recuerdo de ${item.child_name || "un hijo recordado"}`);

      const starPositions = [
        ["72%","34%"],["76%","62%"],["25%","66%"],["19%","35%"],
        ["87%","43%"],["61%","76%"],["35%","79%"],["31%","24%"],
        ["90%","72%"],["12%","56%"],["66%","19%"],["44%","88%"]
      ];
      if (item.id !== viewerCenter?.id) {
        const [starX, starY] = starPositions[(index + (viewerCenter ? 1 : 0)) % starPositions.length];
        card.style.setProperty("--star-x", starX);
        card.style.setProperty("--star-y", starY);
      }
      card.style.animationDelay = `${(index % 7) * -.65}s`;

      const dateLine = memorialDateLine(item);
      const dayLabel =
        state === "anniversary"
          ? "Hoy recordamos"
          : state === "birthday"
            ? "Hoy celebramos"
            : "Siempre en nuestra memoria";

      card.innerHTML = `
        <span class="memorial-symbol">
          ${memorialSymbolMarkup(state, false, item.star_style)}
        </span>
        <span class="memorial-kicker">Una luz que permanece</span>
        <strong>${escapeHtml(item.child_name || "Siempre amado")}</strong>
        <span class="memorial-day">${dayLabel}</span>
        <span class="memorial-rule" aria-hidden="true"><i></i><b>✦</b><i></i></span>
        <small>${dateLine ? `<span class="memorial-dates">${escapeHtml(dateLine)}</span>` : "Siempre amado. Siempre recordado."}${item.country ? `<span class="memorial-dates">${escapeHtml(item.country)}</span>` : ""}</small>
      `;

      card.addEventListener("click", () => openApprovedMemorial(item));
      grid.appendChild(card);
    });

    if (search && !rows.length) status.textContent = `No se ha encontrado ningún recuerdo de «${document.querySelector("#memorialSearch").value.trim()}».`;
    else if (viewerCenter) status.textContent = `${viewerCenter.child_name || "La luz de tu hijo"} está en el centro de tu propio cielo lleno de estrellas.`;
    else if (approvedMemorials.length) status.textContent = `Sky y ${approvedMemorials.length} ${approvedMemorials.length === 1 ? "luz más" : "luces más"}.`;
    else status.textContent = "Sky es la primera luz. Aparecerán más estrellas con el consentimiento de las familias y la aprobación de un moderador.";
  }

  async function loadApprovedMemorials() {
    const status = document.querySelector("#wallStatus");
    if (!status) return;
    const generation = ++memorialLoadGeneration;
    setWallLoading(true);
    if (!db) {
      viewerMemorialIds = new Set();
      renderApprovedMemorials(true);
      setWallLoading(false);
      return;
    }

    status.textContent = "Cargando recuerdos…";
    let nextViewerMemorialIds = new Set();

    try {
    // Public stars are available to guests even when no auth session exists.
    let user = null;
    try {
      const authResult = await db.auth.getUser();
      if (!authResult.error) user = authResult.data?.user || null;
      else if (authResult.error.name !== "AuthSessionMissingError") {
        console.warn("Star ownership lookup unavailable:", authResult.error);
      }
    } catch (authError) {
      console.warn("Star ownership lookup unavailable:", authError);
    }
    if (generation !== memorialLoadGeneration) return;
    if (user) {
      const ownResult = await db
        .from("memorials")
        .select("id")
        .eq("user_id", user.id)
        .eq("approved", true)
        .eq("public_requested", true);

      if (ownResult.error) console.warn("Star ownership lookup unavailable:", ownResult.error);
      else nextViewerMemorialIds = new Set((ownResult.data || []).map(item => item.id));
    }
    let result = await db
      .from("memorials")
      .select("id,child_name,remembrance,country,star_style,birth_date,passing_date,created_at")
      .eq("approved", true)
      .eq("public_requested", true)
      .order("created_at", { ascending: false });

    if (result.error && /birth_date|passing_date|star_style/i.test(result.error.message || "")) {
      result = await db
        .from("memorials")
        .select("id,child_name,remembrance,country,created_at")
        .eq("approved", true)
        .eq("public_requested", true)
        .order("created_at", { ascending: false });
    }

    if (generation !== memorialLoadGeneration) return;
    if (result.error) throw result.error;

    viewerMemorialIds = nextViewerMemorialIds;
    approvedMemorials = result.data || [];
    renderApprovedMemorials(true);
    } catch (error) {
      if (generation !== memorialLoadGeneration) return;
      console.error("Memorial loading error:", error);
      viewerMemorialIds = new Set();
      approvedMemorials = [];
      renderApprovedMemorials(true);
      status.textContent = "No se han podido cargar los recuerdos públicos. Sky sigue visible como la primera luz.";
    } finally {
      if (generation === memorialLoadGeneration) setWallLoading(false);
    }
  }

  document.querySelector("#memorialSearch")?.addEventListener("input", renderApprovedMemorials);
  document.querySelector("#memorialSort")?.addEventListener("change", renderApprovedMemorials);

  async function ensureProfile(user) {
    const { data, error } = await db
      .from("profiles")
      .select("id,display_name,country,is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const displayName = user.email ? user.email.split("@")[0] : "Miembro";
    const { data: inserted, error: insertError } = await db
      .from("profiles")
      .insert({ id: user.id, display_name: displayName })
      .select("id,display_name,country,is_admin")
      .single();

    if (insertError) throw insertError;
    return inserted;
  }

  async function refreshSession() {
    if (!db) return;

    const { data: { session }, error: sessionError } = await db.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
    }

    const guest = document.querySelector("#guestCommunity");
    const memberPanel = document.querySelector("#memberPanel");
    const roomArea = document.querySelector("#roomArea");
    const roomView = document.querySelector("#roomView");
    const adminPanel = document.querySelector("#adminPanel");
    const adminBadge = document.querySelector("#adminBadge");
    const memberGreeting = document.querySelector("#memberGreeting");
    const memberEmail = document.querySelector("#memberEmail");

    if (!session) {
      currentUser = null;
      currentProfile = null;
      activeRoomId = null;

      updateAuthButtons(false);

      setHidden(guest, false);
      setHidden(memberPanel, true);
      setHidden(roomArea, true);
      setHidden(roomView, true);
      setHidden(adminPanel, true);
      setHidden(adminBadge, true);

      if (memberGreeting) memberGreeting.textContent = "Te damos la bienvenida a Skysbridge";
      if (memberEmail) memberEmail.textContent = "";

      return;
    }

    currentUser = session.user;
    updateAuthButtons(true);

    try {
      currentProfile = await ensureProfile(currentUser);
    } catch (error) {
      console.error("Profile error:", error);
      currentProfile = {
        display_name: currentUser.email?.split("@")[0] || "Miembro",
        is_admin: false
      };
    }


    setHidden(guest, true);
    setHidden(memberPanel, false);
    setHidden(roomArea, false);
    setHidden(roomView, true);

    if (memberGreeting) {
      memberGreeting.textContent =
        `Hola, ${currentProfile.display_name || "Miembro"}`;
    }

    if (memberEmail) {
      memberEmail.textContent = currentUser.email || "";
    }

    setHidden(adminBadge, !currentProfile.is_admin);

    await loadRooms();

    setHidden(adminPanel, !currentProfile.is_admin);

    if (currentProfile.is_admin) {
      await loadAdminDashboard();
    }
  }

  async function loadRooms() {
    const roomList = document.querySelector("#roomList");
    if (!roomList) return;

    roomList.innerHTML = `<p class="notice">Cargando salas protegidas…</p>`;

    const { data: rooms, error: roomError } = await db
      .from("support_groups")
      .select("id,slug,name,description,is_active")
      .eq("is_active", true)
      .order("name");

    if (roomError) {
      roomList.innerHTML = `<p class="notice error">${escapeHtml(roomError.message)}</p>`;
      return;
    }

    const { data: memberships, error: membershipError } = await db
      .from("group_members")
      .select("group_id,status,role")
      .eq("user_id", currentUser.id);

    if (membershipError) {
      roomList.innerHTML = `<p class="notice error">${escapeHtml(membershipError.message)}</p>`;
      return;
    }

    const membershipMap = Object.fromEntries(
      (memberships || []).map(item => [item.group_id, item])
    );

    roomList.innerHTML = (rooms || []).map(room => {
      const membership = membershipMap[room.id];

      let action = `
        <button class="button button-gold request-room" data-room-id="${room.id}">
          Solicitar acceso
        </button>
      `;
      let status = "Sin acceso solicitado";

      if (membership?.status === "pending") {
        status = "Pendiente de revisión";
        action = `<button class="button button-outline" disabled>Solicitud pendiente</button>`;
      } else if (membership?.status === "approved") {
        status = membership.role === "moderator" ? "Moderador" : "Miembro aprobado";
        action = `
          <button class="button button-gold open-room"
            data-room-id="${room.id}"
            data-room-name="${escapeHtml(roomText(room.name))}">
            Entrar en la sala
          </button>
        `;
      } else if (membership?.status === "blocked") {
        status = "Acceso no disponible";
        action = `<button class="button button-outline" disabled>Acceso no disponible</button>`;
      }

      return `
        <article class="dashboard-card">
          <p class="room-status">${escapeHtml(status)}</p>
          <h3>${escapeHtml(roomText(room.name))}</h3>
          <p>${escapeHtml(roomText(room.description))}</p>
          ${action}
        </article>
      `;
    }).join("");

    roomList.querySelectorAll(".request-room").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Enviando…";

        const { error } = await db.from("group_members").insert({
          group_id: button.dataset.roomId,
          user_id: currentUser.id,
          status: currentProfile.is_admin ? "approved" : "pending",
          role: currentProfile.is_admin ? "moderator" : "member"
        });

        if (error) {
          button.disabled = false;
          button.textContent = error.message;
          return;
        }

        await loadRooms();
        if (currentProfile.is_admin) await loadAdminDashboard();
      });
    });

    roomList.querySelectorAll(".open-room").forEach(button => {
      button.addEventListener("click", () => {
        openRoom(button.dataset.roomId, button.dataset.roomName);
      });
    });

  }

  async function openRoom(roomId, roomName) {
    activeRoomId = roomId;
    setHidden(document.querySelector("#roomArea"), true);
    setHidden(document.querySelector("#roomView"), false);
    document.querySelector("#activeRoomName").textContent = roomName;
    await loadPosts();
    document.querySelector("#roomView")?.scrollIntoView({ behavior: "smooth" });
  }

  document.querySelector("#closeRoom")?.addEventListener("click", () => {
    activeRoomId = null;
    setHidden(document.querySelector("#roomView"), true);
    setHidden(document.querySelector("#roomArea"), false);
  });

  document.querySelector("#postForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const bodyInput = document.querySelector("#postBody");
    const status = document.querySelector("#postStatus");

    if (!activeRoomId || !bodyInput?.value.trim()) return;

    setStatus(status, "Publicando…");

    const { error } = await db.from("group_posts").insert({
      group_id: activeRoomId,
      user_id: currentUser.id,
      body: bodyInput.value.trim()
    });

    if (error) {
      setStatus(status, error.message, "error");
      return;
    }

    bodyInput.value = "";
    setStatus(status, "Tu publicación ya es visible para los miembros aprobados de la sala.", "success");
    await loadPosts();
  });

  async function loadPosts() {
    const postList = document.querySelector("#postList");
    if (!postList) return;

    postList.innerHTML = `<p class="notice">Cargando publicaciones de la sala…</p>`;

    const { data: posts, error } = await db
      .from("group_posts")
      .select("id,body,created_at,user_id")
      .eq("group_id", activeRoomId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false });

    if (error) {
      postList.innerHTML = `<p class="notice error">${escapeHtml(error.message)}</p>`;
      return;
    }

    if (!posts?.length) {
      postList.innerHTML = `<p class="notice">Esta sala está tranquila por ahora. Puedes ser el primero en compartir.</p>`;
      return;
    }

    const userIds = [...new Set(posts.map(post => post.user_id).filter(Boolean))];
    let profileMap = {};

    if (userIds.length) {
      const { data: profiles, error: profileError } = await db
        .from("profiles")
        .select("id,display_name")
        .in("id", userIds);

      if (!profileError) {
        profileMap = Object.fromEntries(
          (profiles || []).map(profile => [profile.id, profile.display_name])
        );
      }
    }

    postList.innerHTML = posts.map(post => `
      <article class="post-card">
        <div class="post-meta">
          <strong>${escapeHtml(profileMap[post.user_id] || "Miembro de la comunidad")}</strong>
          <span>${escapeHtml(formatDate(post.created_at))}</span>
        </div>
        <p>${escapeHtml(post.body)}</p>
      </article>
    `).join("");
  }

  function ensurePublishedMemorialAdminSection() {
    const grid = document.querySelector("#adminPanel .admin-grid");
    if (!grid || document.querySelector("#publishedMemorials")) return;

    const card = document.createElement("article");
    card.className = "admin-card";
    card.dataset.adminPublishedMemorials = "true";
    card.innerHTML = `
      <h3>Estrellas publicadas</h3>
      <p class="muted">Gestiona los recuerdos visibles en el cielo lleno de estrellas. Sky está protegido de forma permanente.</p>
      <div id="publishedMemorials"><p class="muted">Cargando…</p></div>
    `;
    grid.appendChild(card);
  }

  async function loadPublishedMemorials() {
    ensurePublishedMemorialAdminSection();

    const target = document.querySelector("#publishedMemorials");
    if (!target) return;

    if (!currentProfile?.is_admin) {
      target.innerHTML = `<p class="notice error">Se requiere acceso de administrador.</p>`;
      return;
    }

    target.innerHTML = `<p class="muted">Cargando…</p>`;

    let result = await db
      .from("memorials")
      .select("id,child_name,country,created_at")
      .eq("approved", true)
      .eq("public_requested", true)
      .order("created_at", { ascending: false });

    if (result.error && /country/i.test(result.error.message || "")) {
      result = await db
        .from("memorials")
        .select("id,child_name,created_at")
        .eq("approved", true)
        .eq("public_requested", true)
        .order("created_at", { ascending: false });
    }

    if (result.error) {
      target.innerHTML = `<p class="notice error">${escapeHtml(result.error.message)}</p>`;
      return;
    }

    const memorials = result.data || [];

    if (!memorials.length) {
      target.innerHTML = `<p class="muted">No hay estrellas publicadas. Sky permanece visible de forma permanente.</p>`;
      return;
    }

    target.innerHTML = memorials.map(item => `
      <div class="review-item">
        <strong>${escapeHtml(item.child_name)}</strong>
        ${item.country ? `<p>${escapeHtml(item.country)}</p>` : ""}
        <p>${escapeHtml(formatDate(item.created_at))}</p>
        <div class="review-actions">
          <button
            class="button button-danger delete-published-memorial"
            type="button"
            data-id="${escapeHtml(item.id)}"
            data-name="${escapeHtml(item.child_name)}">
            Eliminar estrella
          </button>
        </div>
      </div>
    `).join("");

    target.querySelectorAll(".delete-published-memorial").forEach(button => {
      button.onclick = async () => {
        const memorialId = button.dataset.id;
        const childName = button.dataset.name || "este hijo";

        if (!memorialId) return;

        const confirmed = window.confirm(
          `¿Eliminar permanentemente la estrella de ${childName}? Esta acción no se puede deshacer.`
        );

        if (!confirmed) return;

        const originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = "Eliminando…";

        let deleted = false;
        let deleteError = null;

        const rpcResult = await db.rpc("admin_delete_published_memorial", {
          p_memorial_id: memorialId
        });

        if (!rpcResult.error) {
          deleted = rpcResult.data === true;
        } else if (/function|schema cache|admin_delete_published_memorial/i.test(rpcResult.error.message || "")) {
          // Compatibility fallback for installations where the V36 SQL has not run yet.
          const fallbackResult = await db
            .from("memorials")
            .delete()
            .eq("id", memorialId)
            .eq("approved", true)
            .eq("public_requested", true)
            .select("id");

          deleteError = fallbackResult.error;
          deleted = Boolean(fallbackResult.data?.length);
        } else {
          deleteError = rpcResult.error;
        }

        if (deleteError) {
          button.disabled = false;
          button.textContent = originalLabel;
          window.alert(`No se ha podido eliminar la estrella: ${deleteError.message}`);
          return;
        }

        if (!deleted) {
          button.disabled = false;
          button.textContent = originalLabel;
          window.alert(
            "No se ha eliminado nada. Ejecuta RUN_ONCE_IN_SUPABASE.sql y comprueba que tu perfil tenga is_admin = true."
          );
          return;
        }

        await Promise.all([
          loadPublishedMemorials(),
          loadApprovedMemorials()
        ]);
      };
    });
  }

  async function loadAdminDashboard() {
    ensurePublishedMemorialAdminSection();

    await Promise.all([
      loadPendingMembers(),
      loadPendingMemorials(),
      loadPendingMemories(),
      loadPublishedMemorials()
    ]);
  }

  async function loadPendingMembers() {
    const target = document.querySelector("#pendingMembers");
    if (!target) return;

    target.innerHTML = `<p class="muted">Cargando…</p>`;

    const { data: requests, error } = await db
      .from("group_members")
      .select("group_id,user_id,status,joined_at")
      .eq("status", "pending")
      .order("joined_at", { ascending: true });

    if (error) {
      target.innerHTML = `<p class="notice error">${escapeHtml(error.message)}</p>`;
      return;
    }

    if (!requests?.length) {
      target.innerHTML = `<p class="muted">No hay solicitudes de acceso pendientes.</p>`;
      return;
    }

    const groupIds = [...new Set(requests.map(item => item.group_id).filter(Boolean))];
    const userIds = [...new Set(requests.map(item => item.user_id).filter(Boolean))];

    const [groupsResult, profilesResult] = await Promise.all([
      groupIds.length
        ? db.from("support_groups").select("id,name").in("id", groupIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? db.from("profiles").select("id,display_name").in("id", userIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (groupsResult.error || profilesResult.error) {
      const message = groupsResult.error?.message || profilesResult.error?.message;
      target.innerHTML = `<p class="notice error">${escapeHtml(message)}</p>`;
      return;
    }

    const groupMap = Object.fromEntries(
      (groupsResult.data || []).map(group => [group.id, group.name])
    );
    const profileMap = Object.fromEntries(
      (profilesResult.data || []).map(profile => [profile.id, profile.display_name])
    );

    target.innerHTML = requests.map(item => `
      <div class="review-item">
        <strong>${escapeHtml(profileMap[item.user_id] || item.user_id)}</strong>
        <p>${escapeHtml(groupMap[item.group_id] || "Sala")}</p>
        <div class="review-actions">
          <button class="button button-gold approve-member"
            data-group-id="${item.group_id}"
            data-user-id="${item.user_id}">Aprobar</button>
          <button class="button button-danger decline-member"
            data-group-id="${item.group_id}"
            data-user-id="${item.user_id}">Bloquear</button>
        </div>
      </div>
    `).join("");

    target.querySelectorAll(".approve-member").forEach(button => {
      button.onclick = () => reviewMembership(button, "approved");
    });

    target.querySelectorAll(".decline-member").forEach(button => {
      button.onclick = () => reviewMembership(button, "blocked");
    });
  }

  async function reviewMembership(button, nextStatus) {
    button.disabled = true;

    const { error } = await db
      .from("group_members")
      .update({ status: nextStatus })
      .eq("group_id", button.dataset.groupId)
      .eq("user_id", button.dataset.userId);

    if (error) {
      button.textContent = error.message;
      return;
    }

    await loadPendingMembers();
    await loadRooms();
  }

  async function loadPendingMemorials() {
    const target = document.querySelector("#pendingMemorials");
    if (!target) return;

    target.innerHTML = `<p class="muted">Cargando…</p>`;

    const { data, error } = await db
      .from("memorials")
      .select("id,child_name,remembrance,country,public_requested,created_at")
      .eq("approved", false)
      .is("rejection_reason", null)
      .order("created_at", { ascending: true });

    if (error) {
      target.innerHTML = `<p class="notice error">${escapeHtml(error.message)}</p>`;
      return;
    }

    if (!data?.length) {
      target.innerHTML = `<p class="muted">No hay recuerdos pendientes.</p>`;
      return;
    }

    target.innerHTML = data.map(item => `
      <div class="review-item">
        <strong>${escapeHtml(item.child_name)}</strong>
        <p>${escapeHtml(item.remembrance)}</p>
        <p>${item.public_requested ? "Solicita una estrella pública" : "Recuerdo privado"}</p>
        <div class="review-actions">
          <button class="button button-gold review-memorial" data-id="${item.id}" data-decision="approve">Aprobar</button>
          <button class="button button-danger review-memorial" data-id="${item.id}" data-decision="decline">Rechazar</button>
        </div>
      </div>
    `).join("");

    target.querySelectorAll(".review-memorial").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;

        const approved = button.dataset.decision === "approve";
        const { error: updateError } = await db
          .from("memorials")
          .update({
            approved,
            rejection_reason: approved ? null : "Not approved at this time."
          })
          .eq("id", button.dataset.id);

        if (updateError) {
          button.textContent = updateError.message;
          return;
        }

        await loadPendingMemorials();
        await loadApprovedMemorials();
      };
    });
  }

  async function loadPendingMemories() {
    const target = document.querySelector("#pendingMemories");
    if (!target) return;

    target.innerHTML = `<p class="muted">Cargando…</p>`;

    const { data, error } = await db
      .from("memories")
      .select("id,star_slug,author_name,message,created_at")
      .eq("approved", false)
      .is("rejection_reason", null)
      .order("created_at", { ascending: true });

    if (error) {
      target.innerHTML = `<p class="notice error">${escapeHtml(error.message)}</p>`;
      return;
    }

    if (!data?.length) {
      target.innerHTML = `<p class="muted">No hay recuerdos pendientes de revisión.</p>`;
      return;
    }

    target.innerHTML = data.map(item => `
      <div class="review-item">
        <strong>${escapeHtml(item.author_name)} · ${escapeHtml(item.star_slug)}</strong>
        <p>${escapeHtml(item.message)}</p>
        <div class="review-actions">
          <button class="button button-gold review-memory" data-id="${item.id}" data-decision="approve">Aprobar</button>
          <button class="button button-danger review-memory" data-id="${item.id}" data-decision="decline">Rechazar</button>
        </div>
      </div>
    `).join("");

    target.querySelectorAll(".review-memory").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;

        const approved = button.dataset.decision === "approve";
        const { error: updateError } = await db
          .from("memories")
          .update({
            approved,
            rejection_reason: approved ? null : "Not approved at this time."
          })
          .eq("id", button.dataset.id);

        if (updateError) {
          button.textContent = updateError.message;
          return;
        }

        await loadPendingMemories();
      };
    });
  }

  document.querySelector("#refreshAdmin")?.addEventListener("click", loadAdminDashboard);

  document.querySelector("#signOut")?.addEventListener("click", async () => {
    if (!db) return;

    const { error } = await db.auth.signOut();

    if (error) {
      console.error("Sign-out error:", error);
      return;
    }

    await refreshSession();
    document.querySelector("#community")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  async function openRequestedEntryPoint() {
    const params = new URLSearchParams(window.location.search);
    const authMode = params.get("auth");
    const memorialRequested = params.get("memorial") === "1";
    if (!memorialRequested && !["login", "signup"].includes(authMode)) return;

    let user = currentUser;
    if (!user && db) {
      const result = await db.auth.getUser();
      user = result.data?.user || null;
      if (user) currentUser = user;
    }

    if (memorialRequested) {
      user ? showMemorial() : showAuth(true, authMode === "signup" ? "signup" : "login");
    } else if (user) {
      openMemberArea();
    } else {
      showAuth(false, authMode);
    }
  }

  openRequestedEntryPoint();

  loadApprovedMemorials();

  if (db) {
    db.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id || null;
      const accountChanged = ["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT"].includes(event) && wallUserId !== nextUserId;
      if (accountChanged) {
        wallUserId = nextUserId;
        ++memorialLoadGeneration;
        setWallLoading(true);
      }
      window.setTimeout(async () => {
        await Promise.all([
          refreshSession(),
          accountChanged ? loadApprovedMemorials() : Promise.resolve()
        ]);
      }, 0);
    });

    refreshSession();
  } else {
    updateAuthButtons(false);
  }
})();
