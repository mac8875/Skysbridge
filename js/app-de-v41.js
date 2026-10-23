// SKYBRIDGE V41 DE — vollständig überarbeitete deutsche Benutzeroberfläche
(() => {
  const cfg = window.SKYSBRIDGE_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_");

  const db = configured
    ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;
  const wallDb = configured
    ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      })
    : null;

  let currentUser = null;
  let currentProfile = null;
  let activeRoomId = null;
  let modalPhotoUrl = null;
  const reviewPhotoUrls = new Set();

  function clearReviewPhotoUrls() {
    document.querySelectorAll('.memorial-review-photo').forEach(img => img.removeAttribute('src'));
    reviewPhotoUrls.forEach(url => URL.revokeObjectURL(url));
    reviewPhotoUrls.clear();
  }

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
        ? "Mitgliederbereich öffnen"
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

    if (modalPhotoUrl) URL.revokeObjectURL(modalPhotoUrl);
    modalPhotoUrl = null;
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
    if (modalPhotoUrl) URL.revokeObjectURL(modalPhotoUrl);
    modalPhotoUrl = null;

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
    setStatus(element, "Supabase ist in js/config.js nicht konfiguriert.", "error");
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
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function translateRoomText(value) {
    const translations = {
      "Newly Bereaved": "Neu Trauernde",
      "A gentle room for the first days and months.": "Ein behutsamer Raum für die ersten Tage und Monate.",
      "Fathers' Space": "Raum für Väter",
      "A protected room for fathers to speak without judgment.": "Ein geschützter Raum, in dem Väter ohne Bewertung sprechen können.",
      "Remembering Together": "Gemeinsam erinnern",
      "Share anniversaries, memories and rituals of remembrance.": "Teile Jahrestage, Erinnerungen und Rituale des Gedenkens."
    };
    return translations[String(value || "")] || value;
  }

  function renderStoryParagraphs(value) {
    const story = String(value || "Für immer geliebt. Für immer unvergessen.").trim();
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

  function showStarAccessPrompt() {
    openModal(`
      <p class="eyebrow">Eine behutsame Einladung</p>
      <h2 id="modalTitle">Hinter jedem Stern steckt eine Geschichte</h2>
      <p>Melde dich an oder erstelle ein kostenloses Konto, um die Namen und Erinnerungen hinter den Sternen zu entdecken. Du kannst alles in deinem eigenen Tempo erkunden.</p>
      <div class="tabs">
        <button class="button button-gold" id="starAccessLogin" type="button">Anmelden</button>
        <button class="button button-outline" id="starAccessSignup" type="button">Konto erstellen</button>
      </div>
    `, "star-access-card");
    document.querySelector("#starAccessLogin")?.addEventListener("click", () => showAuth(false, "login"));
    document.querySelector("#starAccessSignup")?.addEventListener("click", () => showAuth(false, "signup"));
  }

  async function hasSignedInWallAccess() {
    if (!db) return false;

    try {
      const { data, error } = await db.auth.getUser();
      if (error) throw error;
      wallIsMember = Boolean(data?.user && !data.user.is_anonymous);
      return wallIsMember;
    } catch (error) {
      wallIsMember = false;
      console.warn("Prüfung des Sternzugangs nicht verfügbar:", error);
      return false;
    }
  }

  function showAuth(forMemorial = false, initialMode = "login") {
    openModal(`
      <h2 id="modalTitle">${forMemorial ? "Anmelden, um ein Kind zu ehren" : "Skysbridge beitreten"}</h2>
      ${forMemorial ? "<p>Zum Schutz jeder Geschichte melde dich bitte an oder erstelle ein Konto, bevor du einen Gedenkstern anlegst.</p>" : ""}
      <div class="tabs">
        <button class="button button-gold" id="loginTab">Anmelden</button>
        <button class="button button-outline" id="signupTab">Konto erstellen</button>
      </div>
      <form class="form-grid" id="authForm">
        <label>E-Mail-Adresse
          <input type="email" name="email" required autocomplete="email">
        </label>
        <label>Passwort
          <input type="password" name="password" required minlength="8" autocomplete="current-password">
        </label>
        <button class="button button-gold" type="submit">Anmelden</button>
        <div class="notice" id="authStatus">${forMemorial ? "Nach der Anmeldung öffnet sich das Formular für den Gedenkstern automatisch." : "Dein Konto und deine Aktivitäten in den Räumen sind standardmäßig privat."}</div>
      </form>
    `, "auth-modal-card");

    let mode = initialMode === "signup" ? "signup" : "login";
    const form = document.querySelector("#authForm");
    const status = document.querySelector("#authStatus");

    document.querySelector("#loginTab").onclick = () => setMode("login");
    document.querySelector("#signupTab").onclick = () => setMode("signup");

    function setMode(nextMode) {
      mode = nextMode;
      form.querySelector("button[type=submit]").textContent =
        mode === "login" ? "Anmelden" : "Konto erstellen";
      document.querySelector("#loginTab").className =
        `button ${mode === "login" ? "button-gold" : "button-outline"}`;
      document.querySelector("#signupTab").className =
        `button ${mode === "signup" ? "button-gold" : "button-outline"}`;
    }

    setMode(mode);

    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;

      setStatus(status, "Bitte warten …");
      const values = new FormData(form);
      const email = values.get("email");
      const password = values.get("password");

      const result = mode === "login"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({ email, password });

      if (result.error) {
        const emailLimitReached = result.error.code === "over_email_send_rate_limit" || /email rate limit exceeded/i.test(result.error.message || "");
        setStatus(status, emailLimitReached ? 'Bestätigungs-E-Mails können vorübergehend nicht versendet werden, weil das Versandlimit erreicht ist. Bitte versuche es später erneut. Wenn du bereits ein bestätigtes Konto hast, wähle Anmelden.' : result.error.message, "error");
        return;
      }

      setStatus(
        status,
        mode === "signup"
          ? "Bitte prüfe deine E-Mails, um dein Konto zu bestätigen."
          : "Erfolgreich angemeldet.",
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
      <h2 id="modalTitle">Ein Kind ehren</h2>
      <p>Ein Gedenkstern bleibt zunächst privat. Nur wenn du eine Veröffentlichung wünschst und die Moderation zustimmt, erscheint er im öffentlichen Sternenhimmel.</p>
      <form class="form-grid" id="memorialForm">
        <label>Name des Kindes
          <input name="child_name" required maxlength="80">
        </label>
        <label>Die Geschichte oder Erinnerung, die du bewahren möchtest
          <textarea name="remembrance" maxlength="5000" required></textarea>
        </label>
        <div class="date-grid">
          <label>Geburtsdatum (optional)
            <input type="date" name="birth_date">
          </label>
          <label>Tag des Abschieds (optional)
            <input type="date" name="passing_date">
          </label>
        </div>
        <label>Land (optional)
          <input name="country" maxlength="80">
        </label>
        <label>Foto deines Kindes (freiwillig, JPEG, PNG oder WebP, bis 5 MB)
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp">
        </label>
        <p class="muted">Erst wenn du einen öffentlichen Stern beantragst und die Gedenkseite freigegeben wurde, können angemeldete Mitglieder das Foto sehen.</p>
        <fieldset class="star-picker">
          <legend>Sternform auswählen</legend>
          <div class="star-picker-grid">
            <label class="star-choice"><input type="radio" name="star_style" value="radiant" checked><span class="star-choice-preview star-radiant" aria-hidden="true"></span><span>Strahlend</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="classic"><span class="star-choice-preview star-classic" aria-hidden="true"></span><span>Klassisch</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="guiding"><span class="star-choice-preview star-guiding" aria-hidden="true"></span><span>Wegweiser</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="halo"><span class="star-choice-preview star-halo" aria-hidden="true"></span><span>Lichtkreis</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="signature"><span class="star-choice-preview star-signature" aria-hidden="true"></span><span>Skys Stern</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="comet"><span class="star-choice-preview star-comet" aria-hidden="true"></span><span>Komet</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="petal"><span class="star-choice-preview star-petal" aria-hidden="true"></span><span>Blütenstern</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="north"><span class="star-choice-preview star-north" aria-hidden="true"></span><span>Polarstern</span></label>
          </div>
        </fieldset>
        <label class="public-request-option">
          <input class="public-request-option__checkbox" type="checkbox" name="public_requested">
          <span class="public-request-option__copy">
            <strong>Öffentlich im Sternenhimmel zeigen lassen (optional)</strong>
            <span>Wenn du das Kästchen aktivierst, beantragst du die öffentliche Anzeige mit Namen und Erinnerungstext. Ohne Häkchen erscheint der Stern anonym; nur du siehst seine Angaben.</span>
          </span>
        </label>
        <button class="button button-gold">Gedenkstern speichern</button>
        <div class="notice" id="memorialStatus">Du entscheidest, ob der Gedenkstern privat bleibt oder öffentlich werden soll.</div>
      </form>
    `);

    const form = document.querySelector("#memorialForm");
    const status = document.querySelector("#memorialStatus");

    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;

      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        setStatus(status, "Bitte melde dich an, bevor du einen Gedenkstern einreichst.", "error");
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

      const photo = values.get("photo");
      let photoPath = null;
      if (photo instanceof File && photo.size) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
          setStatus(status, "Bitte wähle ein JPEG-, PNG- oder WebP-Bild mit höchstens 5 MB.", "error");
          return;
        }
        const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[photo.type];
        photoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await db.storage.from("memorial-photos").upload(photoPath, photo, {
          contentType: photo.type,
          upsert: false
        });
        if (uploadError) {
          setStatus(status, "Das Foto konnte nicht hochgeladen werden: " + uploadError.message, "error");
          return;
        }
        payload.photo_path = photoPath;
      }

      let { error } = await db.from("memorials").insert(payload);

      if (error && !photoPath && /birth_date|passing_date|star_style/i.test(error.message || "")) {
        delete payload.birth_date;
        delete payload.passing_date;
        delete payload.star_style;
        ({ error } = await db.from("memorials").insert(payload));
      }

      if (error) {
        if (photoPath) await db.storage.from("memorial-photos").remove([photoPath]);
        setStatus(status, error.message, "error");
        return;
      }

      form.reset();
      setStatus(status, "Dein privater Stern wurde hinzugefügt. Nur du kannst seinen Namen und die Erinnerung öffnen.", "success");
      await loadApprovedMemorials();
    };
  }

  document.querySelectorAll("[data-star]").forEach(element => {
    element.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!(await hasSignedInWallAccess())) {
        showStarAccessPrompt();
        return;
      }
      showStar(element.dataset.star);
    });
  });

  async function showStar(slug) {
    const germanSkyStory =
      "Als ich von Sky erfuhr, war das der glücklichste Moment meines Lebens. Ihn wieder gehen lassen zu müssen, wurde zu meinem tiefsten Schmerz.\n\nSky war nur kurze Zeit bei uns, und doch hat er unser Leben für immer verändert. Durch ihn haben wir verstanden, dass Liebe nicht in Jahren gemessen wird, sondern in der Tiefe der Verbindung, die bleibt.\n\nNach seinem Tod haben wir erlebt, wie still und einsam Trauer werden kann. Viele Eltern tragen ihren Schmerz allein, weil sie glauben, niemand könne wirklich verstehen, was sie verloren haben.\n\nAus der Liebe zu Sky entstand Skysbridge: ein würdevoller Ort, an dem Kinder, die viel zu früh gehen mussten, einen Namen, einen Stern und einen sichtbaren Platz in unserer Erinnerung behalten.\n\nSky ist der erste Stern im Himmel voller Sterne. Sein Licht steht am Anfang eines Ortes, an dem die Geschichten vieler Kinder weiterleuchten dürfen.";

    let star = {
      name: "Sky",
      story: germanSkyStory
    };

    if (db) {
      const { data } = await db
        .from("stars")
        .select("name,story")
        .eq("slug", slug)
        .eq("is_public", true)
        .maybeSingle();

      if (data) {
        star = slug === "sky"
          ? { name: data.name || "Sky", story: germanSkyStory }
          : data;
      }
    }

    const rawStarName = slug === "sky" ? "Sky" : String(star.name || "").trim();
    const starName = escapeHtml(rawStarName || "Ein geliebtes Kind");
    const memoryHeading = rawStarName
      ? `Eine Erinnerung an ${starName} teilen`
      : "Eine persönliche Erinnerung teilen";
    const storyHtml = renderStoryParagraphs(star.story);

    openModal(`
      <article class="star-remembrance ${slug === "sky" ? `is-${window.SkyRemembrance.state()}` : ""}">
        <header class="star-remembrance-header">
          <p class="eyebrow">Ein Licht, das bleibt</p>
          <span class="star-remembrance-symbol" aria-hidden="true">${slug === "sky" ? window.SkyRemembrance.symbol(true) : '<img src="assets/memorial-star.svg?v=55" alt="">'}</span>
          <h2 id="modalTitle">${starName}</h2>
          <p class="star-remembrance-subtitle">Sein Leben war kurz. Sein Licht bleibt.</p>
          ${slug === "sky" ? '<p class="memorial-detail-meta">Geboren am <time datetime="2019-02-09">9. Februar 2019</time></p>' : ""}
        </header>

        ${slug === "sky" ? `<figure class="sky-footprints">
          <div class="sky-footprints-image"><img src="assets/sky-footprints-original.jpg" width="864" height="1536" alt="Skys zwei blaue Fußabdrücke auf Papier" decoding="async"></div>
          <figcaption>Skys Fußabdrücke</figcaption>
        </figure>` : ""}

        <div class="star-story-copy">
          ${storyHtml}
        </div>

        <div class="star-story-divider" aria-hidden="true">
          <span>✦</span>
        </div>

        <section class="memory-section" aria-labelledby="memoryHeading">
          <p class="eyebrow">Persönliche Worte</p>
          <h3 id="memoryHeading">${memoryHeading}</h3>
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
    `, "star-modal-card");

    const form = document.querySelector("#memoryForm");
    const status = document.querySelector("#memoryStatus");

    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;

      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        setStatus(status, "Bitte melde dich an, bevor du persönliche Worte einreichst.", "error");
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
      setStatus(status, "Deine persönlichen Worte wurden sicher und zunächst privat zur Prüfung übermittelt.", "success");
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

    // Add one occasional comet in the web and native star wall.
    const comet = document.createElement("span");
    comet.className = "shooting-comet";
    comet.setAttribute("aria-hidden", "true");
    comet.style.setProperty("--comet-y", `${(12 + random() * 48).toFixed(2)}%`);
    comet.style.setProperty("--comet-x", `${Math.ceil(sky.clientWidth + 220)}px`);
    comet.style.setProperty("--comet-fall", `${Math.ceil(sky.clientHeight * .16)}px`);
    comet.style.setProperty("--comet-period", `${(50 + random() * 16).toFixed(1)}s`);
    comet.style.setProperty("--comet-delay", `${(12 + random() * 12).toFixed(1)}s`);
    sky.appendChild(comet);
  }

  buildCelestialSky();

  let approvedMemorials = [];
  let viewerMemorialIds = new Set();
  let memorialLoadGeneration = 0;
  let wallUserId;
  let wallIsMember = false;
  const offlineWallEnabled = document.documentElement.classList.contains("native-app");

  function updateSkyCardAccess(isMember) {
    const skyCard = document.querySelector('[data-star="sky"]');
    if (skyCard) {
      if (!skyCard.dataset.memberMarkup) skyCard.dataset.memberMarkup = skyCard.innerHTML;
      skyCard.disabled = false;
      skyCard.setAttribute("aria-label", isMember ? "Skys Geschichte öffnen" : "Anmelden, um Skys Geschichte zu entdecken");
      skyCard.innerHTML = isMember
        ? skyCard.dataset.memberMarkup
        : `<span class="memorial-symbol"><span class="sky-symbol">✦</span></span><strong>Sky</strong>`;
    }
    setHidden(document.querySelector(".wall-controls"), !isMember);
  }

  function setWallLoading(loading) {
    document.querySelector("#memorialGrid")?.setAttribute("aria-busy", String(loading));
  }

  const publicWallCacheKey = "skysbridge-public-stars-v2";
  const memberWallCachePrefix = "skysbridge-member-stars-v2:";

  function readWallCache(key) {
    try {
      const cache = JSON.parse(localStorage.getItem(key) || "null");
      return cache && Array.isArray(cache.items) ? cache : null;
    } catch {
      return null;
    }
  }

  function writeWallCache(key, cache) {
    try {
      localStorage.setItem(key, JSON.stringify({ ...cache, saved_at: Date.now() }));
    } catch (error) {
      console.warn("Saved star cache unavailable:", error);
    }
  }

  function restoreWallCache(user) {
    wallIsMember = Boolean(user && !user.is_anonymous);
    wallUserId = wallIsMember ? user.id : null;

    const memberCache = wallIsMember
      ? readWallCache(`${memberWallCachePrefix}${user.id}`)
      : null;
    if (memberCache && memberCache.user_id === user.id) {
      approvedMemorials = memberCache.items;
      viewerMemorialIds = new Set(Array.isArray(memberCache.viewer_ids) ? memberCache.viewer_ids : []);
    } else {
      const publicCache = readWallCache(publicWallCacheKey);
      approvedMemorials = publicCache
        ? publicCache.items.map(item => ({ id: item.id, star_style: item.star_style }))
        : [];
      viewerMemorialIds = new Set();
    }

    updateSkyCardAccess(wallIsMember);
    renderApprovedMemorials(true);
    return Boolean(memberCache || readWallCache(publicWallCacheKey));
  }

  function rememberWallCache(user, items, viewerIds) {
    const publicItems = (items || []).map(item => ({
      id: item.id,
      star_style: item.star_style || "radiant"
    }));
    writeWallCache(publicWallCacheKey, { items: publicItems });

    if (!user || user.is_anonymous) return;
    const safeMemberItems = (items || []).map(item => item.is_public
      ? item
      : { id: item.id, star_style: item.star_style || "radiant" });
    const publicViewerIds = (items || []).filter(item => item.is_public && item.is_owner).map(item => item.id);
    writeWallCache(`${memberWallCachePrefix}${user.id}`, {
      user_id: user.id,
      items: safeMemberItems,
      viewer_ids: publicViewerIds
    });
  }

  function showOfflineWallStatus(status, hasSavedStars) {
    status.textContent = hasSavedStars
      ? 'Gespeicherte Sterne werden angezeigt. Bei Verbindung wird der aktuelle Stand geladen.'
      : 'Du bist offline. Sky bleibt sichtbar; die Sterne werden aktualisiert, sobald du wieder online bist.';
  }

  function sameMonthAndDay(value, today = new Date()) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").slice(0, 10));
    if (!match) return false;
    const [, year, month, day] = match.map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
    return month === today.getMonth() + 1 && day === today.getDate();
  }

  function formatPlainDate(value) {
    if (!value) return "";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(date);
  }

  function memorialDateLine(item) {
    const birth = formatPlainDate(item.birth_date);
    const passing = formatPlainDate(item.passing_date);
    if (birth && passing) return `${birth} — ${passing}`;
    if (birth) return `Geboren am ${birth}`;
    if (passing) return `In Erinnerung seit ${passing}`;
    return "";
  }

  function memorialDayState(item, today = new Date()) {
    // The remembrance anniversary takes priority when both dates share the same month and day.
    if (sameMonthAndDay(item.passing_date, today)) return "anniversary";
    if (sameMonthAndDay(item.birth_date, today)) return "birthday";
    return "standard";
  }

  function memorialSymbolMarkup(state, detailed = false, requestedStyle = "radiant") {
    if (state === "anniversary") {
      return `<img class="memorial-candle-image" src="assets/memorial-candle.svg" alt="${detailed ? "Eine brennende Gedenkkerze" : ""}">`;
    }

    const allowedStyles = ["radiant", "classic", "guiding", "halo", "signature", "comet", "petal", "north"];
    const style = allowedStyles.includes(requestedStyle) ? requestedStyle : "radiant";
    return `<span class="memorial-star-shape star-${style}" aria-hidden="true"></span>`;
  }

  async function memorialPhotoUrl(path) {
    if (!path || !db) return null;
    const { data: before } = await db.auth.getUser();
    if (!before?.user) return null;
    const { data, error } = await db.storage.from("memorial-photos").download(path);
    if (error || !data) {
      if (error) console.warn("Memorial photo unavailable:", error);
      return null;
    }
    const { data: after } = await db.auth.getUser();
    if (after?.user?.id !== before.user.id) return null;
    return URL.createObjectURL(data);
  }

  async function openApprovedMemorial(item) {
    const photoUrl = item.photo_path ? await memorialPhotoUrl(item.photo_path) : null;
    const state = memorialDayState(item);
    const dayLabel =
      state === "anniversary"
        ? "Heute in liebevoller Erinnerung"
        : state === "birthday"
          ? "Zum Geburtstag in liebevoller Erinnerung"
          : "Ein Licht, das bleibt";
    const dateLine = memorialDateLine(item);

    openModal(`
      <article class="memorial-detail-card is-${state}">
        <p class="eyebrow">${dayLabel}</p>
        <div class="memorial-detail-symbol">
          ${memorialSymbolMarkup(state, true, item.star_style)}
        </div>
        <h2 id="modalTitle">${escapeHtml(item.child_name || "Für immer geliebt")}</h2>
        ${dateLine ? `<p class="memorial-detail-meta">${escapeHtml(dateLine)}</p>` : ""}
        ${item.country ? `<p class="memorial-detail-meta">${escapeHtml(item.country)}</p>` : ""}
        ${photoUrl ? `<img class="memorial-detail-photo" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(item.child_name || "")}">` : ""}
        <div class="star-story-divider" aria-hidden="true"><span>✦</span></div>
        <div class="memorial-detail-story">${renderStoryParagraphs(item.remembrance)}</div>
      </article>
    `, "star-modal-card");
    modalPhotoUrl = photoUrl;
  }

  function renderApprovedMemorials(resolved = false) {
    const grid = document.querySelector("#memorialGrid");
    const status = document.querySelector("#wallStatus");
    if (!grid || !status) return;
    if (grid.getAttribute("aria-busy") === "true" && resolved !== true) return;

    grid.querySelectorAll("[data-public-memorial]").forEach(card => card.remove());

    const skyCard = grid.querySelector('[data-star="sky"]');
    updateSkyCardAccess(wallIsMember);
    skyCard?.classList.remove("is-secondary-light");
    skyCard?.style.removeProperty("--star-x");
    skyCard?.style.removeProperty("--star-y");

    if (!wallIsMember) {
      const plane = window.SkysbridgeSkyMap?.plane || grid;
      plane.querySelectorAll(".guest-star-only").forEach(card => card.remove());
      approvedMemorials.forEach((item, index) => {
        const star = document.createElement("button");
        star.type = "button";
        star.className = "memorial-card is-standard guest-star-only";
        star.dataset.publicMemorial = `guest-${index}`;
        star.setAttribute("aria-label", "Melde dich an, um die Geschichte hinter diesem Stern zu entdecken.");
        star.innerHTML = `<span class="memorial-symbol">${memorialSymbolMarkup("standard", false, item.star_style)}</span>`;
        star.addEventListener("click", showStarAccessPrompt);
        plane.appendChild(star);
      });
      window.SkysbridgeSkyMap?.layout([...plane.querySelectorAll(".guest-star-only")], skyCard, null);
      status.textContent = "";
      return;
    }

    const search = String(document.querySelector("#memorialSearch")?.value || "").trim().toLowerCase();
    const sort = document.querySelector("#memorialSort")?.value || "newest";
    let rows = approvedMemorials.filter(item =>
      !item.is_public ||
      !search ||
      String(item.child_name || "").toLowerCase().includes(search)
    );

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
      if (!item.is_public && !item.is_owner) {
        const star = document.createElement("div");
        star.className = "memorial-card is-standard anonymous-wall-star";
        star.dataset.publicMemorial = item.id;
        star.setAttribute("aria-hidden", "true");
        star.innerHTML = `<span class="memorial-symbol">${memorialSymbolMarkup("standard", false, item.star_style)}</span>`;
        grid.appendChild(star);
        return;
      }

      const state = item.is_public ? memorialDayState(item) : "standard";
      const card = document.createElement("button");
      card.type = "button";
      card.className = `memorial-card is-${state}${item.is_public ? "" : " is-private-owner-star"}`;
      card.dataset.publicMemorial = item.id;
      if (item.id === viewerCenter?.id) card.classList.add("is-viewer-center");
      card.setAttribute("aria-label", item.is_public
        ? `Open memorial for ${item.child_name || "a child remembered"}`
        : "Öffne deinen privaten Stern");

      card.style.animationDelay = `${(index % 7) * -.65}s`;

      if (!item.is_public) {
        card.innerHTML = `<span class="memorial-symbol">${memorialSymbolMarkup("standard", false, item.star_style)}</span>`;
        card.addEventListener("click", () => openApprovedMemorial(item));
        grid.appendChild(card);
        return;
      }

      const dateLine = memorialDateLine(item);
      const dayLabel =
        state === "anniversary"
          ? "Heute erinnern wir uns"
          : state === "birthday"
            ? "Heute feiern wir"
            : "Für immer in Erinnerung";

      card.innerHTML = `
        <span class="memorial-symbol">
          ${memorialSymbolMarkup(state, false, item.star_style)}
        </span>
        <span class="memorial-kicker">${"Ein Licht in Erinnerung"}</span>
        <strong>${escapeHtml(item.child_name || "Forever loved")}</strong>
        <span class="memorial-day">${dayLabel}</span>
        <span class="memorial-rule" aria-hidden="true"><i></i><b>✦</b><i></i></span>
        <small>${dateLine ? `<span class="memorial-dates">${escapeHtml(dateLine)}</span>` : "Forever loved. Forever remembered."}${item.country ? `<span class="memorial-dates">${escapeHtml(item.country)}</span>` : ""}</small>
      `;

      card.addEventListener("click", () => openApprovedMemorial(item));
      grid.appendChild(card);
    });

    const wallStars = [...grid.querySelectorAll(".memorial-card")];
    const centerStar = viewerCenter
      ? wallStars.find(card => card.dataset.publicMemorial === viewerCenter.id)
      : skyCard;
    window.SkysbridgeSkyMap?.layout(wallStars, centerStar, grid);

    if (search && !rows.length) status.textContent = `Kein Gedenkstern für „${document.querySelector("#memorialSearch").value.trim()}“ gefunden.`;
    else if (viewerCenter) status.textContent = `${viewerCenter.child_name || "Der Stern deines Kindes"} steht im Zentrum deines persönlichen Sternenhimmels.`;
    else if (approvedMemorials.length) status.textContent = `Sky und ${approvedMemorials.length} ${approvedMemorials.length === 1 ? "weiteres Licht" : "weitere Lichter"}.`;
    else status.textContent = "Sky ist das erste Licht. Weitere Gedenksterne erscheinen nach Zustimmung der Familie und Freigabe durch die Moderation.";
  }

  async function loadApprovedMemorials() {
    const status = document.querySelector("#wallStatus");
    if (!status) return;
    const generation = ++memorialLoadGeneration;
    setWallLoading(true);
    if (!db) {
      viewerMemorialIds = new Set();
      wallIsMember = false;
      wallUserId = null;
      updateSkyCardAccess(false);
      renderApprovedMemorials(true);
      setWallLoading(false);
      return;
    }

    let user = null;
    if (offlineWallEnabled) {
      try {
        const sessionResult = await db.auth.getSession();
        user = sessionResult.data?.session?.user || null;
      } catch (sessionError) {
        console.warn("Saved star session unavailable:", sessionError);
      }
    }
    if (generation !== memorialLoadGeneration) return;

    const hasSavedStars = offlineWallEnabled ? restoreWallCache(user) : false;
    if (offlineWallEnabled && hasSavedStars) setWallLoading(false);
    if (offlineWallEnabled && !navigator.onLine) {
      showOfflineWallStatus(status, hasSavedStars);
      setWallLoading(false);
      return;
    }

    status.textContent = 'Gedenksterne werden geladen …';
    if (!offlineWallEnabled || !hasSavedStars) setWallLoading(true);
    let nextViewerMemorialIds = new Set();

    try {
      try {
        const authResult = await db.auth.getUser();
        if (!authResult.error) user = authResult.data?.user || null;
        else if (authResult.error.name === "AuthSessionMissingError") user = null;
        else console.warn("Star ownership lookup unavailable:", authResult.error);
      } catch (authError) {
        console.warn("Star ownership lookup unavailable:", authError);
      }
      if (generation !== memorialLoadGeneration) return;
      wallIsMember = Boolean(user && !user.is_anonymous);
      wallUserId = wallIsMember ? user.id : null;
      updateSkyCardAccess(wallIsMember);

      let ownDetails = [];
      let publicDetails = [];
      if (wallIsMember) {
        const ownResult = await db
          .from("memorials")
          .select("id,child_name,remembrance,country,star_style,birth_date,passing_date,photo_path,created_at,public_requested,approved")
          .eq("user_id", user.id)
          .eq("archived", false)
          .is("rejection_reason", null);
        if (ownResult.error) throw ownResult.error;
        ownDetails = ownResult.data || [];

        const publicResult = await db
          .from("memorials")
          .select("id,child_name,remembrance,country,star_style,birth_date,passing_date,photo_path,created_at,public_requested,approved")
          .eq("approved", true)
          .eq("public_requested", true)
          .eq("archived", false)
          .order("created_at", { ascending: false });
        if (publicResult.error) throw publicResult.error;
        publicDetails = publicResult.data || [];
        nextViewerMemorialIds = new Set(ownDetails.map(item => item.id));
      }

      const shapeResult = await wallDb
        .from("memorials")
        .select("id,star_style");
      if (shapeResult.error) throw shapeResult.error;

      const ownById = new Map(ownDetails.map(item => [item.id, item]));
      const publicById = new Map(publicDetails.map(item => [item.id, item]));
      viewerMemorialIds = nextViewerMemorialIds;
      approvedMemorials = (shapeResult.data || []).map(shape => {
        const details = ownById.get(shape.id) || publicById.get(shape.id);
        return {
          ...shape,
          ...(details || {}),
          is_owner: ownById.has(shape.id),
          is_public: publicById.has(shape.id)
        };
      });
      if (offlineWallEnabled) rememberWallCache(user, approvedMemorials, viewerMemorialIds);
      renderApprovedMemorials(true);
    } catch (error) {
      if (generation !== memorialLoadGeneration) return;
      console.error("Memorial loading error:", error);
      if (!offlineWallEnabled) {
        viewerMemorialIds = new Set();
        wallIsMember = false;
        wallUserId = null;
        updateSkyCardAccess(false);
        approvedMemorials = [];
        renderApprovedMemorials(true);
        status.textContent = 'Die öffentlichen Gedenksterne konnten gerade nicht geladen werden. Sky bleibt als erstes Licht sichtbar.';
      } else {
        restoreWallCache(user);
        status.textContent = approvedMemorials.length
          ? 'Gespeicherte Sterne werden angezeigt. Bei Verbindung wird der aktuelle Stand geladen.'
          : 'Die öffentlichen Gedenksterne konnten gerade nicht geladen werden. Sky bleibt als erstes Licht sichtbar.';
      }
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

    const displayName = user.email ? user.email.split("@")[0] : "Mitglied";
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
      console.error("Sitzungsfehler:", sessionError);
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
      if (modalPhotoUrl || (modal && !modal.hidden)) closeModal();
      clearReviewPhotoUrls();
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

      if (memberGreeting) memberGreeting.textContent = "Willkommen bei Skysbridge";
      if (memberEmail) memberEmail.textContent = "";

      return;
    }

    currentUser = session.user;
    updateAuthButtons(true);

    try {
      currentProfile = await ensureProfile(currentUser);
    } catch (error) {
      console.error("Profilfehler:", error);
      currentProfile = {
        display_name: currentUser.email?.split("@")[0] || "Mitglied",
        is_admin: false
      };
    }


    setHidden(guest, true);
    setHidden(memberPanel, false);
    setHidden(roomArea, false);
    setHidden(roomView, true);

    if (memberGreeting) {
      memberGreeting.textContent =
        `Willkommen, ${currentProfile.display_name || "Mitglied"}`;
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

    roomList.innerHTML = `<p class="notice">Geschützte Räume werden geladen …</p>`;

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
          Zugang beantragen
        </button>
      `;
      let status = "Nicht beigetreten";

      if (membership?.status === "pending") {
        status = "Wartet auf Prüfung";
        action = `<button class="button button-outline" disabled>Anfrage ausstehend</button>`;
      } else if (membership?.status === "approved") {
        status = membership.role === "moderator" ? "Moderation" : "Freigeschaltetes Mitglied";
        action = `
          <button class="button button-gold open-room"
            data-room-id="${room.id}"
            data-room-name="${escapeHtml(translateRoomText(room.name))}">
            Raum betreten
          </button>
        `;
      } else if (membership?.status === "blocked") {
        status = "Zugang nicht verfügbar";
        action = `<button class="button button-outline" disabled>Zugang nicht verfügbar</button>`;
      }

      return `
        <article class="dashboard-card">
          <p class="room-status">${escapeHtml(status)}</p>
          <h3>${escapeHtml(translateRoomText(room.name))}</h3>
          <p>${escapeHtml(translateRoomText(room.description))}</p>
          ${action}
        </article>
      `;
    }).join("");

    roomList.querySelectorAll(".request-room").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Wird gesendet …";

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

    setStatus(status, "Wird veröffentlicht …");

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
    setStatus(status, "Dein Beitrag ist jetzt für freigeschaltete Mitglieder des Raums sichtbar.", "success");
    await loadPosts();
  });

  async function loadPosts() {
    const postList = document.querySelector("#postList");
    if (!postList) return;

    postList.innerHTML = `<p class="notice">Beiträge werden geladen …</p>`;

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
      postList.innerHTML = `<p class="notice">In diesem Raum ist es noch still. Du kannst als erste Person etwas teilen.</p>`;
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
          <strong>${escapeHtml(profileMap[post.user_id] || "Mitglied der Gemeinschaft")}</strong>
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
      <h3>Veröffentlichte Sterne</h3>
      <p class="muted">Verwalte Gedenksterne, die derzeit im Himmel voller Sterne sichtbar sind. Sky ist dauerhaft geschützt.</p>
      <div id="publishedMemorials"><p class="muted">Wird geladen …</p></div>
    `;
    grid.appendChild(card);
  }

  async function loadPublishedMemorials() {
    ensurePublishedMemorialAdminSection();

    const target = document.querySelector("#publishedMemorials");
    if (!target) return;

    if (!currentProfile?.is_admin) {
      target.innerHTML = `<p class="notice error">Administratorzugang ist erforderlich.</p>`;
      return;
    }

    target.innerHTML = `<p class="muted">Wird geladen …</p>`;

    let result = await db
      .from("memorials")
      .select("id,child_name,country,photo_path,created_at")
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
      target.innerHTML = `<p class="muted">Keine veröffentlichten Gedenksterne. Sky bleibt dauerhaft sichtbar.</p>`;
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
            Stern löschen
          </button>
        </div>
      </div>
    `).join("");

    target.querySelectorAll(".delete-published-memorial").forEach(button => {
      button.onclick = async () => {
        const memorialId = button.dataset.id;
        const photoPath = memorials.find(item => item.id === memorialId)?.photo_path;
        const childName = button.dataset.name || "dieses Kind";

        if (!memorialId) return;

        const confirmed = window.confirm(
          `Den Stern für ${childName} dauerhaft löschen? Dies kann nicht rückgängig gemacht werden.`
        );

        if (!confirmed) return;

        const originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = "Wird gelöscht …";

        let deleted = false;
        let deleteError = null;

        const rpcResult = await db.rpc("admin_delete_published_memorial", {
          p_memorial_id: memorialId
        });

        if (!rpcResult.error) {
          deleted = rpcResult.data === true;
        } else if (/function|schema cache|admin_delete_published_memorial/i.test(rpcResult.error.message || "")) {
          // Kompatibilitäts-Fallback, falls die V36-SQL noch nicht ausgeführt wurde.
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
          window.alert(`Der Stern konnte nicht gelöscht werden: ${deleteError.message}`);
          return;
        }

        if (!deleted) {
          button.disabled = false;
          button.textContent = originalLabel;
          window.alert(
            "Es wurde nichts gelöscht. Führe RUN_ONCE_IN_SUPABASE.sql aus und bestätige, dass dein Profil is_admin = true besitzt."
          );
          return;
        }

        if (photoPath) await db.storage.from("memorial-photos").remove([photoPath]);

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

    target.innerHTML = `<p class="muted">Wird geladen …</p>`;

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
      target.innerHTML = `<p class="muted">Keine offenen Zugangsanfragen.</p>`;
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
        <p>${escapeHtml(groupMap[item.group_id] || "Raum")}</p>
        <div class="review-actions">
          <button class="button button-gold approve-member"
            data-group-id="${item.group_id}"
            data-user-id="${item.user_id}">Freigeben</button>
          <button class="button button-danger decline-member"
            data-group-id="${item.group_id}"
            data-user-id="${item.user_id}">Sperren</button>
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
    clearReviewPhotoUrls();
    const target = document.querySelector("#pendingMemorials");
    if (!target) return;

    target.innerHTML = `<p class="muted">Wird geladen …</p>`;

    const { data, error } = await db
      .from("memorials")
      .select("id,child_name,remembrance,country,public_requested,photo_path,created_at")
      .eq("approved", false)
      .is("rejection_reason", null)
      .order("created_at", { ascending: true });

    if (error) {
      target.innerHTML = `<p class="notice error">${escapeHtml(error.message)}</p>`;
      return;
    }

    if (!data?.length) {
      target.innerHTML = `<p class="muted">Keine Gedenksterne zur Prüfung.</p>`;
      return;
    }

    target.innerHTML = data.map(item => `
      <div class="review-item">
        <strong>${escapeHtml(item.child_name)}</strong>
        <p>${escapeHtml(item.remembrance)}</p>
        ${item.photo_path ? `<p class="muted">Foto zur Prüfung eingereicht</p><img class="memorial-review-photo" data-photo-path="${escapeHtml(item.photo_path)}" alt="">` : ""}
        <p>${item.public_requested ? "Öffentlichen Sternenhimmel beantragt" : "Private Erinnerung"}</p>
        <div class="review-actions">
          <button class="button button-gold review-memorial" data-id="${item.id}" data-decision="approve">Freigeben</button>
          <button class="button button-danger review-memorial" data-id="${item.id}" data-decision="decline">Ablehnen</button>
        </div>
      </div>
    `).join("");

    target.querySelectorAll(".memorial-review-photo").forEach(async img => {
      const url = await memorialPhotoUrl(img.dataset.photoPath);
      if (url && img.isConnected && currentUser) {
        img.src = url;
        reviewPhotoUrls.add(url);
      } else if (url) URL.revokeObjectURL(url);
    });

    target.querySelectorAll(".review-memorial").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;

        const approved = button.dataset.decision === "approve";
        const { error: updateError } = await db
          .from("memorials")
          .update({
            approved,
            rejection_reason: approved ? null : "Derzeit nicht freigegeben."
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

    target.innerHTML = `<p class="muted">Wird geladen …</p>`;

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
      target.innerHTML = `<p class="muted">Keine Erinnerungen zur Prüfung.</p>`;
      return;
    }

    target.innerHTML = data.map(item => `
      <div class="review-item">
        <strong>${escapeHtml(item.author_name)} · ${escapeHtml(item.star_slug)}</strong>
        <p>${escapeHtml(item.message)}</p>
        <div class="review-actions">
          <button class="button button-gold review-memory" data-id="${item.id}" data-decision="approve">Freigeben</button>
          <button class="button button-danger review-memory" data-id="${item.id}" data-decision="decline">Ablehnen</button>
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
            rejection_reason: approved ? null : "Derzeit nicht freigegeben."
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
      console.error("Abmeldefehler:", error);
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
  if (offlineWallEnabled) window.addEventListener("online", loadApprovedMemorials);

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
