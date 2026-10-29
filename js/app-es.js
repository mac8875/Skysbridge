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
  const wallDb = configured
    ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      })
    : null;

  const roomCopy = {"Newly Bereaved": "Duelo reciente", "A gentle place for the days when everything still feels unreal.": "Un lugar acogedor para los días en que todo parece todavía irreal.", "A gentle room for the first days and months after loss.": "Un lugar acogedor para los primeros días y meses después de la pérdida.", "Fathers' Space": "Espacio para padres", "A protected place for fathers whose grief is too often left unspoken.": "Un lugar protegido para los padres cuyo duelo tantas veces queda en silencio.", "A protected room for fathers to speak openly without judgment.": "Un espacio protegido para que los padres hablen abiertamente y sin ser juzgados.", "Remembering Together": "Recordar juntos", "A place for names, anniversaries, memories and the rituals that keep love close.": "Un lugar para nombres, aniversarios, recuerdos y rituales que mantienen cerca el amor.", "A place for anniversaries, memories and rituals of remembrance.": "Un lugar para aniversarios, recuerdos y rituales de homenaje."};
  const roomText = value => roomCopy[value] || value;
  let currentUser = null;
  let currentProfile = null;
  let activeRoomId = null;
  let modalPhotoUrl = null;
  let modalRequestGeneration = 0;
  let familySharingGeneration = 0;
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
    modalRequestGeneration += 1;

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
    modalRequestGeneration += 1;

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
    const story = String(value || "Siempre en nuestros corazones.").replace(/\\r?\\n/g, "\n").trim();
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
      <p class="eyebrow">Una invitación serena</p>
      <h2 id="modalTitle">Cada estrella guarda una historia</h2>
      <p>Inicia sesión o crea una cuenta gratuita para leer los recuerdos compartidos en las estrellas públicas.</p>
      <div class="tabs">
        <button class="button button-gold" id="starAccessLogin" type="button">Iniciar sesión</button>
        <button class="button button-outline" id="starAccessSignup" type="button">Crear cuenta</button>
      </div>
    `, "star-access-card");
    document.querySelector("#starAccessLogin")?.addEventListener("click", () => showAuth(false, "login"));
    document.querySelector("#starAccessSignup")?.addEventListener("click", () => showAuth(false, "signup"));
  }

  function hasSignedInWallAccess() {
    return Boolean((currentUser && !currentUser.is_anonymous) || wallIsMember);
  }

  function addPasswordVisibilityToggles(form) {
    const language = document.documentElement.lang || "en";
    const words = {
      de: { show: "Passwort anzeigen", hide: "Passwort verbergen" },
      en: { show: "Show password", hide: "Hide password" },
      es: { show: "Mostrar contraseña", hide: "Ocultar contraseña" }
    }[language] || { show: "Show password", hide: "Hide password" };

    form?.querySelectorAll('input[type="password"]').forEach((input, index) => {
      const field = input.closest("label");
      if (!field) return;

      const fieldLabel = field.textContent.trim();
      const inputId = input.id || `password-field-${index + 1}`;
      input.id = inputId;

      const fieldContainer = document.createElement("div");
      fieldContainer.className = "password-field";
      const label = document.createElement("label");
      label.htmlFor = inputId;
      label.textContent = fieldLabel;

      const inputWrap = document.createElement("div");
      inputWrap.className = "password-input-wrap";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "password-toggle";
      toggle.setAttribute("aria-label", words.show);
      toggle.setAttribute("aria-pressed", "false");
      toggle.title = words.show;
      toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      toggle.addEventListener("mousedown", event => event.preventDefault());
      toggle.addEventListener("click", () => {
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        toggle.setAttribute("aria-pressed", String(visible));
        toggle.setAttribute("aria-label", visible ? words.hide : words.show);
        toggle.title = visible ? words.hide : words.show;
        input.focus();
      });

      inputWrap.append(input, toggle);
      fieldContainer.append(label, inputWrap);
      field.replaceWith(fieldContainer);
    });
  }

  function showAuth(forMemorial = false, initialMode = "login") {
    openModal(`
      <h2 id="modalTitle">${forMemorial ? "Inicia sesión para honrar a un hijo" : "Únete a Skysbridge"}</h2>
      ${forMemorial ? "<p>Para proteger la historia de cada hijo, inicia sesión o crea una cuenta antes de crear un recuerdo.</p>" : ""}
      <div class="tabs">
        <button class="button button-gold" id="loginTab">Iniciar sesión</button>
        <button class="button button-outline" id="signupTab">Crear cuenta</button>
      </div>
      <form class="form-grid" id="authForm">
        <label id="signupNameField" hidden>Nombre completo
          <input type="text" name="display_name" maxlength="80" autocomplete="name">
        </label>
        <label>Correo electrónico
          <input type="email" name="email" required autocomplete="email">
        </label>
        <label>Contraseña
          <input type="password" name="password" required minlength="8" autocomplete="current-password">
        </label>
        <button class="text-link auth-recovery-link" type="button" id="forgotPassword">¿Olvidaste tu contraseña?</button>
        <button class="button button-gold" type="submit">Iniciar sesión</button>
        <div class="notice" id="authStatus">${forMemorial ? "Después de iniciar sesión, el formulario se abrirá automáticamente." : "Tu cuenta y tu actividad en las salas son privadas por defecto."}</div>
      </form>
    `, "auth-modal-card");

    let mode = initialMode === "signup" ? "signup" : "login";
    const form = document.querySelector("#authForm");
    addPasswordVisibilityToggles(form);
    const status = document.querySelector("#authStatus");
    const forgotLink = document.querySelector("#forgotPassword");
    const signupNameField = document.querySelector("#signupNameField");
    const signupNameInput = form.querySelector('input[name="display_name"]');

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
      if (forgotLink) forgotLink.hidden = mode !== "login";
      setHidden(signupNameField, mode !== "signup");
      if (signupNameInput) signupNameInput.required = mode === "signup";
    }

    setMode(mode);

    forgotLink?.addEventListener("click", async () => {
      if (!requireDatabase(status)) return;
      const emailInput = form.querySelector('input[name="email"]');
      const email = String(emailInput?.value || "").trim();
      if (!email || !emailInput?.validity.valid) {
        setStatus(status, "Escribe arriba el correo electrónico de tu cuenta.", "error");
        emailInput?.focus();
        return;
      }

      forgotLink.disabled = true;
      setStatus(status, "Enviando el enlace para restablecer la contraseña…");
      const isNativeApp = Boolean(
        window.Capacitor?.isNativePlatform?.() ||
        ["android", "ios"].includes(window.Capacitor?.getPlatform?.())
      );
      const redirectBase = isNativeApp ? "https://skysbridge.org" : window.location.origin;
      const redirectUrl = new URL(window.location.pathname, redirectBase);
      redirectUrl.searchParams.set("auth", "recovery");
      if (forMemorial) redirectUrl.searchParams.set("memorial", "1");
      try {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl.toString()
        });
        if (error) throw error;
        setStatus(status, "Si existe una cuenta con este correo, hemos enviado un enlace para restablecer la contraseña. Revisa también la carpeta de spam.", "success");
      } catch (_) {
        setStatus(status, "No se pudo enviar el enlace. Inténtalo de nuevo más tarde.", "error");
      } finally {
        forgotLink.disabled = false;
      }
    });

    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;

      setStatus(status, "Espera, por favor…");
      const values = new FormData(form);
      const email = values.get("email");
      const password = values.get("password");
      const displayName = String(values.get("display_name") || "").trim();

      const result = mode === "login"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName } }
          });

      if (result.error) {
        const emailLimitReached = result.error.code === "over_email_send_rate_limit" || /email rate limit exceeded/i.test(result.error.message || "");
        setStatus(status, emailLimitReached ? 'No se pueden enviar correos de confirmación temporalmente porque se ha alcanzado el límite de envío. Inténtalo de nuevo más tarde. Si ya tienes una cuenta confirmada, elige Iniciar sesión.' : ({"Invalid login credentials":"El correo o la contraseña no son correctos.","Email not confirmed":"Confirma tu correo electrónico antes de iniciar sesión.","User already registered":"Ya existe una cuenta con este correo electrónico."})[result.error.message] || result.error.message, "error");
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

  function showPasswordRecovery(forMemorial = false) {
    openModal(
      "<h2 id=\"modalTitle\">Elige una contraseña nueva</h2>" +
      "<form class=\"form-grid\" id=\"passwordRecoveryForm\">" +
      "<label>Contraseña nueva<input type=\"password\" name=\"password\" required minlength=\"8\" autocomplete=\"new-password\"></label>" +
      "<label>Confirmar contraseña nueva<input type=\"password\" name=\"confirm_password\" required minlength=\"8\" autocomplete=\"new-password\"></label>" +
      "<button class=\"button button-gold\" type=\"submit\">Guardar contraseña nueva</button>" +
      "<div class=\"notice\" id=\"authStatus\" aria-live=\"polite\"></div>" +
      "</form>",
      "auth-modal-card"
    );

    const form = document.querySelector("#passwordRecoveryForm");
    addPasswordVisibilityToggles(form);
    const status = document.querySelector("#authStatus");
    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;
      const values = new FormData(form);
      const password = String(values.get("password") || "");
      const confirmation = String(values.get("confirm_password") || "");
      if (password !== confirmation) {
        setStatus(status, "Las contraseñas no coinciden.", "error");
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      setStatus(status, "Guardando la contraseña…");
      try {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        setStatus(status, "Tu contraseña se ha actualizado. Has iniciado sesión.", "success");
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("auth");
        cleanUrl.searchParams.delete("memorial");
        cleanUrl.hash = "";
        window.history.replaceState({}, document.title, cleanUrl.toString());
        window.setTimeout(async () => {
          closeModal();
          await refreshSession();
          if (forMemorial) showMemorial();
          else openMemberArea();
        }, 700);
      } catch (_) {
        submitButton.disabled = false;
        setStatus(status, "No se pudo actualizar la contraseña. Puede que el enlace haya caducado; solicita uno nuevo.", "error");
      }
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
      <p>Las estrellas privadas aparecen en el cielo con el nombre del hijo. Las estrellas solicitadas para publicación aparecen después de la aprobación del moderador. El recuerdo y los demás datos siguen siendo privados hasta entonces.</p>
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
        <label>Foto de tu hijo (opcional, JPEG, PNG o WebP, hasta 5 MB)
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp">
        </label>
        <p class="muted">Solo los miembros con sesión iniciada pueden ver la foto después de que solicites una estrella pública y se apruebe el recuerdo.</p>
        <fieldset class="star-picker">
          <legend>Elige una estrella</legend>
          <div class="star-picker-grid">
            <label class="star-choice"><input type="radio" name="star_style" value="radiant" checked><span class="star-choice-preview star-radiant" aria-hidden="true"></span><span>Radiante</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="classic"><span class="star-choice-preview star-classic" aria-hidden="true"></span><span>Clásica</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="guiding"><span class="star-choice-preview star-guiding" aria-hidden="true"></span><span>Luz guía</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="halo"><span class="star-choice-preview star-halo" aria-hidden="true"></span><span>Halo</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="signature"><span class="star-choice-preview star-signature" aria-hidden="true"></span><span>La estrella de Sky</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="comet"><span class="star-choice-preview star-comet" aria-hidden="true"></span><span>Cometa</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="petal"><span class="star-choice-preview star-petal" aria-hidden="true"></span><span>Pétalo</span></label>
            <label class="star-choice"><input type="radio" name="star_style" value="north"><span class="star-choice-preview star-north" aria-hidden="true"></span><span>Estrella polar</span></label>
          </div>
        </fieldset>
        <label class="public-request-option">
          <input class="public-request-option__checkbox" type="checkbox" name="public_requested">
          <span class="public-request-option__copy">
            <strong>Solicitar que la estrella aparezca en el cielo público (opcional)</strong>
            <span>Al marcar la casilla, solicitas que el recuerdo y otros datos se publiquen después de la aprobación del moderador. Si no la marcas, la estrella y el nombre aparecerán en el cielo, mientras que el recuerdo y los demás datos seguirán siendo privados.</span>
          </span>
        </label>
        <button class="button button-gold">Enviar recuerdo</button>
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

      const photo = values.get("photo");
      let photoPath = null;
      if (photo instanceof File && photo.size) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
          setStatus(status, "Elige una imagen JPEG, PNG o WebP de hasta 5 MB.", "error");
          return;
        }
        const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[photo.type];
        photoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await db.storage.from("memorial-photos").upload(photoPath, photo, {
          contentType: photo.type,
          upsert: false
        });
        if (uploadError) {
          setStatus(status, "No se pudo subir la foto: " + uploadError.message, "error");
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
      setStatus(status, payload.public_requested ? "Se envió tu solicitud de publicación. La estrella y el nombre aparecerán después de la aprobación del moderador; hasta entonces, el recuerdo seguirá siendo privado." : "Tu estrella privada aparece en el cielo con el nombre de tu hijo. El recuerdo permanece privado.", "success");
      await loadApprovedMemorials();
    };
  }

  document.querySelectorAll("[data-star]").forEach(element => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!hasSignedInWallAccess()) {
        showStarAccessPrompt();
        return;
      }
      showStar(element.dataset.star);
    });
  });

  function showStar(slug) {
    let star = {
      name: "Sky",
      story:
        "Vivió solo unos meses. Pero ninguna medida del tiempo puede expresar lo que significa para nosotros. Nos enseñó que el amor no se cuenta en años, sino en la profundidad del vínculo que permanece.\n\nDespués de perderlo, descubrimos lo silencioso y solitario que puede ser el duelo. Seguimos amando y echando de menos a nuestro hijo; sigue siendo parte de la familia. Sin embargo, el mundo suele guardar silencio en torno a su nombre.\n\nAños después, el amor por Sky dio origen a Skysbridge: un lugar donde los hijos que se fueron demasiado pronto pueden tener un nombre, ser honrados y recordados con dignidad, y donde sus historias pueden permanecer.\n\nSky es la primera luz del cielo lleno de estrellas. Con su estrella comenzó este lugar y, junto a él, cada hijo puede tener su propia luz."
    };

    const personalSkyOpening =
      "El momento en que supe que Sky existía fue uno de los más felices de mi vida. Tener que despedirme de él se convirtió en el dolor más profundo que he conocido.";
    const legacySkyOpening = "El momento en que supe que Sky existía fue uno de los más felices de mi vida. Tener que dejarlo ir se convirtió en el dolor más profundo que he conocido.";

    if (slug === "sky") {
      star.story = String(star.story || "").replace(legacySkyOpening, personalSkyOpening);
      if (!star.story.includes(personalSkyOpening)) {
        star.story = `${personalSkyOpening}\n\n${star.story}`.trim();
      }
    }

    const starName = escapeHtml(slug === "sky" ? "Sky" : (star.name || "Un hijo recordado"));
    const storyHtml = renderStoryParagraphs(star.story);
    const canSendSkyLove = slug === "sky" && Boolean(
      currentProfile?.is_admin || approvedMemorials.some(item => item.is_family)
    );

    openModal(`
      <article class="star-remembrance ${slug === "sky" ? `is-${window.SkyRemembrance.state()}` : ""}">
        <header class="star-remembrance-header">
          <p class="eyebrow">Una luz que permanece</p>
          <span class="star-remembrance-symbol${canSendSkyLove ? " memorial-love-target" : ""}" aria-hidden="true">${slug === "sky" ? window.SkyRemembrance.symbol(true) : '<img src="assets/memorial-star.svg?v=55" alt="">'}${canSendSkyLove ? '<span class="memorial-love-orbit"><i>♡</i><i>♡</i><i>♡</i></span>' : ""}</span>
          <h2 id="modalTitle">${starName}</h2>
          <p class="star-remembrance-subtitle">Su vida fue breve. Su luz permanece.</p>
          ${slug === "sky" ? '<p class="memorial-detail-meta">Nació el <time datetime="2019-02-09">9 de febrero de 2019</time></p>' : ""}
          ${canSendSkyLove ? '<button class="memorial-love-button" id="memorialLoveButton" type="button"><span aria-hidden="true">♡</span>Enviar cariño</button><p class="memorial-love-status" id="memorialLoveStatus" aria-live="polite">Para ti y tu familia</p>' : ""}
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

    const loveButton = modalContent.querySelector("#memorialLoveButton");
    const loveTarget = modalContent.querySelector(".memorial-love-target");
    const loveStatus = modalContent.querySelector("#memorialLoveStatus");
    let loveAnimationTimer = null;
    loveButton?.addEventListener("click", () => {
      if (!canSendSkyLove || !loveTarget) return;
      window.clearTimeout(loveAnimationTimer);
      loveTarget.classList.remove("is-sending-love");
      void loveTarget.offsetWidth;
      loveTarget.classList.add("is-sending-love");
      loveStatus.textContent = "Un saludo dorado rodea a Sky.";
      loveAnimationTimer = window.setTimeout(() => {
        loveTarget.classList.remove("is-sending-love");
        loveStatus.textContent = "Para ti y tu familia";
      }, 3800);
    });

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
    const starModalGeneration = modalRequestGeneration;
    if (db && slug !== "sky") {
      db.from("stars")
        .select("name,story")
        .eq("slug", slug)
        .eq("is_public", true)
        .maybeSingle()
        .then(({ data }) => {
          if (!data || starModalGeneration !== modalRequestGeneration || modal.hidden) return;
          const storyCopy = modalContent.querySelector(".star-story-copy");
          let story = data.story || "";
          if (slug === "sky") {
            story = story.replace(legacySkyOpening, personalSkyOpening);
            if (!story.includes(personalSkyOpening)) story = `${personalSkyOpening}\n\n${story}`.trim();
          }
          if (storyCopy) storyCopy.innerHTML = renderStoryParagraphs(story);
          const title = modalContent.querySelector("#modalTitle");
          if (title) title.textContent = data.name || "Un hijo recordado";
          const heading = modalContent.querySelector("#memoryHeading");
          if (heading) heading.textContent = `Comparte un recuerdo de ${data.name || "Un hijo recordado"}`;
        })
        .catch(error => console.warn("No se pudo cargar la historia de la estrella:", error));
    }
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
  let wallIsMember = false;
  const offlineWallEnabled = document.documentElement.classList.contains("native-app");

  function updateSkyCardAccess(isMember) {
    const skyCard = document.querySelector('[data-star="sky"]');
    if (skyCard) {
      if (!skyCard.dataset.memberMarkup) skyCard.dataset.memberMarkup = skyCard.innerHTML;
      skyCard.disabled = false;
      skyCard.setAttribute("aria-label", isMember ? "Abrir la historia de Sky" : "Inicia sesión para descubrir la historia de Sky");
      skyCard.innerHTML = isMember
        ? skyCard.dataset.memberMarkup
        : `<span class="memorial-symbol"><span class="sky-symbol">✦</span></span><strong>Sky</strong>`;
    }
    setHidden(document.querySelector(".wall-controls"), !isMember);
  }

  function setWallLoading(loading) {
    document.querySelector("#memorialGrid")?.setAttribute("aria-busy", String(loading));
  }

  const publicWallCacheKey = "skysbridge-public-stars-v3";
  const memberWallCachePrefix = "skysbridge-member-stars-v3:";

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
        ? publicCache.items.map(item => ({ id: item.id, child_name: item.child_name, star_style: item.star_style, is_public: item.is_public }))
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
      child_name: item.child_name,
      star_style: item.star_style || "radiant",
      is_public: Boolean(item.is_public)
    }));
    writeWallCache(publicWallCacheKey, { items: publicItems });

    if (!user || user.is_anonymous) return;
    const safeMemberItems = (items || []).filter(item => !item.is_family).map(item => item.is_public
      ? item
      : { id: item.id, child_name: item.child_name, star_style: item.star_style || "radiant", is_public: false });
    const publicViewerIds = (items || []).filter(item => item.is_public && item.is_owner && !item.is_family).map(item => item.id);
    writeWallCache(`${memberWallCachePrefix}${user.id}`, {
      user_id: user.id,
      items: safeMemberItems,
      viewer_ids: publicViewerIds
    });
  }

  function showOfflineWallStatus(status, hasSavedStars) {
    status.textContent = hasSavedStars
      ? 'Se muestran las estrellas guardadas. Se actualizarán al volver a conectarte.'
      : 'Estás sin conexión. Sky sigue visible; las estrellas se actualizarán cuando vuelvas a conectarte.';
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

  function memorialDayState(item, today = new Date()) {
    // The remembrance anniversary takes priority when both dates share the same month and day.
    if (sameMonthAndDay(item.passing_date, today)) return "anniversary";
    if (sameMonthAndDay(item.birth_date, today)) return "birthday";
    return "standard";
  }

  function memorialSymbolMarkup(state, detailed = false, requestedStyle = "radiant") {
    if (state === "anniversary") {
      return `<img class="memorial-candle-image" src="assets/memorial-candle.svg" alt="${detailed ? "Una vela encendida en su memoria" : ""}">`;
    }

    const allowedStyles = ["radiant", "classic", "guiding", "halo", "signature", "comet", "petal", "north"];
    const style = allowedStyles.includes(requestedStyle) ? requestedStyle : "radiant";
    const depth = style === "halo" ? "" : [1, 2, 3, 4, 5].map((layer) => `<span class="memorial-star-depth star-${style}" style="--star-depth:${layer}px"></span>`).join("");
    return `<span class="memorial-star-volume" aria-hidden="true">${depth}<span class="memorial-star-shape star-${style}"></span></span>`;
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

  function openApprovedMemorial(item) {
    const state = memorialDayState(item);
    const dayLabel =
      state === "anniversary"
        ? "Hoy, en su memoria"
        : state === "birthday"
          ? "En su cumpleaños, le recordamos"
          : "Una luz que permanece";
    const dateLine = memorialDateLine(item);
    const canWriteMemory = Boolean(item.is_star_owner);
    const isSkyMemorial = String(item.child_name || "").trim().toLowerCase() === "sky";
    const canSendLove = Boolean(item.is_owner || (currentProfile?.is_admin && isSkyMemorial));

    openModal(`
      <article class="memorial-detail-card is-${state}">
        <p class="eyebrow">${dayLabel}</p>
        <div class="memorial-detail-symbol${canSendLove ? " memorial-love-target" : ""}">
          ${memorialSymbolMarkup(state, true, item.star_style)}
          ${canSendLove ? '<span class="memorial-love-orbit" aria-hidden="true"><i>♡</i><i>♡</i><i>♡</i></span>' : ""}
        </div>
        <h2 id="modalTitle">${escapeHtml(item.child_name || "Siempre amado")}</h2>
        ${dateLine ? `<p class="memorial-detail-meta">${escapeHtml(dateLine)}</p>` : ""}
        ${item.country ? `<p class="memorial-detail-meta">${escapeHtml(item.country)}</p>` : ""}
        ${canSendLove ? '<button class="memorial-love-button" id="memorialLoveButton" type="button"><span aria-hidden="true">♡</span>Enviar cariño</button><p class="memorial-love-status" id="memorialLoveStatus" aria-live="polite">Solo para ti y tu familia</p>' : ""}
        ${item.photo_path ? '<div class="memorial-detail-photo-slot"></div>' : ""}
        <div class="star-story-divider" aria-hidden="true"><span>✦</span></div>
        <div class="memorial-detail-story">${renderStoryParagraphs(item.remembrance)}</div>
        <section class="memory-section" id="memorySection" aria-labelledby="memoryHeading"${canWriteMemory ? "" : " hidden"}>
          <p class="eyebrow">Palabras para recordar</p>
          <h3 id="memoryHeading">Recuerdos</h3>
${canWriteMemory ? `          <p class="memory-intro">Tu recuerdo escrito se revisa antes de que pueda hacerse público. Las fotos adjuntas a los recuerdos siempre son privadas y solo las ve quien creó la estrella y sus familiares aceptados.</p>
          <form class="form-grid memory-form" id="memoryForm">
            <label>Tu nombre<input type="text" name="author_name" required maxlength="80" autocomplete="name"></label>
            <label>Tu recuerdo<textarea name="message" required maxlength="3000"></textarea></label>
            <button class="button button-gold" type="submit">Enviar recuerdo para revisión</button>
            <div class="notice" id="memoryStatus">Los recuerdos se revisan antes de hacerse visibles.</div>
          </form>` : ""}
        </section>
      </article>
    `, "star-modal-card");
    window.dispatchEvent(new CustomEvent("skysbridge:open-memorial", { detail: { memorialId: item.id } }));

    const loveButton = modalContent.querySelector("#memorialLoveButton");
    const loveTarget = modalContent.querySelector(".memorial-love-target");
    const loveStatus = modalContent.querySelector("#memorialLoveStatus");
    let loveAnimationTimer = null;
    loveButton?.addEventListener("click", () => {
      if (!canSendLove || !loveTarget) return;
      window.clearTimeout(loveAnimationTimer);
      loveTarget.classList.remove("is-sending-love");
      void loveTarget.offsetWidth;
      loveTarget.classList.add("is-sending-love");
      loveStatus.textContent = "Un saludo dorado rodea la estrella.";
      loveAnimationTimer = window.setTimeout(() => {
        loveTarget.classList.remove("is-sending-love");
        loveStatus.textContent = "Solo para ti y tu familia";
      }, 3800);
    });

    const photoGeneration = modalRequestGeneration;
    if (item.photo_path) {
      memorialPhotoUrl(item.photo_path).then(photoUrl => {
        const slot = modalContent.querySelector(".memorial-detail-photo-slot");
        if (!photoUrl) return;
        if (photoGeneration !== modalRequestGeneration || modal.hidden || !slot) {
          URL.revokeObjectURL(photoUrl);
          return;
        }
        const photo = document.createElement("img");
        photo.className = "memorial-detail-photo";
        photo.src = photoUrl;
        photo.alt = item.child_name || "";
        slot.replaceWith(photo);
        modalPhotoUrl = photoUrl;
      }).catch(error => console.warn("Could not load the memorial photo:", error));
    }
  }

  function showPrivateStarNotice(item) {
    const canRequest = Boolean(item?.id && !item.is_owner && !item.is_family);
    openModal(`
      <p class="eyebrow">Esta estrella es privada</p>
      <h2 id="modalTitle">${escapeHtml(item.child_name || "Siempre amado")}</h2>
      <p>El recuerdo de esta estrella es privado y solo puede verlo su familia.</p>
      ${canRequest ? `<button class="button button-gold family-access-request-button" type="button">${currentUser && !currentUser.is_anonymous ? "Solicitar acceso familiar" : "Inicia sesión para solicitar acceso familiar"}</button>` : ""}
    `, "star-access-card");
    if (!canRequest) return;
    modalContent?.querySelector(".family-access-request-button")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      if (!currentUser || currentUser.is_anonymous) { showStarAccessPrompt(); return; }
      if (!db) return;
      button.disabled = true;
      const { error } = await db.from("memorial_family_requests").insert({
        memorial_id: item.id,
        requester_user_id: currentUser.id,
        requester_email: String(currentUser.email || "").trim().toLowerCase(),
        requester_name: String(currentProfile?.display_name || currentUser.email?.split("@")[0] || "Miembro de Skysbridge").trim().slice(0, 80)
      });
      if (error) {
        button.disabled = false;
        const notice = document.createElement("p");
        notice.className = "notice error";
        notice.textContent = error.code === "23505" ? "Ya has solicitado acceso familiar para esta estrella." : "No se pudo enviar la solicitud. Inténtalo de nuevo.";
        button.insertAdjacentElement("afterend", notice);
        return;
      }
      button.textContent = "Solicitud enviada";
      button.disabled = true;
      const notice = document.createElement("p");
      notice.className = "notice success";
      notice.textContent = "Tu solicitud se envió a la familia. Pueden invitarte para leer esta estrella.";
      button.insertAdjacentElement("afterend", notice);
    });
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
        const childName = item.child_name || "Siempre amado";
        const isPrivate = !item.is_public;
        star.type = "button";
        star.className = `memorial-card is-standard guest-star-only${isPrivate ? " is-private-wall-star" : ""}`;
        star.dataset.publicMemorial = `guest-${index}`;
        star.setAttribute("aria-label", isPrivate
          ? `${childName}. Esta estrella es privada.`
          : `Inicia sesión para leer el recuerdo público de ${childName}.`);
        star.innerHTML = `<span class="memorial-symbol">${memorialSymbolMarkup("standard", false, item.star_style)}</span><strong>${escapeHtml(childName)}</strong>`;
        star.addEventListener("click", () => isPrivate ? showPrivateStarNotice(item) : showStarAccessPrompt());
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
        const star = document.createElement("button");
        const childName = item.child_name || "Siempre amado";
        star.type = "button";
        star.className = "memorial-card is-standard is-private-wall-star";
        star.dataset.publicMemorial = item.id;
        star.setAttribute("aria-label", `${childName}. Esta estrella es privada.`);
        star.style.animationDelay = `${(index % 7) * -.65}s`;
        star.innerHTML = `<span class="memorial-symbol">${memorialSymbolMarkup("standard", false, item.star_style)}</span><strong>${escapeHtml(childName)}</strong>`;
        star.addEventListener("click", () => showPrivateStarNotice(item));
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
        ? `Abrir el recuerdo de ${item.child_name || "un hijo"}`
        : `Abrir tu estrella privada: ${item.child_name || "Siempre amado"}`);

      card.style.animationDelay = `${(index % 7) * -.65}s`;

      if (!item.is_public) {
        card.innerHTML = `<span class="memorial-symbol">${memorialSymbolMarkup("standard", false, item.star_style)}</span><strong>${escapeHtml(item.child_name || "Siempre amado")}</strong>`;
        card.addEventListener("click", () => openApprovedMemorial(item));
        grid.appendChild(card);
        return;
      }

      const dateLine = memorialDateLine(item);
      const dayLabel =
        state === "anniversary"
          ? "Hoy recordamos"
          : state === "birthday"
            ? "Hoy celebramos"
            : "Por siempre en nuestro recuerdo";

      card.innerHTML = `
        <span class="memorial-symbol">
          ${memorialSymbolMarkup(state, false, item.star_style)}
        </span>
        <span class="memorial-kicker">${"Una luz que recordamos"}</span>
        <strong>${escapeHtml(item.child_name || "Siempre en nuestros corazones")}</strong>
        <span class="memorial-day">${dayLabel}</span>
        <span class="memorial-rule" aria-hidden="true"><i></i><b>✦</b><i></i></span>
        <small>${dateLine ? `<span class="memorial-dates">${escapeHtml(dateLine)}</span>` : "Siempre en nuestros corazones."}${item.country ? `<span class="memorial-dates">${escapeHtml(item.country)}</span>` : ""}</small>
      `;

      card.addEventListener("click", () => openApprovedMemorial(item));
      grid.appendChild(card);
    });

    const wallStars = [...grid.querySelectorAll(".memorial-card")];
    const centerStar = viewerCenter
      ? wallStars.find(card => card.dataset.publicMemorial === viewerCenter.id)
      : skyCard;
    window.SkysbridgeSkyMap?.layout(wallStars, centerStar, grid);

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

    status.textContent = 'Cargando recuerdos…';
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
      let familyDetails = [];
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

        const familyMembershipResult = await db
          .from("memorial_family_members")
          .select("owner_user_id")
          .eq("member_user_id", user.id);
        if (familyMembershipResult.error) throw familyMembershipResult.error;
        const familyOwnerIds = [...new Set((familyMembershipResult.data || []).map(item => item.owner_user_id))];
        if (familyOwnerIds.length) {
          const familyResult = await db
            .from("memorials")
            .select("id,child_name,remembrance,country,star_style,birth_date,passing_date,photo_path,created_at,public_requested,approved")
            .in("user_id", familyOwnerIds)
            .eq("archived", false)
            .is("rejection_reason", null);
          if (familyResult.error) throw familyResult.error;
          familyDetails = familyResult.data || [];
        }

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
        .select("id,child_name,star_style,public_requested,approved");
      if (shapeResult.error) throw shapeResult.error;

      const ownById = new Map(ownDetails.map(item => [item.id, item]));
      const familyById = new Map(familyDetails.map(item => [item.id, item]));
      const publicById = new Map(publicDetails.map(item => [item.id, item]));
      viewerMemorialIds = nextViewerMemorialIds;
      approvedMemorials = (shapeResult.data || []).map(shape => {
        const details = ownById.get(shape.id) || familyById.get(shape.id) || publicById.get(shape.id);
        return {
          ...shape,
          ...(details || {}),
          is_star_owner: ownById.has(shape.id),
          is_owner: ownById.has(shape.id) || familyById.has(shape.id),
          is_family: familyById.has(shape.id) && !ownById.has(shape.id),
          is_public: publicById.has(shape.id) || Boolean(shape.public_requested && shape.approved)
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
        status.textContent = 'No se han podido cargar los recuerdos públicos. Sky sigue visible como la primera luz.';
      } else {
        restoreWallCache(user);
        status.textContent = approvedMemorials.length
          ? 'Se muestran las estrellas guardadas. Se actualizarán al volver a conectarte.'
          : 'No se han podido cargar los recuerdos públicos. Sky sigue visible como la primera luz.';
      }
    } finally {
      if (generation === memorialLoadGeneration) setWallLoading(false);
    }
  }

  document.querySelector("#memorialSearch")?.addEventListener("input", renderApprovedMemorials);
  document.querySelector("#memorialSort")?.addEventListener("change", renderApprovedMemorials);

  function getMetadataDisplayName(user) {
    const metadata = user?.user_metadata || {};
    const value = metadata.display_name || metadata.full_name || metadata.name || "";
    return String(value).trim().slice(0, 80);
  }

  function isPlaceholderDisplayName(value) {
    return /^(member|mitglied|miembro|user|usuario|benutzer)$/i.test(String(value || "").trim());
  }

  function getProfileDisplayName(profile, user) {
    const metadataName = getMetadataDisplayName(user);
    if (metadataName && !isPlaceholderDisplayName(metadataName)) return metadataName;
    const profileName = String(profile?.display_name || "").trim();
    return profileName && !isPlaceholderDisplayName(profileName) ? profileName : "";
  }

  async function ensureProfile(user) {
    const { data, error } = await db
      .from("profiles")
      .select("id,display_name,country,is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const metadataName = getMetadataDisplayName(user);
      if (metadataName && !isPlaceholderDisplayName(metadataName)) {
        if (data.display_name !== metadataName && !data.is_admin) {
          const { error: updateError } = await db
            .from("profiles")
            .update({ display_name: metadataName })
            .eq("id", user.id);
          if (updateError) throw updateError;
        }
        return { ...data, display_name: metadataName };
      }
      return data;
    }

    const displayName = getMetadataDisplayName(user) || null;
    const { data: inserted, error: insertError } = await db
      .from("profiles")
      .insert({ id: user.id, display_name: displayName })
      .select("id,display_name,country,is_admin")
      .single();

    if (insertError) throw insertError;
    return inserted;
  }

  async function loadMyMemorials() {
    const section = document.querySelector("#myMemorialSection");
    const target = document.querySelector("#myMemorials");
    const status = document.querySelector("#myMemorialsStatus");
    if (!section || !target) return;
    if (!currentUser) {
      setHidden(section, true);
      return;
    }

    setHidden(section, false);
    target.innerHTML = `<p class="muted">Cargando tus estrellas…</p>`;
    const { data, error } = await db
      .from("memorials")
      .select("id,child_name,public_requested,approved,created_at")
      .eq("user_id", currentUser.id)
      .eq("archived", false)
      .is("rejection_reason", null)
      .order("created_at", { ascending: false });

    if (error) {
      target.innerHTML = `<p class="notice error">No se pudieron cargar tus estrellas: ${escapeHtml(error.message)}</p>`;
      return;
    }
    const memorialIds = [...new Set((data || []).map(item => item.memorial_id).filter(Boolean))];
    const memorialNames = new Map();
    if (memorialIds.length) {
      const { data: memorials } = await db
        .from("memorials")
        .select("id,child_name")
        .in("id", memorialIds);
      (memorials || []).forEach(memorial => memorialNames.set(memorial.id, memorial.child_name));
    }

    if (!data?.length) {
      target.innerHTML = `
        <div class="review-item">
          <strong>Sky</strong>
          <p>Sky es la primera estrella de Skysbridge y permanecerá siempre visible en el cielo.</p>
          <a class="button button-outline" href="#stars">Ver a Sky en el cielo</a>
        </div>
        <p class="muted">Las estrellas conmemorativas personales que crees con «Honrar a un niño» aparecerán aquí para que puedas gestionarlas.</p>
      `;
      return;
    }

    target.innerHTML = data.map(item => {
      const visibility = item.public_requested
        ? (item.approved ? "Pública: visible para todos." : "Publicación solicitada: pendiente de aprobación.")
        : "Privada: la estrella y el nombre aparecen en el cielo; los datos siguen siendo privados.";
      const actionLabel = item.public_requested ? "Hacer privada" : "Hacer pública";
      return `
        <div class="review-item">
          <strong>${escapeHtml(item.child_name)}</strong>
          <p>${visibility}</p>
          <p class="muted">${escapeHtml(formatDate(item.created_at))}</p>
          <div class="review-actions">
            <button class="button button-outline toggle-memorial-visibility" data-id="${item.id}" data-public="${!item.public_requested}">
              ${actionLabel}
            </button>
          </div>
        </div>
      `;
    }).join("");

    target.querySelectorAll(".toggle-memorial-visibility").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        const { error: updateError } = await db.rpc("set_memorial_visibility", {
          p_memorial_id: button.dataset.id,
          p_public: button.dataset.public === "true"
        });
        if (updateError) {
          button.disabled = false;
          setStatus(status, "No se pudo actualizar esta estrella: " + updateError.message, "error");
          return;
        }
        await loadMyMemorials();
        await loadApprovedMemorials();
        setStatus(status, button.dataset.public === "true"
          ? "Se solicitó la publicación. Los datos aparecerán después de la aprobación."
          : "Esta estrella ahora es privada.", "success");
      };
    });
  }

  async function loadFamilySharing() {
    const section = document.querySelector("#familySharingSection");
    const outgoingList = document.querySelector("#familyShares");
    const incomingList = document.querySelector("#incomingFamilyInvites");
    const status = document.querySelector("#familySharingStatus");
    const requestsList = document.querySelector("#incomingFamilyRequests");
    if (!section || !outgoingList || !incomingList || !requestsList) return;

    const generation = ++familySharingGeneration;
    if (!currentUser || currentUser.is_anonymous) {
      setHidden(section, true);
      outgoingList.innerHTML = "";
      incomingList.innerHTML = "";
      requestsList.innerHTML = "";
      return;
    }

    setHidden(section, false);
    outgoingList.innerHTML = `<p class="muted">Cargando el acceso familiar…</p>`;
    incomingList.innerHTML = `<p class="muted">Cargando el acceso familiar…</p>`;

    const email = String(currentUser.email || "").trim().toLowerCase();
    const [invitesResult, membershipsResult, incomingResult, acceptedResult, requestsResult] = await Promise.all([
      db.from("memorial_family_invites")
        .select("id,owner_user_id,owner_name,invited_email,created_at")
        .eq("owner_user_id", currentUser.id)
        .order("created_at", { ascending: false }),
      db.from("memorial_family_members")
        .select("invite_id")
        .eq("owner_user_id", currentUser.id),
      email
        ? db.from("memorial_family_invites")
            .select("id,owner_user_id,owner_name,invited_email,created_at")
            .eq("invited_email", email)
        : Promise.resolve({ data: [], error: null }),
      db.from("memorial_family_members")
        .select("invite_id")
        .eq("member_user_id", currentUser.id),
      db.from("memorial_family_requests")
        .select("id,memorial_id,requester_user_id,requester_email,requester_name,created_at")
        .order("created_at", { ascending: false })
    ]);

    if (generation !== familySharingGeneration || !currentUser) return;
    const failed = [invitesResult, membershipsResult, incomingResult, acceptedResult, requestsResult].find(result => result.error);
    if (failed) {
      console.warn("Family sharing unavailable:", failed.error);
      outgoingList.innerHTML = `<p class="notice error">No se pudo cargar el acceso familiar. Inténtalo de nuevo.</p>`;
      incomingList.innerHTML = "";
      return;
    }

    const acceptedByOwner = new Set((membershipsResult.data || []).map(item => item.invite_id));
    const acceptedForUser = new Set((acceptedResult.data || []).map(item => item.invite_id));
    const outgoing = invitesResult.data || [];
    const incoming = (incomingResult.data || []).filter(item => !acceptedForUser.has(item.id));

    outgoingList.innerHTML = outgoing.length
      ? outgoing.map(invite => `
          <div class="review-item">
            <strong>${escapeHtml(invite.invited_email)}</strong>
            <p>${acceptedByOwner.has(invite.id) ? "Puede leer las estrellas de tu familia" : "Invitación pendiente de aceptación"}</p>
            <button class="button button-outline family-remove-access" type="button" data-invite-id="${escapeHtml(invite.id)}">Retirar acceso</button>
          </div>
        `).join("")
      : `<p class="muted">Todavía no has invitado a nadie.</p>`;

    incomingList.innerHTML = incoming.length
      ? incoming.map(invite => `
          <div class="review-item">
            <strong>${escapeHtml(invite.owner_name || "Skysbridge")}</strong>
            <p>${escapeHtml(invite.owner_name || "Skysbridge")} te ha invitado a leer sus recuerdos familiares.</p>
            <button class="button button-gold family-accept-access" type="button"
              data-invite-id="${escapeHtml(invite.id)}"
              data-owner-id="${escapeHtml(invite.owner_user_id)}">Aceptar acceso familiar</button>
          </div>
        `).join("")
      : `<p class="muted">No tienes invitaciones familiares pendientes.</p>`;
    const requests = (requestsResult.data || []).filter(request => request.requester_user_id !== currentUser.id);
    requestsList.innerHTML = requests.length
      ? requests.map(request => `
          <div class="review-item">
            <strong>${escapeHtml(request.requester_name || request.requester_email)}</strong>
            <p>${escapeHtml(request.requester_email)} quiere unirse a tu familia</p>
            <button class="button button-gold family-request-approve" type="button" data-request-id="${escapeHtml(request.id)}">Enviar invitación familiar</button>
            <button class="button button-outline family-request-reject" type="button" data-request-id="${escapeHtml(request.id)}">Rechazar solicitud</button>
          </div>
        `).join("")
      : `<p class="muted">No hay solicitudes pendientes para unirse a tu familia.</p>`;

    requestsList.querySelectorAll(".family-request-approve").forEach(button => {
      button.addEventListener("click", async () => {
        const request = requests.find(item => item.id === button.dataset.requestId);
        if (!request) return;
        button.disabled = true;
        const { error } = await db.from("memorial_family_invites").insert({
          owner_user_id: currentUser.id,
          owner_name: String(currentProfile?.display_name || currentUser.email?.split("@")[0] || "Miembro de Skysbridge").trim().slice(0, 80),
          invited_email: request.requester_email
        });
        if (error) {
          button.disabled = false;
          setStatus(status, "No se pudo procesar la solicitud. Inténtalo de nuevo.", "error");
          return;
        }
        const removed = await db.from("memorial_family_requests").delete().eq("id", request.id);
        if (removed.error) {
          button.disabled = false;
          setStatus(status, "No se pudo procesar la solicitud. Inténtalo de nuevo.", "error");
          return;
        }
        setStatus(status, "Invitación enviada. Puede aceptarla en su cuenta.", "success");
        await loadFamilySharing();
      });
    });
    requestsList.querySelectorAll(".family-request-reject").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        const { error } = await db.from("memorial_family_requests").delete().eq("id", button.dataset.requestId);
        if (error) {
          button.disabled = false;
          setStatus(status, "No se pudo procesar la solicitud. Inténtalo de nuevo.", "error");
          return;
        }
        setStatus(status, "Solicitud rechazada.", "success");
        await loadFamilySharing();
      });
    });
    outgoingList.querySelectorAll(".family-remove-access").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        const { error } = await db.from("memorial_family_invites")
          .delete()
          .eq("id", button.dataset.inviteId)
          .eq("owner_user_id", currentUser.id);
        if (error) {
          button.disabled = false;
          setStatus(status, "No se pudo retirar el acceso. Inténtalo de nuevo.", "error");
          return;
        }
        setStatus(status, "Acceso familiar retirado.", "success");
        await Promise.all([loadFamilySharing(), loadApprovedMemorials()]);
      });
    });

    incomingList.querySelectorAll(".family-accept-access").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        const { error } = await db.from("memorial_family_members").insert({
          invite_id: button.dataset.inviteId,
          owner_user_id: button.dataset.ownerId,
          member_user_id: currentUser.id
        });
        if (error) {
          button.disabled = false;
          setStatus(status, "No se pudo aceptar la invitación. Es posible que se haya eliminado o ya se haya aceptado.", "error");
          return;
        }
        setStatus(status, "Acceso familiar aceptado. Sus estrellas ya aparecen en tu cielo.", "success");
        await Promise.all([loadFamilySharing(), loadApprovedMemorials()]);
      });
    });
  }

  document.querySelector("#familyInviteForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.querySelector("#familySharingStatus");
    if (!currentUser || currentUser.is_anonymous || !requireDatabase(status)) return;

    const email = String(new FormData(form).get("family_email") || "").trim().toLowerCase();
    if (!email || email === String(currentUser.email || "").trim().toLowerCase()) {
      setStatus(status, "Introduce un correo distinto al de tu propia cuenta.", "error");
      return;
    }

    const { error } = await db.from("memorial_family_invites").insert({
      owner_user_id: currentUser.id,
      owner_name: String(currentProfile?.display_name || currentUser.email?.split("@")[0] || "Miembro de Skysbridge").trim().slice(0, 80),
      invited_email: email
    });
    if (error) {
      console.warn("Family invitation failed:", error);
      setStatus(status, error.code === "23505" ? "Esta persona ya tiene una invitación o acceso." : "No se pudo crear la invitación. Inténtalo de nuevo.", "error");
      return;
    }

    form.reset();
    setStatus(status, "Invitación creada. La persona la verá en su cuenta al iniciar sesión con este correo.", "success");
    await loadFamilySharing();
  });

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
      setHidden(document.querySelector("#myMemorialSection"), true);
      setHidden(document.querySelector("#familySharingSection"), true);
      familySharingGeneration += 1;
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
        display_name: getMetadataDisplayName(currentUser),
        is_admin: false
      };
    }


    setHidden(guest, true);
    setHidden(memberPanel, false);
    setHidden(roomArea, false);
    setHidden(roomView, true);

    if (memberGreeting) {
      const memberName = getProfileDisplayName(currentProfile, currentUser);
      memberGreeting.textContent = memberName
        ? `Hola, ${memberName}`
        : "Te damos la bienvenida a Skysbridge";
      const nameInput = document.querySelector("#memberNameForm input[name=\"display_name\"]");
      if (nameInput) nameInput.value = memberName;
      setHidden(document.querySelector("#memberNameForm"), Boolean(memberName));
      setHidden(document.querySelector("#changeMemberName"), !memberName);
      setHidden(document.querySelector("#cancelMemberNameEdit"), !memberName);
    }

    if (memberEmail) {
      memberEmail.textContent = currentUser.email || "";
    }

    setHidden(adminBadge, !currentProfile.is_admin);

    await loadRooms();
    await loadMyMemorials();
    await loadFamilySharing();

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
    if (!grid) return;
    if (document.querySelector("#publishedMemorials")) {
      const publishedCard = document.querySelector("#publishedMemorials").closest(".admin-card");
      if (publishedCard && !document.querySelector("#anonymousMemorials")) {
        publishedCard.insertAdjacentHTML("beforeend", `
          <hr>
          <h3>Estrellas privadas</h3>
          <p class="muted">Gestiona estrellas cuyos recuerdos son privados. Aquí se muestran nombres y fechas, no los textos.</p>
          <div id="anonymousMemorials"><p class="muted">Cargando…</p></div>
        `);
      }
      return;
    }

    const card = document.createElement("article");
    card.className = "admin-card";
    card.dataset.adminPublishedMemorials = "true";
    card.innerHTML = `
      <h3>Estrellas publicadas</h3>
      <p class="muted">Gestiona los recuerdos visibles en el cielo lleno de estrellas. Sky está protegido de forma permanente.</p>
      <div id="publishedMemorials"><p class="muted">Cargando…</p></div>
      <hr>
      <h3>Estrellas privadas</h3>
      <p class="muted">Gestiona estrellas cuyos recuerdos son privados. Aquí se muestran nombres y fechas, no los textos.</p>
      <div id="anonymousMemorials"><p class="muted">Cargando…</p></div>
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
        const photoPath = memorials.find(item => item.id === memorialId)?.photo_path;
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

        if (photoPath) await db.storage.from("memorial-photos").remove([photoPath]);

        await Promise.all([
          loadPublishedMemorials(),
          loadApprovedMemorials()
        ]);
      };
    });
  }

  async function loadAnonymousMemorials() {
    const target = document.querySelector("#anonymousMemorials");
    if (!target) return;

    if (!currentProfile?.is_admin) {
      target.innerHTML = `<p class="notice error">Se requiere acceso de administrador.</p>`;
      return;
    }

    target.innerHTML = `<p class="muted">Cargando…</p>`;
    const result = await db
      .from("memorials")
      .select("id,child_name,created_at,photo_path")
      .eq("public_requested", false)
      .eq("archived", false)
      .is("rejection_reason", null)
      .order("created_at", { ascending: false });

    if (result.error) {
      target.innerHTML = `<p class="notice error">No se pudieron cargar las estrellas privadas: ${escapeHtml(result.error.message)}</p>`;
      return;
    }

    const memorials = result.data || [];
    if (!memorials.length) {
      target.innerHTML = `<p class="muted">No hay estrellas privadas.</p>`;
      return;
    }

    target.innerHTML = memorials.map(item => `
      <div class="review-item">
        <strong>${escapeHtml(item.child_name || "Siempre amado")}</strong>
        <p>${escapeHtml(formatDate(item.created_at))}</p>
        <div class="review-actions">
          <button class="button button-danger delete-anonymous-memorial" type="button" data-id="${escapeHtml(item.id)}">Eliminar estrella</button>
        </div>
      </div>
    `).join("");

    target.querySelectorAll(".delete-anonymous-memorial").forEach(button => {
      button.onclick = async () => {
        const memorialId = button.dataset.id;
        if (!memorialId || !window.confirm("¿Eliminar permanentemente esta estrella privada? Esta acción no se puede deshacer.")) return;

        button.disabled = true;
        const originalLabel = button.textContent;
        button.textContent = "Eliminando…";
        const result = await db.rpc("admin_delete_private_memorial", {
          p_memorial_id: memorialId
        });

        if (result.error || result.data !== true) {
          button.disabled = false;
          button.textContent = originalLabel;
          window.alert(result.error
            ? `No se ha podido eliminar la estrella: ${result.error.message}`
            : "No se ha eliminado nada. Comprueba que tu perfil tenga is_admin = true.");
          return;
        }

        const photoPath = memorials.find(item => item.id === memorialId)?.photo_path;
        if (photoPath) await db.storage.from("memorial-photos").remove([photoPath]);
        await Promise.all([loadAnonymousMemorials(), loadApprovedMemorials()]);
      };
    });
  }

  async function loadAdminDashboard() {
    ensurePublishedMemorialAdminSection();

    await Promise.all([
      loadPendingMembers(),
      loadPendingMemorials(),
      loadPendingMemories(),
      loadPublishedMemorials(),
      loadAnonymousMemorials()
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
    clearReviewPhotoUrls();
    const target = document.querySelector("#pendingMemorials");
    if (!target) return;

    target.innerHTML = `<p class="muted">Cargando…</p>`;

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
      target.innerHTML = `<p class="muted">No hay recuerdos pendientes.</p>`;
      return;
    }

    target.innerHTML = data.map(item => `
      <div class="review-item">
        <strong>${escapeHtml(item.child_name)}</strong>
        <p>${escapeHtml(item.remembrance)}</p>
        ${item.photo_path ? `<p class="muted">Foto enviada para revisión</p><img class="memorial-review-photo" data-photo-path="${escapeHtml(item.photo_path)}" alt="">` : ""}
        <p>${item.public_requested ? "Solicita una estrella pública" : "Recuerdo privado"}</p>
        <div class="review-actions">
          <button class="button button-gold review-memorial" data-id="${item.id}" data-decision="approve">Aprobar</button>
          <button class="button button-danger review-memorial" data-id="${item.id}" data-decision="decline">Rechazar</button>
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
            rejection_reason: approved ? null : "No se ha aprobado por ahora."
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
      .select("id,star_slug,memorial_id,author_name,message,created_at")
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
        <strong>${escapeHtml(item.author_name)} · ${escapeHtml(item.star_slug || memorialNames.get(item.memorial_id) || "Estrella conmemorativa")}</strong>
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
            rejection_reason: approved ? null : "No se ha aprobado por ahora."
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

  document.querySelector("#memberNameForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const status = document.querySelector("#memberNameStatus");
    const input = event.currentTarget.querySelector('input[name="display_name"]');
    const displayName = String(input?.value || "").trim();
    if (!currentUser || !requireDatabase(status)) return;
    if (!displayName || displayName.length > 80) {
      setStatus(status, "No se pudo guardar tu nombre. Inténtalo de nuevo.", "error");
      input?.focus();
      return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    setStatus(status, "Guardando tu nombre…");
    const { data: authData, error: authError } = await db.auth.updateUser({
      data: { display_name: displayName }
    });
    if (authError) {
      if (button) button.disabled = false;
      console.error("Profile name update failed:", authError);
      setStatus(status, "No se pudo guardar tu nombre. Inténtalo de nuevo.", "error");
      return;
    }
    if (authData?.user) currentUser = authData.user;

    if (!currentProfile?.is_admin) {
      const { error: profileError } = await db.from("profiles")
        .update({ display_name: displayName })
        .eq("id", currentUser.id);
      if (profileError) {
        console.warn("Profile row name update failed:", profileError);
      }
    }
    if (button) button.disabled = false;

    currentProfile = { ...currentProfile, display_name: displayName };
    const greeting = document.querySelector("#memberGreeting");
    if (greeting) greeting.textContent = `Hola, ${displayName}`;
    setStatus(status, "Tu nombre se ha guardado.", "success");
    setHidden(event.currentTarget, true);
    setHidden(document.querySelector("#changeMemberName"), false);
    setHidden(document.querySelector("#cancelMemberNameEdit"), true);
    setHidden(status, true);
  });

  document.querySelector("#changeMemberName")?.addEventListener("click", () => {
    const form = document.querySelector("#memberNameForm");
    const input = form?.querySelector('input[name="display_name"]');
    const status = document.querySelector("#memberNameStatus");
    setHidden(document.querySelector("#changeMemberName"), true);
    setHidden(form, false);
    setHidden(document.querySelector("#cancelMemberNameEdit"), false);
    setHidden(status, true);
    input?.focus();
  });

  document.querySelector("#cancelMemberNameEdit")?.addEventListener("click", () => {
    const form = document.querySelector("#memberNameForm");
    const input = form?.querySelector('input[name="display_name"]');
    const memberName = getProfileDisplayName(currentProfile, currentUser);
    if (input) input.value = memberName || "";
    setHidden(form, true);
    setHidden(document.querySelector("#changeMemberName"), Boolean(memberName));
    setHidden(document.querySelector("#cancelMemberNameEdit"), true);
    setHidden(document.querySelector("#memberNameStatus"), true);
  });

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
  if (offlineWallEnabled) window.addEventListener("online", loadApprovedMemorials);

  if (db) {
    db.auth.onAuthStateChange((event, session) => {
      // A token refresh does not change the member identity. Rebuilding account panels
      // here changes page height and can move the reader's scroll position.
      if (event === "TOKEN_REFRESHED") return;
      if (event === "PASSWORD_RECOVERY") {
        const forMemorial = new URLSearchParams(window.location.search).get("memorial") === "1";
        window.setTimeout(() => showPasswordRecovery(forMemorial), 0);
      }
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
