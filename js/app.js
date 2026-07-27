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
    element.hidden = false;
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
        document.querySelector("#community").scrollIntoView({ behavior: "smooth" });
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

    const { data: { session } } = await db.auth.getSession();
    const guest = document.querySelector("#guestCommunity");
    const memberPanel = document.querySelector("#memberPanel");
    const roomArea = document.querySelector("#roomArea");
    const adminPanel = document.querySelector("#adminPanel");

    if (!session) {
      currentUser = null;
      currentProfile = null;
      activeRoomId = null;
      guest.hidden = false;
      memberPanel.hidden = true;
      roomArea.hidden = true;
      adminPanel.hidden = true;
      document.querySelector("#roomView").hidden = true;
      return;
    }

    currentUser = session.user;

    try {
      currentProfile = await ensureProfile(currentUser);
    } catch (error) {
      console.error("Profile error:", error);
      currentProfile = {
        display_name: currentUser.email?.split("@")[0] || "Member",
        is_admin: false
      };
    }

    guest.hidden = true;
    memberPanel.hidden = false;
    roomArea.hidden = false;

    document.querySelector("#memberGreeting").textContent =
      `Welcome, ${currentProfile.display_name || "Member"}`;
    document.querySelector("#memberEmail").textContent = currentUser.email || "";
    document.querySelector("#adminBadge").hidden = !currentProfile.is_admin;

    await loadRooms();

    adminPanel.hidden = !currentProfile.is_admin;
    if (currentProfile.is_admin) {
      await loadAdminDashboard();
    }
  }

  async function loadRooms() {
    const roomList = document.querySelector("#roomList");
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
    document.querySelector("#roomArea").hidden = true;
    document.querySelector("#roomView").hidden = false;
    document.querySelector("#activeRoomName").textContent = roomName;
    await loadPosts();
    document.querySelector("#roomView").scrollIntoView({ behavior: "smooth" });
  }

  document.querySelector("#closeRoom").addEventListener("click", () => {
    activeRoomId = null;
    document.querySelector("#roomView").hidden = true;
    document.querySelector("#roomArea").hidden = false;
  });

  document.querySelector("#postForm").addEventListener("submit", async event => {
    event.preventDefault();

    const bodyInput = document.querySelector("#postBody");
    const status = document.querySelector("#postStatus");

    if (!activeRoomId || !bodyInput.value.trim()) return;

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
    target.innerHTML = `<p class="muted">Loading…</p>`;

    const { data, error } = await db
      .from("memorials")
      .select("id,child_name,remembrance,country,public_requested,created_at")
      .eq("status", "pending")
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
          <button class="button button-gold review-memorial" data-id="${item.id}" data-status="approved">Approve</button>
          <button class="button button-danger review-memorial" data-id="${item.id}" data-status="declined">Decline</button>
        </div>
      </div>
    `).join("");

    target.querySelectorAll(".review-memorial").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        const { error: updateError } = await db
          .from("memorials")
          .update({ status: button.dataset.status })
          .eq("id", button.dataset.id);

        if (updateError) {
          button.textContent = updateError.message;
          return;
        }
        await loadPendingMemorials();
      };
    });
  }

  async function loadPendingMemories() {
    const target = document.querySelector("#pendingMemories");
    target.innerHTML = `<p class="muted">Loading…</p>`;

    const { data, error } = await db
      .from("memories")
      .select("id,star_slug,author_name,message,created_at")
      .eq("status", "pending")
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
          <button class="button button-gold review-memory" data-id="${item.id}" data-status="approved">Approve</button>
          <button class="button button-danger review-memory" data-id="${item.id}" data-status="declined">Decline</button>
        </div>
      </div>
    `).join("");

    target.querySelectorAll(".review-memory").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        const { error: updateError } = await db
          .from("memories")
          .update({ status: button.dataset.status })
          .eq("id", button.dataset.id);

        if (updateError) {
          button.textContent = updateError.message;
          return;
        }
        await loadPendingMemories();
      };
    });
  }

  document.querySelector("#refreshAdmin").addEventListener("click", loadAdminDashboard);

  document.querySelector("#signOut").addEventListener("click", async () => {
    if (!db) return;
    await db.auth.signOut();
    await refreshSession();
  });

  if (db) {
    db.auth.onAuthStateChange(() => refreshSession());
    refreshSession();
  }
})();