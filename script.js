const SKYBRIDGE_VERSION = '18.0.0';
const cfg = window.SKYBRIDGE_CONFIG || {};
const configured = Boolean(
  cfg.supabaseUrl && cfg.supabaseAnonKey &&
  !cfg.supabaseUrl.startsWith('YOUR_') &&
  !cfg.supabaseAnonKey.startsWith('YOUR_')
);
const supabaseLibrary = window.supabase;
const sb = configured && supabaseLibrary?.createClient
  ? supabaseLibrary.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
  : null;

const $ = (selector) => document.querySelector(selector);
const nav = $('.topbar nav');
$('.menu')?.addEventListener('click', () => nav?.classList.toggle('open'));
document.querySelectorAll('.topbar nav a').forEach((link) => link.addEventListener('click', () => nav?.classList.remove('open')));
const yearElement = $('#year');
if (yearElement) yearElement.textContent = new Date().getFullYear();

const authModal = $('#authModal');
const memorialModal = $('#memorialModal');
const skyStoryModal = $('#skyStoryModal');
const memoryModal = $('#memoryModal');
const communityStarModal = $('#communityStarModal');
let authMode = 'signup';
let activeUser = null;
let activeProfile = null;
let activeRoom = null;
let roomMemberships = new Map();

function openModal(modal) {
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lock');
}

function closeModals() {
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  });
  document.body.classList.remove('lock');
}

function setMessage(id, text, isError = false) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('error', isError);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[character]);
}

function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (error.message?.includes('duplicate key')) return 'This request already exists.';
  return error.message || fallback;
}

document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', closeModals));
document.querySelectorAll('.modal').forEach((modal) => modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModals();
}));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModals();
});

document.querySelectorAll('[data-open-auth]').forEach((button) => button.addEventListener('click', () => {
  nav?.classList.remove('open');
  openAuth(button.dataset.openAuth);
}));
document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => openAuth(button.dataset.authMode)));

function openAuth(mode = 'signup') {
  authMode = mode === 'login' ? 'login' : 'signup';
  const isLogin = authMode === 'login';
  $('#authTitle').textContent = isLogin ? 'Welcome back' : 'Join our community';
  $('#authNote').textContent = isLogin ? 'Log in to your protected member area.' : 'Create your protected member account.';
  $('#authSubmit').textContent = isLogin ? 'Log in' : 'Create account';
  $('#authNameLabel').classList.toggle('hidden', isLogin);
  $('#authName').required = !isLogin;
  $('#authPassword').setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    const selected = tab.dataset.authMode === authMode;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  const alternative = $('#authAlternative');
  if (alternative) {
    alternative.dataset.authMode = isLogin ? 'signup' : 'login';
    alternative.innerHTML = isLogin
      ? 'New to Sky\'s Bridge? <strong>Create an account</strong>'
      : 'Already have an account? <strong>Log in</strong>';
  }
  setMessage('authMessage', sb ? '' : 'The secure community service is temporarily unavailable. Please refresh the page and try again.', !sb);
  openModal(authModal);
  setTimeout(() => (isLogin ? $('#authEmail') : $('#authName'))?.focus(), 50);
}

async function requireUser(message) {
  if (!sb) {
    openAuth('signup');
    setMessage('authMessage', 'The secure community service is temporarily unavailable. Please refresh the page and try again.', true);
    return null;
  }
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) {
    openAuth('login');
    setMessage('authMessage', message);
    return null;
  }
  return user;
}

$('#openMemorial')?.addEventListener('click', async () => {
  if (!(await requireUser('Please log in before honoring a child.'))) return;
  setMessage('memorialMessage', '');
  openModal(memorialModal);
});

$('#hubOpenMemorial')?.addEventListener('click', async () => {
  if (!(await requireUser('Please log in before honoring a child.'))) return;
  setMessage('memorialMessage', '');
  openModal(memorialModal);
});

$('#openSkyStory')?.addEventListener('click', () => openModal(skyStoryModal));
$('#openMemory')?.addEventListener('click', async () => {
  closeModals();
  if (!(await requireUser('Please log in before leaving a memory.'))) return;
  setMessage('memoryMessage', '');
  openModal(memoryModal);
});

$('#authForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!sb) {
    setMessage('authMessage', 'The secure community service is temporarily unavailable. Please refresh the page and try again.', true);
    return;
  }
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  const displayName = $('#authName').value.trim();
  setMessage('authMessage', 'Please wait…');

  const result = authMode === 'login'
    ? await sb.auth.signInWithPassword({ email, password })
    : await sb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "https://skysbridge.org/",
          data: { display_name: displayName }
        }
      });

  if (result.error) {
    setMessage('authMessage', friendlyError(result.error), true);
    return;
  }
  setMessage('authMessage', authMode === 'login' ? 'Logged in.' : 'Please check your email to confirm your account.');
  if (authMode === 'login') {
    setTimeout(async () => {
      closeModals();
      await refreshSession();
      $('#communityHub')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }
});

$('#signOut')?.addEventListener('click', async () => {
  if (sb) await sb.auth.signOut();
  activeUser = null;
  activeProfile = null;
  activeRoom = null;
  await refreshSession();
});

async function callSecureFunction(name, payload) {
  if (!sb || !activeUser) return { ok: false, skipped: true };
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) return { ok: false, skipped: true };
    const response = await fetch(`/.netlify/functions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    return { ok: response.ok, ...result };
  } catch (error) {
    console.warn(`Sky's Bridge function ${name} could not be reached`, error);
    return { ok: false, error: error.message };
  }
}

$('#memorialForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const user = await requireUser('Please log in before submitting a memorial.');
  if (!user) return;
  setMessage('memorialMessage', 'Submitting…');
  const payload = {
    user_id: user.id,
    child_name: $('#childName').value.trim(),
    remembrance: $('#childStory').value.trim(),
    birth_date: $('#childBirthDate').value || null,
    passing_date: $('#childPassingDate').value || null,
    public_requested: $('#publicConsent').checked
  };
  const { data: createdMemorial, error } = await sb.from('memorials').insert(payload).select('id').single();
  setMessage('memorialMessage', error ? friendlyError(error) : 'Your memorial was submitted privately for review.', Boolean(error));
  if (!error) {
    event.target.reset();
    if (createdMemorial?.id) callSecureFunction('notify-request', { requestType: 'memorial', requestId: createdMemorial.id });
    await loadMyMemorials();
    if (activeProfile?.is_admin) await loadAdminDashboard();
  }
});

$('#memoryForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const user = await requireUser('Please log in before leaving a memory.');
  if (!user) return;
  setMessage('memoryMessage', 'Submitting…');
  const payload = {
    star_slug: 'sky',
    user_id: user.id,
    author_name: $('#memoryAuthor').value.trim(),
    message: $('#memoryText').value.trim()
  };
  const { data: createdMemory, error } = await sb.from('memories').insert(payload).select('id').single();
  setMessage('memoryMessage', error ? friendlyError(error) : 'Thank you. Your memory was submitted privately for review.', Boolean(error));
  if (!error) {
    event.target.reset();
    if (createdMemory?.id) callSecureFunction('notify-request', { requestType: 'memory', requestId: createdMemory.id });
    if (activeProfile?.is_admin) await loadAdminDashboard();
  }
});

const STAR_PAGE_SIZE = 24;
let starPage = 0;
let starSearchTerm = '';
let starLoading = false;
let starHasMore = false;
let starRenderedCount = 0;
let starSearchTimer = null;

function dateParts(dateValue) {
  if (!dateValue) return null;
  const match = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

function isAnnualDateToday(dateValue, now = new Date()) {
  const parts = dateParts(dateValue);
  return Boolean(parts && parts.month === now.getMonth() + 1 && parts.day === now.getDate());
}

function formatMemorialDate(dateValue) {
  const parts = dateParts(dateValue);
  if (!parts) return '';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(parts.year, parts.month - 1, parts.day));
}

function memorialDayState(item, now = new Date()) {
  return {
    birthday: isAnnualDateToday(item.birth_date, now),
    remembrance: isAnnualDateToday(item.passing_date, now)
  };
}

function openCommunityStar(item) {
  $('#communityStarTitle').textContent = item.child_name || 'A cherished child';
  const dates = [];
  if (item.birth_date) dates.push(`Born: ${formatMemorialDate(item.birth_date)}`);
  if (item.passing_date) dates.push(`Remembered: ${formatMemorialDate(item.passing_date)}`);
  $('#communityStarDates').textContent = dates.join('  •  ');
  $('#communityStarRemembrance').textContent = item.remembrance || 'Held forever in the hearts of those who love them.';
  openModal(communityStarModal);
}

function formatLifeSpan(item) {
  const born = dateParts(item.birth_date);
  const passed = dateParts(item.passing_date);
  if (!born || !passed) return 'Forever loved';
  const birth = new Date(born.year, born.month - 1, born.day);
  const passing = new Date(passed.year, passed.month - 1, passed.day);
  if (passing < birth) return 'Forever loved';
  const days = Math.max(0, Math.round((passing - birth) / 86400000));
  if (days < 14) return `${days || 1} ${days === 1 ? 'day' : 'days'}`;
  if (days < 60) { const weeks = Math.max(1, Math.round(days / 7)); return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`; }
  if (days < 730) { const months = Math.max(1, Math.round(days / 30.4375)); return `${months} ${months === 1 ? 'month' : 'months'}`; }
  const years = Math.max(1, Math.floor(days / 365.2425)); return `${years} ${years === 1 ? 'year' : 'years'}`;
}

function createCandle() {
  const candle = document.createElement('span');
  candle.className = 'memorial-candle';
  candle.setAttribute('aria-hidden', 'true');
  candle.innerHTML = '<span class="candle-glow"></span><span class="candle-flame"></span><span class="candle-wick"></span><span class="candle-body"></span>';
  return candle;
}

function createCommunityStar(item, index) {
  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'star community-star';
  star.style.setProperty('--delay', `${(index % 12) * -0.23}s`);
  const state = memorialDayState(item);
  if (state.birthday) star.classList.add('is-birthday');
  if (state.remembrance) star.classList.add('is-remembrance-day');
  const dayLabels = [];
  if (state.birthday) dayLabels.push('birthday star');
  if (state.remembrance) dayLabels.push('remembrance day');
  star.setAttribute('aria-label', `Open memorial for ${item.child_name}${dayLabels.length ? `, ${dayLabels.join(' and ')}` : ''}`);
  star.innerHTML = `
    <span class="community-star-visual" aria-hidden="true">
      <svg class="premium-star-svg" viewBox="0 0 120 120" focusable="false"><path d="M60 4 64 54 116 60 64 66 60 116 56 66 4 60 56 54Z"/></svg>
    </span>
    <strong></strong>
    <span class="memorial-divider" aria-hidden="true"><i></i><b>◆</b><i></i></span>
    <span class="memorial-age"></span>`;
  star.querySelector('strong').textContent = item.child_name;
  star.querySelector('.memorial-age').textContent = formatLifeSpan(item);
  star.appendChild(createCandle());
  star.addEventListener('click', () => openCommunityStar(item));
  return star;
}

function applySkyAnnualTribute(now = new Date()) {
  const skyStar = $('#openSkyStory');
  if (!skyStar) return;
  const isFebruaryNinth = now.getMonth() === 1 && now.getDate() === 9;
  skyStar.classList.toggle('sky-annual-tribute', isFebruaryNinth);
  skyStar.setAttribute('aria-label', isFebruaryNinth
    ? 'Open Sky’s story. Sky’s annual day of light and remembrance.'
    : 'Open Sky’s story.');
}

function updateStarWallStatus(message = '') {
  const state = $('#starFieldState');
  const more = $('#loadMoreStars');
  if (state) {
    state.textContent = message;
    state.classList.toggle('hidden', !message);
  }
  more?.classList.toggle('hidden', !starHasMore || starLoading);
  const count = $('#starCount');
  if (count) {
    if (starSearchTerm) count.textContent = `${starRenderedCount} matching ${starRenderedCount === 1 ? 'star' : 'stars'}`;
    else count.textContent = starRenderedCount ? `Sky and ${starRenderedCount} more ${starRenderedCount === 1 ? 'light' : 'lights'}` : 'Sky is the first light';
  }
}

async function loadApprovedMemorials({ reset = true } = {}) {
  const grid = $('#starGrid');
  if (!grid || starLoading) return;
  if (!sb) {
    updateStarWallStatus('More lights will appear here as memorials are approved.');
    return;
  }

  starLoading = true;
  if (reset) {
    starPage = 0;
    starRenderedCount = 0;
    grid.innerHTML = '';
  }
  updateStarWallStatus('Loading stars…');

  const from = starPage * STAR_PAGE_SIZE;
  const to = from + STAR_PAGE_SIZE;
  let query = sb.from('memorials')
    .select('id,child_name,remembrance,birth_date,passing_date,created_at')
    .eq('approved', true)
    .eq('public_requested', true)
    .eq('archived', false)
    .order('created_at', { ascending: ($('#starSort')?.value || 'newest') === 'oldest' })
    .range(from, to);

  if (starSearchTerm) query = query.ilike('child_name', `%${starSearchTerm}%`);
  const { data, error } = await query;
  starLoading = false;

  if (error) {
    updateStarWallStatus('The stars could not be loaded right now. Please try again.');
    return;
  }

  const rows = data || [];
  const visibleRows = rows.slice(0, STAR_PAGE_SIZE);
  visibleRows.forEach((item, index) => grid.appendChild(createCommunityStar(item, starRenderedCount + index)));
  starRenderedCount += visibleRows.length;
  starHasMore = rows.length > STAR_PAGE_SIZE;
  if (starHasMore) starPage += 1;

  if (!starRenderedCount) {
    updateStarWallStatus(starSearchTerm ? `No star found for “${starSearchTerm}”.` : 'More lights will appear here as memorials are approved.');
  } else {
    updateStarWallStatus('');
  }
}

applySkyAnnualTribute();

$('#loadMoreStars')?.addEventListener('click', () => loadApprovedMemorials({ reset: false }));

$('#starSort')?.addEventListener('change', () => loadApprovedMemorials({ reset: true }));

$('#starSearch')?.addEventListener('input', (event) => {
  clearTimeout(starSearchTimer);
  starSearchTimer = setTimeout(() => {
    starSearchTerm = event.target.value.trim();
    loadApprovedMemorials({ reset: true });
  }, 300);
});

$('#starField')?.addEventListener('scroll', (event) => {
  const field = event.currentTarget;
  if (starHasMore && !starLoading && field.scrollTop + field.clientHeight >= field.scrollHeight - 120) {
    loadApprovedMemorials({ reset: false });
  }
});

async function loadProfile() {
  if (!activeUser) return;
  const { data, error } = await sb.from('profiles').select('display_name,is_admin').eq('id', activeUser.id).maybeSingle();
  if (error) {
    setMessage('profileMessage', friendlyError(error), true);
    return;
  }
  activeProfile = data || { display_name: '' };
  $('#profileName').value = activeProfile.display_name || '';
  $('#memberGreeting').textContent = activeProfile.display_name
    ? `Welcome, ${activeProfile.display_name}. Your protected community space is ready.`
    : 'Your protected community space is ready.';
}

$('#profileForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeUser) return;
  const displayName = $('#profileName').value.trim();
  if (!displayName) {
    setMessage('profileMessage', 'Please enter a community name.', true);
    return;
  }
  setMessage('profileMessage', 'Saving…');
  const { error } = await sb.from('profiles').update({ display_name: displayName }).eq('id', activeUser.id);
  setMessage('profileMessage', error ? friendlyError(error) : 'Profile saved.', Boolean(error));
  if (!error) await loadProfile();
});

async function loadMyMemorials() {
  if (!activeUser) return;
  const list = $('#myMemorials');
  list.innerHTML = '<p class="empty-state">Loading…</p>';
  const { data, error } = await sb.from('memorials')
    .select('id,child_name,approved,public_requested,created_at')
    .eq('user_id', activeUser.id)
    .order('created_at', { ascending: false });
  if (error) {
    list.innerHTML = `<p class="empty-state">${escapeHtml(friendlyError(error))}</p>`;
    return;
  }
  if (!data?.length) {
    list.innerHTML = '<p class="empty-state">No memorial submitted yet.</p>';
    return;
  }
  list.innerHTML = data.map((item) => `
    <div class="status-item">
      <strong>${escapeHtml(item.child_name)}</strong>
      <span class="status-pill ${item.approved ? 'approved' : ''}">${item.approved ? 'Approved' : 'In review'}</span>
    </div>`).join('');
}

async function loadRooms() {
  if (!activeUser) return;
  const grid = $('#roomGrid');
  grid.innerHTML = '<p class="empty-state">Loading protected rooms…</p>';

  const [groupsResult, membershipsResult] = await Promise.all([
    sb.from('support_groups').select('id,slug,name,description,forward_messages_to_email,forwarding_notice').eq('is_active', true).order('created_at'),
    sb.from('group_members').select('group_id,status,role').eq('user_id', activeUser.id)
  ]);

  if (groupsResult.error || membershipsResult.error) {
    grid.innerHTML = `<p class="empty-state">${escapeHtml(friendlyError(groupsResult.error || membershipsResult.error))}</p>`;
    return;
  }

  roomMemberships = new Map((membershipsResult.data || []).map((membership) => [membership.group_id, membership]));
  const groups = groupsResult.data || [];
  if (!groups.length) {
    grid.innerHTML = '<p class="empty-state">No rooms are available yet.</p>';
    return;
  }

  grid.innerHTML = groups.map((group) => {
    const membership = roomMemberships.get(group.id);
    const status = membership?.status || 'not-joined';
    const approved = status === 'approved';
    const pending = status === 'pending';
    const blocked = status === 'blocked';
    const buttonText = approved ? 'Enter room' : pending ? 'Request pending' : blocked ? 'Unavailable' : 'Request access';
    return `
      <article class="room-card">
        <div class="room-symbol">✦</div>
        <h4>${escapeHtml(group.name)}</h4>
        <p>${escapeHtml(group.description)}</p>
        <div class="room-actions">
          <span class="room-state">${approved ? 'Approved member' : pending ? 'Awaiting review' : blocked ? 'Access unavailable' : 'Protected'}</span>
          <button class="btn ${approved ? 'gold' : 'ghost'} room-action" type="button"
            data-room-id="${group.id}" data-room-name="${escapeHtml(group.name)}" data-room-description="${escapeHtml(group.description)}"
            data-room-forward="${group.forward_messages_to_email ? 'true' : 'false'}" data-room-notice="${escapeHtml(group.forwarding_notice || '')}"
            data-room-status="${status}" ${pending || blocked ? 'disabled' : ''}>${buttonText}</button>
        </div>
      </article>`;
  }).join('');

  grid.querySelectorAll('.room-action').forEach((button) => button.addEventListener('click', async () => {
    const group = {
      id: button.dataset.roomId,
      name: button.dataset.roomName,
      description: button.dataset.roomDescription,
      forwardMessagesToEmail: button.dataset.roomForward === 'true',
      forwardingNotice: button.dataset.roomNotice || ''
    };
    if (button.dataset.roomStatus === 'approved') await enterRoom(group);
    else await requestRoomAccess(group.id, button);
  }));
}

async function requestRoomAccess(groupId, button) {
  if (!activeUser) return;
  button.disabled = true;
  button.textContent = 'Sending…';
  const { data: createdMembership, error } = await sb.from('group_members').insert({
    group_id: groupId,
    user_id: activeUser.id,
    role: 'member',
    status: 'pending'
  }).select('group_id,user_id').single();
  if (error) {
    button.disabled = false;
    button.textContent = 'Request access';
    alert(friendlyError(error));
    return;
  }
  if (createdMembership) callSecureFunction('notify-request', { requestType: 'membership', requestId: groupId });
  await loadRooms();
  if (activeProfile?.is_admin) await loadAdminDashboard();
}

async function enterRoom(group) {
  activeRoom = group;
  $('#activeRoomName').textContent = group.name;
  $('#activeRoomDescription').textContent = group.description;
  const professionalSupport = $('#professionalSupport');
  const professionalCheckbox = $('#sendToProfessional');
  if (professionalSupport) professionalSupport.classList.toggle('hidden', !group.forwardMessagesToEmail);
  if (professionalCheckbox) professionalCheckbox.checked = false;
  $('#roomConversation').classList.remove('hidden');
  setMessage('postMessage', '');
  await loadPosts();
  $('#roomConversation').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('#closeRoom')?.addEventListener('click', () => {
  activeRoom = null;
  $('#roomConversation').classList.add('hidden');
});

async function loadPosts() {
  if (!activeRoom) return;
  const feed = $('#postFeed');
  feed.innerHTML = '<p class="empty-state">Loading conversation…</p>';
  const { data, error } = await sb.from('group_posts')
    .select('id,body,author_name,created_at,user_id')
    .eq('group_id', activeRoom.id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    feed.innerHTML = `<p class="empty-state">${escapeHtml(friendlyError(error))}</p>`;
    return;
  }
  if (!data?.length) {
    feed.innerHTML = '<p class="empty-state">No posts yet. This can be a quiet beginning.</p>';
    return;
  }
  feed.innerHTML = data.map((post) => `
    <article class="community-post">
      <div class="post-meta">
        <span class="post-author">${escapeHtml(post.author_name || 'Community member')}</span>
        <time class="post-date">${new Date(post.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time>
      </div>
      <p>${escapeHtml(post.body)}</p>
    </article>`).join('');
}

$('#postForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeUser || !activeRoom) return;
  const body = $('#postBody').value.trim();
  if (!body) return;
  setMessage('postMessage', 'Sharing…');
  const { data: createdPost, error } = await sb.from('group_posts').insert({
    group_id: activeRoom.id,
    user_id: activeUser.id,
    author_name: activeProfile?.display_name || activeUser.email?.split('@')[0] || 'Community member',
    body
  }).select('id').single();
  if (error) {
    setMessage('postMessage', friendlyError(error), true);
    return;
  }

  const shareWithProfessional = Boolean($('#sendToProfessional')?.checked);
  let message = 'Your post has been shared with this room.';
  if (shareWithProfessional && activeRoom.forwardMessagesToEmail && createdPost?.id) {
    const notification = await callSecureFunction('notify-room-message', {
      postId: createdPost.id,
      shareWithProfessional: true
    });
    message = notification?.emailSent
      ? "Your post has been shared with this room and securely shared with a Sky's Bridge grief professional."
      : 'Your post has been shared with this room. The optional professional-support copy could not be sent.';
  }
  setMessage('postMessage', message, false);
  event.target.reset();
  await loadPosts();
});

function requestCard(title, body, meta, type, id) {
  return `<div class="admin-request" data-review-type="${escapeHtml(type)}" data-review-id="${escapeHtml(id)}">
    <h4>${escapeHtml(title)}</h4>${body ? `<p>${escapeHtml(body)}</p>` : ''}
    <div class="admin-meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
    <div class="admin-actions"><button class="admin-approve" type="button" data-decision="approve">Approve</button><button class="admin-decline" type="button" data-decision="decline">Decline</button></div>
  </div>`;
}

function adminStatus(item) {
  if (item.archived) return 'Archived';
  if (item.approved) return 'Approved';
  if (item.rejection_reason) return 'Rejected';
  return 'Pending';
}

function managementCard(item, type) {
  const isMemorial = type === 'memorial';
  const title = isMemorial ? item.child_name : `Memory from ${item.author_name}`;
  const body = isMemorial ? item.remembrance : item.message;
  const status = adminStatus(item);
  const actions = [];
  if (item.archived) actions.push(['restore','Restore']);
  else actions.push(['archive','Archive']);
  if (item.approved) actions.push(['reject','Reject approval']);
  else actions.push(['approve','Approve']);
  actions.push(['delete','Delete permanently']);
  return `<div class="admin-request admin-managed-item" data-content-type="${type}" data-content-id="${escapeHtml(item.id)}">
    <div class="admin-item-top"><h4>${escapeHtml(title)}</h4><span class="admin-state state-${status.toLowerCase()}">${status}</span></div>
    ${body ? `<p>${escapeHtml(body)}</p>` : ''}
    <div class="admin-meta"><span>${new Date(item.created_at).toLocaleString()}</span>${item.rejection_reason ? `<span>Reason: ${escapeHtml(item.rejection_reason)}</span>` : ''}</div>
    <div class="admin-actions">${actions.map(([action,label])=>`<button type="button" class="admin-manage-action action-${action}" data-action="${action}">${label}</button>`).join('')}</div>
  </div>`;
}

async function loadAdminDashboard() {
  const panel = $('#adminDashboard');
  if (!activeProfile?.is_admin) { panel?.classList.add('hidden'); return; }
  panel?.classList.remove('hidden');
  setMessage('adminMessage', 'Loading administration…');
  const [membershipsRes, pendingMemorialsRes, pendingMemoriesRes, allMemorialsRes, allMemoriesRes, groupsRes, profilesRes] = await Promise.all([
    sb.from('group_members').select('group_id,user_id,status,joined_at').eq('status','pending').order('joined_at'),
    sb.from('memorials').select('id,user_id,child_name,remembrance,public_requested,created_at').eq('approved',false).is('rejection_reason',null).eq('archived',false).order('created_at'),
    sb.from('memories').select('id,user_id,author_name,message,created_at').eq('approved',false).is('rejection_reason',null).eq('archived',false).order('created_at'),
    sb.from('memorials').select('id,child_name,remembrance,approved,archived,rejection_reason,created_at').order('created_at',{ascending:false}).limit(250),
    sb.from('memories').select('id,author_name,message,approved,archived,rejection_reason,created_at').order('created_at',{ascending:false}).limit(250),
    sb.from('support_groups').select('id,name'),
    sb.from('profiles').select('id,display_name')
  ]);
  const results=[membershipsRes,pendingMemorialsRes,pendingMemoriesRes,allMemorialsRes,allMemoriesRes,groupsRes,profilesRes];
  const firstError=results.find(r=>r.error)?.error;
  if(firstError){setMessage('adminMessage',friendlyError(firstError),true);return;}
  const groups=new Map((groupsRes.data||[]).map(x=>[x.id,x.name]));
  const profiles=new Map((profilesRes.data||[]).map(x=>[x.id,x.display_name||'Community member']));
  const memberships=membershipsRes.data||[], memorials=pendingMemorialsRes.data||[], memories=pendingMemoriesRes.data||[];
  window.adminMemorialItems=allMemorialsRes.data||[]; window.adminMemoryItems=allMemoriesRes.data||[];
  $('#pendingMembershipCount').textContent=memberships.length; $('#pendingMemorialCount').textContent=memorials.length; $('#pendingMemoryCount').textContent=memories.length;
  $('#managedMemorialCount').textContent=window.adminMemorialItems.length; $('#managedMemoryCount').textContent=window.adminMemoryItems.length;
  $('#adminMemberships').innerHTML=memberships.length?memberships.map(x=>requestCard(groups.get(x.group_id)||'Protected room','',[profiles.get(x.user_id)||'Community member',new Date(x.joined_at).toLocaleString()], 'membership', `${x.group_id}:${x.user_id}`)).join(''):'<p class="empty-state">No pending room requests.</p>';
  $('#adminMemorials').innerHTML=memorials.length?memorials.map(x=>requestCard(x.child_name,x.remembrance,[profiles.get(x.user_id)||'Community member',x.public_requested?'Public wall requested':'Private memorial',new Date(x.created_at).toLocaleString()], 'memorial', x.id)).join(''):'<p class="empty-state">No pending memorials.</p>';
  $('#adminMemories').innerHTML=memories.length?memories.map(x=>requestCard(`Memory from ${x.author_name}`,x.message,[profiles.get(x.user_id)||'Community member',new Date(x.created_at).toLocaleString()], 'memory', x.id)).join(''):'<p class="empty-state">No pending memories.</p>';
  renderAdminManagement();
  panel.querySelectorAll('.admin-actions button[data-decision]').forEach(btn=>btn.addEventListener('click',handleAdminDecision));
  setMessage('adminMessage','');
}

function renderAdminManagement(){
  const mq=($('#adminMemorialSearch')?.value||'').trim().toLowerCase();
  const rq=($('#adminMemorySearch')?.value||'').trim().toLowerCase();
  const memorials=(window.adminMemorialItems||[]).filter(x=>!mq||`${x.child_name} ${x.remembrance}`.toLowerCase().includes(mq));
  const memories=(window.adminMemoryItems||[]).filter(x=>!rq||`${x.author_name} ${x.message}`.toLowerCase().includes(rq));
  $('#adminAllMemorials').innerHTML=memorials.length?memorials.map(x=>managementCard(x,'memorial')).join(''):'<p class="empty-state">No matching memorials.</p>';
  $('#adminAllMemories').innerHTML=memories.length?memories.map(x=>managementCard(x,'memory')).join(''):'<p class="empty-state">No matching memories.</p>';
  document.querySelectorAll('.admin-manage-action').forEach(btn=>btn.addEventListener('click',handleContentManagement));
}

async function handleContentManagement(event){
  const button=event.currentTarget, card=button.closest('.admin-managed-item');
  const contentType=card.dataset.contentType, contentId=card.dataset.contentId, action=button.dataset.action;
  let reason=null;
  if(action==='reject') reason=prompt('Private reason for rejecting this approval:','Removed from public view by an administrator.')||'Removed from public view by an administrator.';
  if(action==='delete'){
    const label=contentType==='memorial'?'memorial and its star':'memory';
    if(!confirm(`Delete this ${label} permanently? This cannot be undone.`)) return;
  }
  if(action==='archive'&&!confirm('Archive this item? It will be hidden but can be restored later.')) return;
  card.querySelectorAll('button').forEach(b=>b.disabled=true);
  setMessage('adminMessage', `${action.charAt(0).toUpperCase()+action.slice(1)} in progress…`);
  const {data,error}=await sb.rpc('admin_manage_content',{p_content_type:contentType,p_content_id:contentId,p_action:action,p_reason:reason});
  if(error){card.querySelectorAll('button').forEach(b=>b.disabled=false);setMessage('adminMessage',`Action failed: ${friendlyError(error)}`,true);return;}
  setMessage('adminMessage','Change saved successfully.');
  await Promise.all([loadAdminDashboard(),loadMyMemorials(),loadApprovedMemorials({reset:true})]);
}

$('#adminMemorialSearch')?.addEventListener('input',renderAdminManagement);
$('#adminMemorySearch')?.addEventListener('input',renderAdminManagement);

async function handleAdminDecision(event){
  const button=event.currentTarget, card=button.closest('.admin-request');
  const type=card.dataset.reviewType, requestId=card.dataset.reviewId, decision=button.dataset.decision;
  let reason='';
  if(decision==='decline') reason=prompt('Optional private reason for declining:','')||'Not approved at this time.';
  card.querySelectorAll('button').forEach(b=>b.disabled=true);
  setMessage('adminMessage', `${decision==='approve'?'Approving':'Declining'} request…`);
  // v17: use a protected Supabase RPC first. This works without a Netlify
  // service-role key and verifies the administrator inside the database.
  let result = { ok: false };
  const { data: rpcData, error: rpcError } = await sb.rpc('review_community_request', {
    p_request_type: type,
    p_request_id: requestId,
    p_decision: decision,
    p_reason: reason || null
  });
  if (!rpcError) {
    result = { ok: true, ...(rpcData || {}), emailSent: false };
  } else if (/function .*review_community_request|schema cache/i.test(rpcError.message || '')) {
    // Backward-compatible fallback for deployments where the v15 SQL has not
    // yet been run but the Netlify service-role function is configured.
    result = await callSecureFunction('review-request',{requestType:type,requestId,decision,reason});
  } else {
    result = { ok: false, error: `Review failed: ${friendlyError(rpcError)}` };
  }
  if(!result.ok){
    card.querySelectorAll('button').forEach(b=>b.disabled=false);
    setMessage('adminMessage',result.error||'The review could not be completed.',true);
    return;
  }
  card.remove();
  setMessage('adminMessage',result.emailSent?'Decision saved and email sent.':'Decision saved successfully.');
  await Promise.all([loadAdminDashboard(),loadRooms(),loadMyMemorials(),loadApprovedMemorials()]);
}

$('#refreshAdmin')?.addEventListener('click',loadAdminDashboard);

async function loadCommunity() {
  await Promise.all([loadProfile(), loadMyMemorials(), loadRooms()]);
  await loadAdminDashboard();
}

$('#refreshCommunity')?.addEventListener('click', async () => {
  setMessage('profileMessage', 'Refreshing…');
  await loadCommunity();
  setMessage('profileMessage', 'Community refreshed.');
  if (activeRoom) await loadPosts();
});

async function refreshSession() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  activeUser = session?.user || null;
  $('#memberPanel').classList.toggle('hidden', !session);
  $('#communityHub').classList.toggle('hidden', !session);
  if (!session) $('#adminDashboard')?.classList.add('hidden');
  $('#memberEmail').textContent = session?.user?.email || '';
  document.querySelectorAll('[data-open-auth]').forEach((button) => button.classList.toggle('hidden', Boolean(session)));
  if (session) await loadCommunity();
  else {
    $('#roomConversation')?.classList.add('hidden');
    activeRoom = null;
  }
}

if (sb) {
  refreshSession();
  loadApprovedMemorials();
  sb.auth.onAuthStateChange(() => refreshSession());
}
