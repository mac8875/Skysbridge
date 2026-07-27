(() => {
  const cfg = window.SKYSBRIDGE_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_");

  const db = configured
    ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const modal = document.querySelector("#modal");
  const modalContent = document.querySelector("#modalContent");
  const menuButton = document.querySelector(".menu-button");
  const nav = document.querySelector(".main-nav");

  menuButton.addEventListener("click", () => {
    nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", nav.classList.contains("open"));
  });

  document.querySelector(".modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  function openModal(html) {
    modalContent.innerHTML = html;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    modalContent.innerHTML = "";
    document.body.style.overflow = "";
  }

  function setStatus(element, message, type = "") {
    element.className = `notice ${type}`.trim();
    element.textContent = message;
  }

  function requireDatabase(element) {
    if (db) return true;
    setStatus(
      element,
      "Add your public Supabase anon key in js/config.js before using live forms.",
      "error"
    );
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

  document.querySelectorAll("[data-open-auth]").forEach(button => {
    button.addEventListener("click", showAuth);
  });

  function showAuth() {
    openModal(`
      <h2 id="modalTitle">Join Skysbridge</h2>
      <div class="tabs">
        <button class="button button-gold" id="loginTab">Sign in</button>
        <button class="button button-outline" id="signupTab">Create account</button>
      </div>
      <form class="form-grid" id="authForm">
        <label>Email
          <input type="email" name="email" required autocomplete="email">
        </label>
        <label>Password
          <input type="password" name="password" required minlength="8" autocomplete="current-password">
        </label>
        <button class="button button-gold" type="submit">Sign in</button>
        <div class="notice" id="authStatus">Your account and room activity are private by default.</div>
      </form>
    `);

    let mode = "login";
    const form = document.querySelector("#authForm");
    const status = document.querySelector("#authStatus");

    document.querySelector("#loginTab").onclick = () => setMode("login");
    document.querySelector("#signupTab").onclick = () => setMode("signup");

    function setMode(nextMode) {
      mode = nextMode;
      form.querySelector("button[type=submit]").textContent =
        mode === "login" ? "Sign in" : "Create account";
      document.querySelector("#loginTab").className =
        `button ${mode === "login" ? "button-gold" : "button-outline"}`;
      document.querySelector("#signupTab").className =
        `button ${mode === "signup" ? "button-gold" : "button-outline"}`;
    }

    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;

      setStatus(status, "Please wait…");
      const data = new FormData(form);
      const email = data.get("email");
      const password = data.get("password");

      const result = mode === "login"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({ email, password });

      if (result.error) {
        setStatus(status, result.error.message, "error");
        return;
      }

      setStatus(
        status,
        mode === "signup"
          ? "Please check your email to confirm your account."
          : "Signed in successfully.",
        "success"
      );

      setTimeout(() => {
        closeModal();
        refreshSession();
      }, 800);
    };
  }

  document.querySelectorAll("[data-open-memorial]").forEach(button => {
    button.addEventListener("click", showMemorial);
  });

  function showMemorial() {
    openModal(`
      <h2 id="modalTitle">Honor a child</h2>
      <p>Submitted memorials remain private until you request publication and a moderator approves them.</p>
      <form class="form-grid" id="memorialForm">
        <label>Child's name
          <input name="child_name" required maxlength="80">
        </label>
        <label>Your remembrance
          <textarea name="remembrance" maxlength="5000" required></textarea>
        </label>
        <label>Country (optional)
          <input name="country" maxlength="80">
        </label>
        <label>
          <input type="checkbox" name="public_requested">
          Request a place on the public Wall of Stars
        </label>
        <button class="button button-gold">Submit privately for review</button>
        <div class="notice" id="memorialStatus">You remain in control of publication.</div>
      </form>
    `);

    const form = document.querySelector("#memorialForm");
    const status = document.querySelector("#memorialStatus");

    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;

      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        setStatus(status, "Please sign in before submitting a memorial.", "error");
        return;
      }

      const values = new FormData(form);
      const { error } = await db.from("memorials").insert({
        user_id: user.id,
        child_name: values.get("child_name"),
        remembrance: values.get("remembrance"),
        country: values.get("country") || null,
        public_requested: values.get("public_requested") === "on"
      });

      if (error) {
        setStatus(status, error.message, "error");
        return;
      }

      form.reset();
      setStatus(status, "The memorial was submitted privately for review.", "success");
    };
  }

  document.querySelectorAll("[data-star]").forEach(element => {
    element.addEventListener("click", () => showStar(element.dataset.star));
  });

  async function showStar(slug) {
    let star = {
      name: "Sky",
      story:
        "Sky lived only a short time, but his life changed everything. His light became the beginning of Skysbridge—a place where children are named, remembered and forever part of their families' stories."
    };

    if (db) {
      const { data } = await db
        .from("stars")
        .select("name,story")
        .eq("slug", slug)
        .eq("is_public", true)
        .maybeSingle();

      if (data) star = data;
    }

    openModal(`
      <p class="eyebrow">A light remembered</p>
      <h2 id="modalTitle">${escapeHtml(star.name)}</h2>
      <p>${escapeHtml(star.story || "Forever loved. Forever remembered.")}</p>
      <form class="form-grid" id="memoryForm">
        <label>Your name
          <input name="author_name" maxlength="80" required>
        </label>
        <label>Leave a memory
          <textarea name="message" maxlength="800" required></textarea>
        </label>
        <button class="button button-gold">Submit memory privately</button>
        <div class="notice" id="memoryStatus">Memories are reviewed before they become visible.</div>
      </form>
    `);

    const form = document.querySelector("#memoryForm");
    const status = document.querySelector("#memoryStatus");

    form.onsubmit = async event => {
      event.preventDefault();
      if (!requireDatabase(status)) return;

      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        setStatus(status, "Please sign in before leaving a memory.", "error");
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
      setStatus(status, "Your memory was submitted privately for review.", "success");
    };
  }

  async function refreshSession() {
    if (!db) return;

    const { data: { session } } = await db.auth.getSession();
    const panel = document.querySelector("#memberPanel");

    if (!session) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    document.querySelector("#memberEmail").textContent = session.user.email;
  }

  document.querySelector("#signOut").addEventListener("click", async () => {
    if (!db) return;
    await db.auth.signOut();
    refreshSession();
  });

  if (db) {
    db.auth.onAuthStateChange(() => refreshSession());
    refreshSession();
  }
})();