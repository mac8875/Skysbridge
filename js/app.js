// SKYBRIDGE V35 — Wall of Stars first; external established support links
(() => {
  const cfg = window.SKYSBRIDGE_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_");

  const db = configured
    ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

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
        ? "Open member area"
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
    setStatus(element, "Supabase is not configured in js/config.js.", "error");
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
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function renderStoryParagraphs(value) {
    const story = String(value || "Forever loved. Forever remembered.").trim();
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
      const values = new FormData(form);
      const email = values.get("email");
      const password = values.get("password");

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

      setTimeout(async () => {
        closeModal();
        await refreshSession();
        openMemberArea();
      }, 700);
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
        <div class="date-grid">
          <label>Date of birth (optional)
            <input type="date" name="birth_date">
          </label>
          <label>Date of passing (optional)
            <input type="date" name="passing_date">
          </label>
        </div>
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
      const payload = {
        user_id: user.id,
        child_name: values.get("child_name"),
        remembrance: values.get("remembrance"),
        country: values.get("country") || null,
        birth_date: values.get("birth_date") || null,
        passing_date: values.get("passing_date") || null,
        public_requested: values.get("public_requested") === "on"
      };

      let { error } = await db.from("memorials").insert(payload);

      if (error && /birth_date|passing_date/i.test(error.message || "")) {
        delete payload.birth_date;
        delete payload.passing_date;
        ({ error } = await db.from("memorials").insert(payload));
      }

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
        "Sky lived only a short time, but he changed our lives forever. His life taught us that love is not measured in years, but in the depth of the bond we share.\n\nAfter losing him, we discovered how lonely grief can become. Many parents carry their pain in silence, believing they are alone.\n\nSkysbridge was created in Sky’s memory so that children who left too soon can be named, honoured and remembered with dignity.\n\nSky is the first star on our Wall of Stars. His light became the beginning of a place where every child’s story may continue to shine."
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

    const personalSkyOpening =
      "The moment I first learned of Sky was the greatest happiness of my life. Having to let him go became my deepest pain.";

    if (
      slug === "sky" &&
      !String(star.story || "").includes(personalSkyOpening)
    ) {
      star.story = `${personalSkyOpening}\n\n${star.story || ""}`.trim();
    }

    const starName = escapeHtml(star.name || "A child remembered");
    const storyHtml = renderStoryParagraphs(star.story);

    openModal(`
      <article class="star-remembrance">
        <header class="star-remembrance-header">
          <p class="eyebrow">A light remembered</p>
          <span class="star-remembrance-symbol" aria-hidden="true"><img src="assets/memorial-star.svg" alt=""></span>
          <h2 id="modalTitle">${starName}</h2>
          <p class="star-remembrance-subtitle">His life was short. His light remains.</p>
        </header>

        <div class="star-story-copy">
          ${storyHtml}
        </div>

        <div class="star-story-divider" aria-hidden="true">
          <span>✦</span>
        </div>

        <section class="memory-section" aria-labelledby="memoryHeading">
          <p class="eyebrow">Words of remembrance</p>
          <h3 id="memoryHeading">Leave a memory for ${starName}</h3>
          <p class="memory-intro">
            Your words will remain private until they have been carefully reviewed.
          </p>

          <form class="form-grid memory-form" id="memoryForm">
            <label>Your name
              <input name="author_name" maxlength="80" autocomplete="name" required>
            </label>
            <label>Leave a memory
              <textarea name="message" maxlength="800" required></textarea>
            </label>
            <button class="button button-gold" type="submit">Submit memory privately</button>
            <div class="notice memory-notice" id="memoryStatus">
              Memories are reviewed before they become visible.
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


  let approvedMemorials = [];

  function sameMonthAndDay(value, today = new Date()) {
    if (!value) return false;
    const parts = String(value).slice(0, 10).split("-").map(Number);
    return parts.length === 3 && parts[1] === today.getMonth() + 1 && parts[2] === today.getDate();
  }

  function formatPlainDate(value) {
    if (!value) return "";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(date);
  }

  function memorialDateLine(item) {
    const birth = formatPlainDate(item.birth_date);
    const passing = formatPlainDate(item.passing_date);
    if (birth && passing) return `${birth} — ${passing}`;
    if (birth) return `Born ${birth}`;
    if (passing) return `Remembered since ${passing}`;
    return "";
  }

  function memorialDayState(item) {
    // A remembrance anniversary takes priority if both dates fall on the same day.
    if (sameMonthAndDay(item.passing_date)) return "anniversary";
    if (sameMonthAndDay(item.birth_date)) return "birthday";
    return "standard";
  }

  function memorialSymbolMarkup(state, detailed = false) {
    if (state === "anniversary") {
      return `<img class="memorial-candle-image" src="assets/memorial-candle.svg" alt="${detailed ? "A lit memorial candle" : ""}">`;
    }

    return `<img class="memorial-star-image" src="assets/memorial-star.svg" alt="" aria-hidden="true">`;
  }

  function openApprovedMemorial(item) {
    const state = memorialDayState(item);
    const dayLabel =
      state === "anniversary"
        ? "Today we remember"
        : state === "birthday"
          ? "Today we celebrate"
          : "A light remembered";
    const dateLine = memorialDateLine(item);

    openModal(`
      <article class="memorial-detail-card is-${state}">
        <p class="eyebrow">${dayLabel}</p>
        <div class="memorial-detail-symbol">
          ${memorialSymbolMarkup(state, true)}
        </div>
        <h2 id="modalTitle">${escapeHtml(item.child_name || "Forever loved")}</h2>
        ${dateLine ? `<p class="memorial-detail-meta">${escapeHtml(dateLine)}</p>` : ""}
        ${item.country ? `<p class="memorial-detail-meta">${escapeHtml(item.country)}</p>` : ""}
        <div class="star-story-divider" aria-hidden="true"><span>✦</span></div>
        <div class="memorial-detail-story">${renderStoryParagraphs(item.remembrance)}</div>
      </article>
    `, "star-modal-card");
  }

  function renderApprovedMemorials() {
    const grid = document.querySelector("#memorialGrid");
    const status = document.querySelector("#wallStatus");
    if (!grid || !status) return;

    grid.querySelectorAll("[data-public-memorial]").forEach(card => card.remove());

    const search = String(document.querySelector("#memorialSearch")?.value || "").trim().toLowerCase();
    const sort = document.querySelector("#memorialSort")?.value || "newest";
    let rows = approvedMemorials.filter(item => !search || String(item.child_name || "").toLowerCase().includes(search));

    rows = [...rows].sort((a, b) => {
      if (sort === "az") return String(a.child_name || "").localeCompare(String(b.child_name || ""));
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });

    rows.forEach(item => {
      const state = memorialDayState(item);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `memorial-card is-${state}`;
      card.dataset.publicMemorial = item.id;
      card.setAttribute("aria-label", `Open memorial for ${item.child_name || "a child remembered"}`);

      const dateLine = memorialDateLine(item);
      const dayLabel =
        state === "anniversary"
          ? "Today we remember"
          : state === "birthday"
            ? "Today we celebrate"
            : "Forever remembered";

      card.innerHTML = `
        <span class="memorial-symbol">
          ${memorialSymbolMarkup(state)}
        </span>
        <span class="memorial-kicker">A light remembered</span>
        <strong>${escapeHtml(item.child_name || "Forever loved")}</strong>
        <span class="memorial-day">${dayLabel}</span>
        <span class="memorial-rule" aria-hidden="true"><i></i><b>✦</b><i></i></span>
        <small>${dateLine ? `<span class="memorial-dates">${escapeHtml(dateLine)}</span>` : "Forever loved. Forever remembered."}${item.country ? `<span class="memorial-dates">${escapeHtml(item.country)}</span>` : ""}</small>
      `;

      card.addEventListener("click", () => openApprovedMemorial(item));
      grid.appendChild(card);
    });

    if (search && !rows.length) status.textContent = `No memorial found for “${document.querySelector("#memorialSearch").value.trim()}”.`;
    else if (approvedMemorials.length) status.textContent = `Sky and ${approvedMemorials.length} more ${approvedMemorials.length === 1 ? "light" : "lights"}.`;
    else status.textContent = "Sky is the first light. More memorials will appear after family consent and moderator approval.";
  }

  async function loadApprovedMemorials() {
    const status = document.querySelector("#wallStatus");
    if (!status) return;
    if (!db) {
      renderApprovedMemorials();
      return;
    }

    status.textContent = "Loading memorials…";
    let result = await db
      .from("memorials")
      .select("id,child_name,remembrance,country,birth_date,passing_date,created_at")
      .eq("approved", true)
      .eq("public_requested", true)
      .order("created_at", { ascending: false });

    if (result.error && /birth_date|passing_date/i.test(result.error.message || "")) {
      result = await db
        .from("memorials")
        .select("id,child_name,remembrance,country,created_at")
        .eq("approved", true)
        .eq("public_requested", true)
        .order("created_at", { ascending: false });
    }

    if (result.error) {
      approvedMemorials = [];
      status.textContent = "The public memorials could not be loaded right now. Sky remains visible as the first light.";
      return;
    }

    approvedMemorials = result.data || [];
    renderApprovedMemorials();
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

    const displayName = user.email ? user.email.split("@")[0] : "Member";
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

      if (memberGreeting) memberGreeting.textContent = "Welcome to Skysbridge";
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
        display_name: currentUser.email?.split("@")[0] || "Member",
        is_admin: false
      };
    }


    setHidden(guest, true);
    setHidden(memberPanel, false);
    setHidden(roomArea, false);
    setHidden(roomView, true);

    if (memberGreeting) {
      memberGreeting.textContent =
        `Welcome, ${currentProfile.display_name || "Member"}`;
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

    roomList.innerHTML = `<p class="notice">Loading protected rooms…</p>`;

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
          Request access
        </button>
      `;
      let status = "Not joined";

      if (membership?.status === "pending") {
        status = "Awaiting review";
        action = `<button class="button button-outline" disabled>Request pending</button>`;
      } else if (membership?.status === "approved") {
        status = membership.role === "moderator" ? "Moderator" : "Approved member";
        action = `
          <button class="button button-gold open-room"
            data-room-id="${room.id}"
            data-room-name="${escapeHtml(room.name)}">
            Enter room
          </button>
        `;
      } else if (membership?.status === "blocked") {
        status = "Access unavailable";
        action = `<button class="button button-outline" disabled>Access unavailable</button>`;
      }

      return `
        <article class="dashboard-card">
          <p class="room-status">${escapeHtml(status)}</p>
          <h3>${escapeHtml(room.name)}</h3>
          <p>${escapeHtml(room.description)}</p>
          ${action}
        </article>
      `;
    }).join("");

    roomList.querySelectorAll(".request-room").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Sending…";

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

    setStatus(status, "Publishing…");

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
    setStatus(status, "Your post is now visible to approved room members.", "success");
    await loadPosts();
  });

  async function loadPosts() {
    const postList = document.querySelector("#postList");
    if (!postList) return;

    postList.innerHTML = `<p class="notice">Loading room posts…</p>`;

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
      postList.innerHTML = `<p class="notice">This room is quiet for now. You can be the first to share.</p>`;
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
          <strong>${escapeHtml(profileMap[post.user_id] || "Community member")}</strong>
          <span>${escapeHtml(formatDate(post.created_at))}</span>
        </div>
        <p>${escapeHtml(post.body)}</p>
      </article>
    `).join("");
  }

  async function loadAdminDashboard() {
    await Promise.all([
      loadPendingMembers(),
      loadPendingMemorials(),
      loadPendingMemories()
    ]);
  }

  async function loadPendingMembers() {
    const target = document.querySelector("#pendingMembers");
    if (!target) return;

    target.innerHTML = `<p class="muted">Loading…</p>`;

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
      target.innerHTML = `<p class="muted">No pending room requests.</p>`;
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
        <p>${escapeHtml(groupMap[item.group_id] || "Room")}</p>
        <div class="review-actions">
          <button class="button button-gold approve-member"
            data-group-id="${item.group_id}"
            data-user-id="${item.user_id}">Approve</button>
          <button class="button button-danger decline-member"
            data-group-id="${item.group_id}"
            data-user-id="${item.user_id}">Block</button>
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

    target.innerHTML = `<p class="muted">Loading…</p>`;

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
      target.innerHTML = `<p class="muted">No pending memorial submissions.</p>`;
      return;
    }

    target.innerHTML = data.map(item => `
      <div class="review-item">
        <strong>${escapeHtml(item.child_name)}</strong>
        <p>${escapeHtml(item.remembrance)}</p>
        <p>${item.public_requested ? "Public wall requested" : "Private remembrance"}</p>
        <div class="review-actions">
          <button class="button button-gold review-memorial" data-id="${item.id}" data-decision="approve">Approve</button>
          <button class="button button-danger review-memorial" data-id="${item.id}" data-decision="decline">Decline</button>
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

    target.innerHTML = `<p class="muted">Loading…</p>`;

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
      target.innerHTML = `<p class="muted">No memories awaiting review.</p>`;
      return;
    }

    target.innerHTML = data.map(item => `
      <div class="review-item">
        <strong>${escapeHtml(item.author_name)} · ${escapeHtml(item.star_slug)}</strong>
        <p>${escapeHtml(item.message)}</p>
        <div class="review-actions">
          <button class="button button-gold review-memory" data-id="${item.id}" data-decision="approve">Approve</button>
          <button class="button button-danger review-memory" data-id="${item.id}" data-decision="decline">Decline</button>
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

  loadApprovedMemorials();

  if (db) {
    db.auth.onAuthStateChange(() => {
      window.setTimeout(refreshSession, 0);
    });

    refreshSession();
  } else {
    updateAuthButtons(false);
  }
})();
