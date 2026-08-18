// Add the public Supabase values from Project Settings > API.
// Never use the service-role key here.
window.SKYSBRIDGE_CONFIG = {
  SUPABASE_URL: "https://urlnadzbsccvtvijgyrs.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_pExSYS2erdZw2EatmQ5x-g_X50v3oaR"
};

// SKYBRIDGE V48 — load administrator controls for private-room posts.
(() => {
  if (document.querySelector('script[data-admin-room-post-delete]')) return;

  const script = document.createElement('script');
  script.src = 'js/admin-room-post-delete-v48.js?v=48';
  script.defer = true;
  script.dataset.adminRoomPostDelete = 'true';
  document.head.appendChild(script);
})();
