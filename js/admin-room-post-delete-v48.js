// SKYBRIDGE V48 — administrator deletion for posts in private rooms
(() => {
  const cfg = window.SKYSBRIDGE_CONFIG || {};
  const clientFactory = window.supabase?.createClient;

  if (!clientFactory || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  const db = clientFactory(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const isGerman = String(document.documentElement.lang || "").toLowerCase().startsWith("de");

  const text = isGerman ? {
    deletePost: "Beitrag löschen",
    deleting: "Wird gelöscht …",
    confirmDelete: "Diesen Beitrag dauerhaft aus dem privaten Raum löschen? Dies kann nicht rückgängig gemacht werden.",
    deleteFailed: message => `Der Beitrag konnte nicht gelöscht werden: ${message}`,
    nothingDeleted: "Es wurde nichts gelöscht. Bitte prüfe, ob du als Administrator angemeldet bist.",
    emptyRoom: "In diesem Raum ist es noch still. Du kannst als erste Person etwas teilen."
  } : {
    deletePost: "Delete post",
    deleting: "Deleting…",
    confirmDelete: "Permanently delete this post from the private room? This cannot be undone.",
    deleteFailed: message => `The post could not be deleted: ${message}`,
    nothingDeleted: "Nothing was deleted. Please confirm that you are signed in as an administrator.",
    emptyRoom: "This room is quiet for now. You can be the first to share."
  };

  let activeRoomId = null;
  let adminCache;
  let enhanceTimer = null;
  let enhancing = false;

  async function currentUserIsAdmin() {
    if (adminCache !== undefined) return adminCache;

    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user) {
      adminCache = false;
      return false;
    }

    const { data, error } = await db
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    adminCache = !error && data?.is_admin === true;
    return adminCache;
  }

  function scheduleEnhancement(delay = 80) {
    window.clearTimeout(enhanceTimer);
    enhanceTimer = window.setTimeout(enhancePostCards, delay);
  }

  async function enhancePostCards() {
    if (enhancing || !activeRoomId) return;

    const postList = document.querySelector("#postList");
    if (!postList) return;

    if (!(await currentUserIsAdmin())) return;

    const cards = Array.from(postList.querySelectorAll(".post-card"));
    if (!cards.length) return;

    enhancing = true;

    try {
      const { data: posts, error } = await db
        .from("group_posts")
        .select("id")
        .eq("group_id", activeRoomId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });

      if (error || !posts?.length) return;

      cards.forEach((card, index) => {
        const post = posts[index];

        if (!post?.id || card.querySelector("[data-admin-delete-room-post]")) return;

        const actions = document.createElement("div");
        actions.className = "review-actions";
        actions.style.marginTop = "16px";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "button button-danger";
        button.dataset.adminDeleteRoomPost = "true";
        button.textContent = text.deletePost;

        button.addEventListener("click", async event => {
          event.preventDefault();
          event.stopPropagation();

          if (!window.confirm(text.confirmDelete)) return;

          const roomIdAtDelete = activeRoomId;
          const originalLabel = button.textContent;

          button.disabled = true;
          button.textContent = text.deleting;

          const { data: deletedRows, error: deleteError } = await db
            .from("group_posts")
            .delete()
            .eq("id", post.id)
            .eq("group_id", roomIdAtDelete)
            .select("id");

          if (deleteError) {
            button.disabled = false;
            button.textContent = originalLabel;
            window.alert(text.deleteFailed(deleteError.message));
            return;
          }

          if (!deletedRows?.length) {
            button.disabled = false;
            button.textContent = originalLabel;
            window.alert(text.nothingDeleted);
            return;
          }

          card.remove();

          if (!postList.querySelector(".post-card")) {
            postList.innerHTML = `<p class="notice">${text.emptyRoom}</p>`;
          }
        });

        actions.appendChild(button);
        card.appendChild(actions);
      });
    } finally {
      enhancing = false;
    }
  }

  document.addEventListener("click", event => {
    const openButton = event.target.closest?.(".open-room");

    if (openButton?.dataset.roomId) {
      activeRoomId = openButton.dataset.roomId;
      scheduleEnhancement(150);
      return;
    }

    if (event.target.closest?.("#closeRoom")) {
      activeRoomId = null;
    }
  }, true);

  const startObserver = () => {
    const postList = document.querySelector("#postList");

    if (!postList || postList.dataset.adminDeleteObserver === "true") return;

    postList.dataset.adminDeleteObserver = "true";

    const observer = new MutationObserver(() => {
      if (activeRoomId) scheduleEnhancement();
    });

    observer.observe(postList, {
      childList: true,
      subtree: true
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  } else {
    startObserver();
  }

  db.auth.onAuthStateChange(() => {
    adminCache = undefined;

    if (activeRoomId) {
      scheduleEnhancement();
    }
  });
})();
