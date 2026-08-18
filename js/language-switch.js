(() => {
  document.querySelectorAll('[data-language-link]').forEach(link => {
    link.addEventListener('click', event => {
      const target = new URL(link.getAttribute('href'), window.location.href);
      const isHomePair = /index(?:-de)?\.html$/.test(target.pathname) || target.pathname.endsWith('/');
      if (isHomePair && window.location.hash) target.hash = window.location.hash;
      try { localStorage.setItem('skysbridge-language', link.dataset.languageLink || 'en'); } catch (_) {}
      event.preventDefault();
      window.location.assign(target.href);
    });
  });
})();

(() => {
  const cfg = window.SKYSBRIDGE_CONFIG || {};
  const db = window.supabase?.createClient &&
    cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
      ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
      : null;

  let adminCache;

  async function currentUserIsAdmin() {
    if (!db) return false;
    if (adminCache !== undefined) return adminCache;

    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user) {
      adminCache = false;
      return false;
    }

    const { data, error } = await db
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    adminCache = !error && data?.is_admin === true;
    return adminCache;
  }

  if (db) {
    db.auth.onAuthStateChange(() => {
      adminCache = undefined;
    });
  }

  async function showApprovedMemories(slug) {
    if (!db || !slug) return;

    let form;
    for (let i = 0; i < 40; i++) {
      form = document.querySelector('#memoryForm');
      if (form) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!form) return;

    const section = form.closest('.memory-section');
    if (!section) return;

    section.querySelector('#approvedMemories')?.remove();

    const { data, error } = await db
      .from('memories')
      .select('id,author_name,message,created_at')
      .eq('star_slug', slug)
      .eq('approved', true)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (error || !data?.length) return;

    const canDelete = await currentUserIsAdmin();

    const list = document.createElement('div');
    list.id = 'approvedMemories';
    list.style.margin = '22px 0 30px';

    data.forEach(item => {
      const card = document.createElement('div');
      card.style.cssText =
        'padding:18px 20px;margin:12px 0;border:1px solid rgba(232,181,86,.25);border-radius:18px;background:rgba(4,20,34,.42)';

      const message = document.createElement('p');
      message.textContent = item.message;
      message.style.cssText = 'margin:0;line-height:1.7;color:#e2e8ed';

      const author = document.createElement('p');
      author.textContent = item.author_name || '';
      author.style.cssText =
        'margin:10px 0 0;color:#f4d792;font-size:13px;font-weight:600';

      card.append(message, author);

      if (canDelete) {
        const actions = document.createElement('div');
        actions.style.cssText = 'margin-top:14px;display:flex;justify-content:flex-end';

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'button button-danger';
        deleteButton.textContent = 'Delete memory';
        deleteButton.style.padding = '8px 14px';
        deleteButton.style.fontSize = '12px';

        deleteButton.addEventListener('click', async event => {
          event.preventDefault();
          event.stopPropagation();

          const confirmed = window.confirm(
            `Permanently delete this memory from ${item.author_name || 'this author'}? This cannot be undone.`
          );
          if (!confirmed) return;

          const originalText = deleteButton.textContent;
          deleteButton.disabled = true;
          deleteButton.textContent = 'Deleting…';

          const { data: deletedRows, error: deleteError } = await db
            .from('memories')
            .delete()
            .eq('id', item.id)
            .select('id');

          if (deleteError) {
            deleteButton.disabled = false;
            deleteButton.textContent = originalText;
            window.alert(`The memory could not be deleted: ${deleteError.message}`);
            return;
          }

          if (!deletedRows?.length) {
            deleteButton.disabled = false;
            deleteButton.textContent = originalText;
            window.alert('Nothing was deleted. Please confirm that you are signed in as an administrator.');
            return;
          }

          card.remove();
          if (!list.children.length) list.remove();
        });

        actions.appendChild(deleteButton);
        card.appendChild(actions);
      }

      list.appendChild(card);
    });

    const heading = section.querySelector('#memoryHeading');
    section.insertBefore(list, heading || form);
  }

  document.addEventListener('click', event => {
    const star = event.target.closest?.('[data-star]');
    if (star) showApprovedMemories(star.dataset.star);
  });
})();
