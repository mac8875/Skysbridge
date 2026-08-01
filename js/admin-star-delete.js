// SKYSBRIDGE ADMIN UPDATE — manage and permanently delete published memorial stars.
(() => {
  "use strict";

  const cfg = window.SKYSBRIDGE_CONFIG || {};
  const configured =
    window.supabase &&
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !String(cfg.SUPABASE_ANON_KEY).includes("PASTE_");

  if (!configured) {
    console.warn("Skysbridge admin star management: Supabase is not configured.");
    return;
  }

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let loading = false;
  let lastUserId = null;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);

  function ensureAdminCard() {
    const adminPanel = document.querySelector("#adminPanel");
    if (!adminPanel) return null;

    let target = document.querySelector("#publishedMemorials");
    if (target) return target;

    const card = document.createElement("article");
    card.className = "admin-card";
    card.dataset.adminPublishedStars = "true";
    card.innerHTML = `
      <h3>Published stars</h3>
      <p class="muted">Published memorials can be permanently removed here. Sky's fixed first star is protected.</p>
      <div id="publishedMemorials"><p class="muted">Loading…</p></div>
    `;

    const grid = adminPanel.querySelector(".admin-grid");
    if (grid) grid.appendChild(card);
    else adminPanel.appendChild(card);

    return card.querySelector("#publishedMemorials");
  }

  async function currentUserIsAdmin() {
    const { data: authData, error: authError } = await db.auth.getUser();
    const user = authData?.user;
    if (authError || !user) return false;

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.is_admin) return false;
    lastUserId = user.id;
    return true;
  }

  async function deletePublishedMemorial(id) {
    // Preferred dedicated RPC supplied with this update.
    let result = await db.rpc("admin_delete_published_memorial", {
      p_memorial_id: id
    });

    if (!result.error) return result;

    // Compatibility fallback for installations that already use the v17 moderation RPC.
    result = await db.rpc("admin_manage_content", {
      p_content_type: "memorial",
      p_content_id: id,
      p_action: "delete",
      p_reason: "Permanently deleted by an administrator."
    });

    if (!result.error) return result;

    // Final fallback for projects whose RLS policy directly permits administrator deletes.
    const direct = await db
      .from("memorials")
      .delete()
      .eq("id", id)
      .select("id");

    if (direct.error) return direct;
    if (!direct.data?.length) {
      return {
        data: null,
        error: new Error("The memorial could not be deleted. Administrator permission may be missing.")
      };
    }

    return direct;
  }

  async function loadPublishedMemorials() {
    if (loading) return;
    const target = ensureAdminCard();
    if (!target) return;

    loading = true;
    target.innerHTML = `<p class="muted">Loading…</p>`;

    try {
      if (!(await currentUserIsAdmin())) {
        target.innerHTML = `<p class="muted">Administrator access is required.</p>`;
        return;
      }

      let query = await db
        .from("memorials")
        .select("id,child_name,country,birth_date,passing_date,created_at")
        .eq("approved", true)
        .eq("public_requested", true)
        .order("created_at", { ascending: false });

      // Compatibility with an older memorial schema without date columns.
      if (query.error && /birth_date|passing_date/i.test(query.error.message || "")) {
        query = await db
          .from("memorials")
          .select("id,child_name,country,created_at")
          .eq("approved", true)
          .eq("public_requested", true)
          .order("created_at", { ascending: false });
      }

      if (query.error) {
        target.innerHTML = `<p class="notice error">${escapeHtml(query.error.message)}</p>`;
        return;
      }

      const rows = query.data || [];
      if (!rows.length) {
        target.innerHTML = `<p class="muted">No published memorial stars are available to delete.</p>`;
        return;
      }

      target.innerHTML = rows.map(item => {
        const details = [item.country, item.birth_date, item.passing_date]
          .filter(Boolean)
          .map(escapeHtml)
          .join(" · ");

        return `
          <div class="review-item" data-published-row="${item.id}">
            <strong>${escapeHtml(item.child_name || "A child remembered")}</strong>
            ${details ? `<p>${details}</p>` : ""}
            <div class="review-actions">
              <button
                type="button"
                class="button button-danger delete-published-star"
                data-id="${item.id}"
                data-name="${escapeHtml(item.child_name || "this memorial")}">
                Delete star
              </button>
            </div>
          </div>
        `;
      }).join("");

      target.querySelectorAll(".delete-published-star").forEach(button => {
        button.addEventListener("click", async () => {
          const name = button.dataset.name || "this memorial";
          const confirmed = window.confirm(
            `Permanently delete the star for ${name}? This cannot be undone.`
          );

          if (!confirmed) return;

          button.disabled = true;
          button.textContent = "Deleting…";

          const { error } = await deletePublishedMemorial(button.dataset.id);
          if (error) {
            button.disabled = false;
            button.textContent = "Delete star";
            window.alert(`The star could not be deleted: ${error.message}`);
            return;
          }

          button.closest("[data-published-row]")?.remove();
          document.querySelector(`[data-public-memorial="${button.dataset.id}"]`)?.remove();

          // Reload so the private app.js cache and the public wall are both refreshed.
          window.setTimeout(() => window.location.reload(), 250);
        });
      });
    } finally {
      loading = false;
    }
  }

  async function initialise() {
    const adminPanel = document.querySelector("#adminPanel");
    if (!adminPanel) return;

    ensureAdminCard();

    document.querySelector("#refreshAdmin")?.addEventListener("click", () => {
      window.setTimeout(loadPublishedMemorials, 0);
    });

    const observer = new MutationObserver(() => {
      if (!adminPanel.hidden) loadPublishedMemorials();
    });

    observer.observe(adminPanel, {
      attributes: true,
      attributeFilter: ["hidden", "style", "class"]
    });

    db.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id || null;
      if (userId && userId !== lastUserId) {
        window.setTimeout(loadPublishedMemorials, 0);
      }
    });

    if (!adminPanel.hidden) await loadPublishedMemorials();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
