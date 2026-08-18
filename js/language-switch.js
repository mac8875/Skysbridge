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

  const PHOTO_BUCKET = 'memory-photos';
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const isGerman = String(document.documentElement.lang || '').toLowerCase().startsWith('de');

  const text = isGerman ? {
    photoLabel: 'Foto (optional)',
    photoHelp: 'JPG, PNG oder WebP, maximal 5 MB. Das Foto bleibt privat, bis die Erinnerung freigegeben wurde.',
    invalidType: 'Bitte wähle ein Foto im Format JPG, PNG oder WebP.',
    tooLarge: 'Das Foto darf höchstens 5 MB groß sein.',
    signIn: 'Bitte melde dich an, bevor du eine Erinnerung einreichst.',
    uploading: 'Foto wird sicher hochgeladen …',
    submitting: 'Erinnerung wird zur Prüfung gesendet …',
    success: 'Deine Erinnerung wurde sicher und zunächst privat zur Prüfung übermittelt.',
    memoriesHeading: 'Freigegebene Erinnerungen',
    deleteMemory: 'Erinnerung löschen',
    deleting: 'Wird gelöscht …',
    confirmDelete: author => `Diese Erinnerung von ${author || 'dieser Person'} dauerhaft löschen? Das kann nicht rückgängig gemacht werden.`,
    deleteFailed: message => `Die Erinnerung konnte nicht gelöscht werden: ${message}`,
    nothingDeleted: 'Es wurde nichts gelöscht. Bitte prüfe, ob du als Administrator angemeldet bist.',
    photoAlt: author => `Foto zur Erinnerung von ${author || 'einer Person'}`,
    reviewPhotoAlt: 'Foto zu dieser Erinnerung'
  } : {
    photoLabel: 'Photo (optional)',
    photoHelp: 'JPG, PNG or WebP, maximum 5 MB. The photo stays private until the memory has been approved.',
    invalidType: 'Please choose a JPG, PNG or WebP image.',
    tooLarge: 'The photo must be 5 MB or smaller.',
    signIn: 'Please sign in before leaving a memory.',
    uploading: 'Uploading photo securely…',
    submitting: 'Submitting memory for review…',
    success: 'Your memory was submitted privately for review.',
    memoriesHeading: 'Approved memories',
    deleteMemory: 'Delete memory',
    deleting: 'Deleting…',
    confirmDelete: author => `Permanently delete this memory from ${author || 'this author'}? This cannot be undone.`,
    deleteFailed: message => `The memory could not be deleted: ${message}`,
    nothingDeleted: 'Nothing was deleted. Please confirm that you are signed in as an administrator.',
    photoAlt: author => `Memory photo from ${author || 'a contributor'}`,
    reviewPhotoAlt: 'Photo submitted with this memory'
  };

  let adminCache;
  let pendingPhotoTimer;

  function ensurePhotoStyles() {
    if (document.querySelector('link[data-memory-photo-styles]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/memory-photos-v43.css?v=43';
    link.dataset.memoryPhotoStyles = 'true';
    document.head.appendChild(link);
  }

  ensurePhotoStyles();

  function setNotice(element, message, type = '') {
    if (!element) return;
    element.hidden = false;
    element.className = `notice memory-notice ${type}`.trim();
    element.textContent = message;
  }

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
      window.setTimeout(schedulePendingPhotoEnhancement, 0);
    });
  }

  function validatePhoto(file) {
    if (!file || !file.size) return null;
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) return text.invalidType;
    if (file.size > MAX_PHOTO_BYTES) return text.tooLarge;
    return null;
  }

  function fileExtension(file) {
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    return 'jpg';
  }

  function makePhotoPath(userId, file) {
    const token = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${userId}/${token}.${fileExtension(file)}`;
  }

  async function signedPhotoUrl(path) {
    if (!db || !path) return null;
    const { data, error } = await db.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data?.signedUrl || null;
  }

  function formatMemoryDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat(
      isGerman ? 'de-DE' : 'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' }
    ).format(new Date(value));
  }

  function buildPhotoField(form) {
    if (form.querySelector('[data-memory-photo-field]')) {
      return form.querySelector('input[name="memory_photo"]');
    }

    const label = document.createElement('label');
    label.className = 'memory-photo-field';
    label.dataset.memoryPhotoField = 'true';
    label.append(document.createTextNode(text.photoLabel));

    const input = document.createElement('input');
    input.type = 'file';
    input.name = 'memory_photo';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.className = 'memory-photo-input';

    const help = document.createElement('small');
    help.className = 'memory-photo-help';
    help.textContent = text.photoHelp;

    const preview = document.createElement('div');
    preview.className = 'memory-photo-preview';
    preview.hidden = true;

    label.append(input, help, preview);

    const submitButton = form.querySelector('button[type="submit"]');
    form.insertBefore(label, submitButton || form.firstChild);

    let previewUrl = null;
    input.addEventListener('change', () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }

      preview.replaceChildren();
      preview.hidden = true;

      const file = input.files?.[0];
      if (!file) return;

      const error = validatePhoto(file);
      if (error) {
        input.value = '';
        const status = form.querySelector('#memoryStatus');
        setNotice(status, error, 'error');
        return;
      }

      previewUrl = URL.createObjectURL(file);
      const image = document.createElement('img');
      image.src = previewUrl;
      image.alt = '';
      preview.appendChild(image);
      preview.hidden = false;
    });

    return input;
  }

  function enhanceMemoryForm(form, slug) {
    if (!form || !slug || !db) return;

    const input = buildPhotoField(form);
    form.dataset.memoryPhotoSlug = slug;

    form.onsubmit = async event => {
      event.preventDefault();

      const status = form.querySelector('#memoryStatus');
      const submitButton = form.querySelector('button[type="submit"]');
      const originalButtonText = submitButton?.textContent || '';

      const { data: { user }, error: userError } = await db.auth.getUser();
      if (userError || !user) {
        setNotice(status, text.signIn, 'error');
        return;
      }

      const values = new FormData(form);
      const file = input?.files?.[0];
      const validationError = validatePhoto(file);
      if (validationError) {
        setNotice(status, validationError, 'error');
        return;
      }

      let photoPath = null;

      try {
        if (submitButton) submitButton.disabled = true;

        if (file) {
          setNotice(status, text.uploading);
          photoPath = makePhotoPath(user.id, file);

          const { error: uploadError } = await db.storage
            .from(PHOTO_BUCKET)
            .upload(photoPath, file, {
              cacheControl: '3600',
              contentType: file.type,
              upsert: false
            });

          if (uploadError) throw uploadError;
        }

        setNotice(status, text.submitting);

        const payload = {
          star_slug: slug,
          user_id: user.id,
          author_name: values.get('author_name'),
          message: values.get('message'),
          photo_path: photoPath
        };

        const { error: insertError } = await db.from('memories').insert(payload);
        if (insertError) throw insertError;

        form.reset();
        const preview = form.querySelector('.memory-photo-preview');
        if (preview) {
          preview.replaceChildren();
          preview.hidden = true;
        }
        setNotice(status, text.success, 'success');
      } catch (error) {
        if (photoPath) {
          await db.storage.from(PHOTO_BUCKET).remove([photoPath]);
        }
        setNotice(status, error?.message || String(error), 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    };
  }

  async function waitForMemoryForm() {
    for (let i = 0; i < 40; i++) {
      const form = document.querySelector('#memoryForm');
      if (form) return form;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  async function showApprovedMemories(slug) {
    if (!db || !slug) return;

    const form = await waitForMemoryForm();
    if (!form) return;

    enhanceMemoryForm(form, slug);

    const section = form.closest('.memory-section');
    if (!section) return;

    section.querySelector('#approvedMemories')?.remove();

    let result = await db
      .from('memories')
      .select('id,author_name,message,photo_path,created_at')
      .eq('star_slug', slug)
      .eq('approved', true)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (result.error && /photo_path/i.test(result.error.message || '')) {
      result = await db
        .from('memories')
        .select('id,author_name,message,created_at')
        .eq('star_slug', slug)
        .eq('approved', true)
        .eq('archived', false)
        .order('created_at', { ascending: false });
    }

    if (result.error || !result.data?.length) return;

    const canDelete = await currentUserIsAdmin();
    const rows = await Promise.all(result.data.map(async item => ({
      ...item,
      photoUrl: item.photo_path ? await signedPhotoUrl(item.photo_path) : null
    })));

    const list = document.createElement('section');
    list.id = 'approvedMemories';
    list.className = 'approved-memories';

    const listHeading = document.createElement('h4');
    listHeading.className = 'approved-memories-heading';
    listHeading.textContent = text.memoriesHeading;
    list.appendChild(listHeading);

    rows.forEach(item => {
      const card = document.createElement('article');
      card.className = 'approved-memory-card';

      if (item.photoUrl) {
        const figure = document.createElement('figure');
        figure.className = 'approved-memory-photo';

        const image = document.createElement('img');
        image.src = item.photoUrl;
        image.alt = text.photoAlt(item.author_name);
        image.loading = 'lazy';

        figure.appendChild(image);
        card.appendChild(figure);
      }

      const message = document.createElement('p');
      message.className = 'approved-memory-message';
      message.textContent = item.message;

      const author = document.createElement('p');
      author.className = 'approved-memory-author';
      const memoryDate = formatMemoryDate(item.created_at);
      author.textContent = [item.author_name || '', memoryDate]
        .filter(Boolean)
        .join(' · ');

      card.append(message, author);

      if (canDelete) {
        const actions = document.createElement('div');
        actions.className = 'approved-memory-actions';

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'button button-danger';
        deleteButton.textContent = text.deleteMemory;

        deleteButton.addEventListener('click', async event => {
          event.preventDefault();
          event.stopPropagation();

          const confirmed = window.confirm(text.confirmDelete(item.author_name));
          if (!confirmed) return;

          const originalText = deleteButton.textContent;
          deleteButton.disabled = true;
          deleteButton.textContent = text.deleting;

          const { data: deletedRows, error: deleteError } = await db
            .from('memories')
            .delete()
            .eq('id', item.id)
            .select('id');

          if (deleteError) {
            deleteButton.disabled = false;
            deleteButton.textContent = originalText;
            window.alert(text.deleteFailed(deleteError.message));
            return;
          }

          if (!deletedRows?.length) {
            deleteButton.disabled = false;
            deleteButton.textContent = originalText;
            window.alert(text.nothingDeleted);
            return;
          }

          if (item.photo_path) {
            await db.storage.from(PHOTO_BUCKET).remove([item.photo_path]);
          }

          card.remove();
          if (list.querySelectorAll('.approved-memory-card').length === 0) list.remove();
        });

        actions.appendChild(deleteButton);
        card.appendChild(actions);
      }

      list.appendChild(card);
    });

    const heading = section.querySelector('#memoryHeading');
    section.insertBefore(list, heading || form);
  }

  async function enhancePendingMemoryPhotos() {
    if (!db) return;
    const target = document.querySelector('#pendingMemories');
    if (!target) return;
    if (!(await currentUserIsAdmin())) return;

    const { data, error } = await db
      .from('memories')
      .select('id,photo_path')
      .eq('approved', false)
      .is('rejection_reason', null)
      .order('created_at', { ascending: true });

    if (error || !data?.length) return;

    for (const item of data) {
      if (!item.photo_path) continue;
      const button = target.querySelector(`.review-memory[data-id="${item.id}"]`);
      const reviewItem = button?.closest('.review-item');
      if (!reviewItem || reviewItem.querySelector('[data-review-memory-photo]')) continue;

      const url = await signedPhotoUrl(item.photo_path);
      if (!url) continue;

      const figure = document.createElement('figure');
      figure.className = 'review-memory-photo';
      figure.dataset.reviewMemoryPhoto = 'true';

      const image = document.createElement('img');
      image.src = url;
      image.alt = text.reviewPhotoAlt;
      image.loading = 'lazy';

      figure.appendChild(image);
      const actions = reviewItem.querySelector('.review-actions');
      reviewItem.insertBefore(figure, actions || null);
    }
  }

  function schedulePendingPhotoEnhancement() {
    window.clearTimeout(pendingPhotoTimer);
    pendingPhotoTimer = window.setTimeout(enhancePendingMemoryPhotos, 80);
  }

  const pendingTarget = document.querySelector('#pendingMemories');
  if (pendingTarget) {
    const observer = new MutationObserver(schedulePendingPhotoEnhancement);
    observer.observe(pendingTarget, { childList: true, subtree: true });
  }

  document.addEventListener('click', event => {
    const star = event.target.closest?.('[data-star]');
    if (star) showApprovedMemories(star.dataset.star);

    const declineButton = event.target.closest?.('.review-memory[data-decision="decline"]');
    if (declineButton && db) {
      const memoryId = declineButton.dataset.id;
      if (memoryId) {
        void (async () => {
          const { data } = await db
            .from('memories')
            .select('photo_path')
            .eq('id', memoryId)
            .maybeSingle();

          if (data?.photo_path) {
            window.setTimeout(() => {
              void db.storage.from(PHOTO_BUCKET).remove([data.photo_path]);
            }, 900);
          }
        })();
      }
    }
  }, true);

  schedulePendingPhotoEnhancement();
})();
