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

document.querySelectorAll('[data-open-auth]').forEach((button) => button.addEventListener('click', () => openAuth(button.dataset.openAuth)));

function openAuth(mode = 'signup') {
  authMode = mode;
  $('#authTitle').textContent = mode === 'login' ? 'Welcome back' : 'Join our community';
  $('#authNote').textContent = mode === 'login' ? 'Log in to your protected member area.' : 'Create your protected member account.';
  $('#authSubmit').textContent = mode === 'login' ? 'Log in' : 'Create account';
  $('#authNameLabel').classList.toggle('hidden', mode === 'login');
  $('#authName').required = mode === 'signup';
  setMessage('authMessage', sb ? '' : 'The secure community service is temporarily unavailable. Please refresh the page and try again.', !sb);
  openModal(authModal);
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
          emailRedirectTo: location.origin,
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

async function loadApprovedMemorials() {
  if (!sb) return;
  const { data, error } = await sb.from('memorials')
    .select('id,child_name,remembrance')
    .eq('approved', true)
    .eq('public_requested', true)
    .order('created_at', { ascending: true });
  if (error) return;
  const field = $('#starField');
  field?.querySelectorAll('.star.community-star').forEach((element) => element.remove());
  (data || []).forEach((item, index) => {
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'star community-star';
    star.style.setProperty('--i', index + 1);
    star.setAttribute('aria-label', `Memorial for ${item.child_name}`);
    star.title = item.remembrance || item.child_name;
    const label = document.createElement('span');
    label.textContent = item.child_name;
    star.appendChild(label);
    field?.appendChild(star);
  });
}

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
    sb.from('support_groups').select('id,slug,name,description').eq('is_active', true).order('created_at'),
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
            data-room-status="${status}" ${pending || blocked ? 'disabled' : ''}>${buttonText}</button>
        </div>
      </article>`;
  }).join('');

  grid.querySelectorAll('.room-action').forEach((button) => button.addEventListener('click', async () => {
    const group = {
      id: button.dataset.roomId,
      name: button.dataset.roomName,
      description: button.dataset.roomDescription
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
  const { error } = await sb.from('group_posts').insert({
    group_id: activeRoom.id,
    user_id: activeUser.id,
    author_name: activeProfile?.display_name || activeUser.email?.split('@')[0] || 'Community member',
    body
  });
  setMessage('postMessage', error ? friendlyError(error) : 'Your post has been shared with this room.', Boolean(error));
  if (!error) {
    event.target.reset();
    await loadPosts();
  }
});

function requestCard(title, body, meta, type, id) {
  return `<div class="admin-request" data-review-type="${escapeHtml(type)}" data-review-id="${escapeHtml(id)}">
    <h4>${escapeHtml(title)}</h4>${body ? `<p>${escapeHtml(body)}</p>` : ''}
    <div class="admin-meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
    <div class="admin-actions"><button class="admin-approve" type="button" data-decision="approve">Approve</button><button class="admin-decline" type="button" data-decision="decline">Decline</button></div>
  </div>`;
}

async function loadAdminDashboard() {
  const panel = $('#adminDashboard');
  if (!activeProfile?.is_admin) { panel?.classList.add('hidden'); return; }
  panel?.classList.remove('hidden');
  setMessage('adminMessage', 'Loading pending requests…');
  const [membershipsRes, memorialsRes, memoriesRes, groupsRes, profilesRes] = await Promise.all([
    sb.from('group_members').select('group_id,user_id,status,joined_at').eq('status','pending').order('joined_at'),
    sb.from('memorials').select('id,user_id,child_name,remembrance,public_requested,created_at').eq('approved',false).is('rejection_reason',null).order('created_at'),
    sb.from('memories').select('id,user_id,author_name,message,created_at').eq('approved',false).is('rejection_reason',null).order('created_at'),
    sb.from('support_groups').select('id,name'),
    sb.from('profiles').select('id,display_name')
  ]);
  const firstError=[membershipsRes,memorialsRes,memoriesRes,groupsRes,profilesRes].find(r=>r.error)?.error;
  if(firstError){setMessage('adminMessage',friendlyError(firstError),true);return;}
  const groups=new Map((groupsRes.data||[]).map(x=>[x.id,x.name]));
  const profiles=new Map((profilesRes.data||[]).map(x=>[x.id,x.display_name||'Community member']));
  const memberships=membershipsRes.data||[], memorials=memorialsRes.data||[], memories=memoriesRes.data||[];
  $('#pendingMembershipCount').textContent=memberships.length; $('#pendingMemorialCount').textContent=memorials.length; $('#pendingMemoryCount').textContent=memories.length;
  $('#adminMemberships').innerHTML=memberships.length?memberships.map(x=>requestCard(groups.get(x.group_id)||'Protected room','',[profiles.get(x.user_id)||'Community member',new Date(x.joined_at).toLocaleString()], 'membership', `${x.group_id}:${x.user_id}`)).join(''):'<p class="empty-state">No pending room requests.</p>';
  $('#adminMemorials').innerHTML=memorials.length?memorials.map(x=>requestCard(x.child_name,x.remembrance,[profiles.get(x.user_id)||'Community member',x.public_requested?'Public wall requested':'Private memorial',new Date(x.created_at).toLocaleString()], 'memorial', x.id)).join(''):'<p class="empty-state">No pending memorials.</p>';
  $('#adminMemories').innerHTML=memories.length?memories.map(x=>requestCard(`Memory from ${x.author_name}`,x.message,[profiles.get(x.user_id)||'Community member',new Date(x.created_at).toLocaleString()], 'memory', x.id)).join(''):'<p class="empty-state">No pending memories.</p>';
  panel.querySelectorAll('.admin-actions button').forEach(btn=>btn.addEventListener('click',handleAdminDecision));
  setMessage('adminMessage','');
}

async function handleAdminDecision(event){
  const button=event.currentTarget, card=button.closest('.admin-request');
  const type=card.dataset.reviewType, requestId=card.dataset.reviewId, decision=button.dataset.decision;
  let reason='';
  if(decision==='decline') reason=prompt('Optional private reason for declining:','')||'Not approved at this time.';
  card.querySelectorAll('button').forEach(b=>b.disabled=true);
  setMessage('adminMessage', `${decision==='approve'?'Approving':'Declining'} request…`);
  const result=await callSecureFunction('review-request',{requestType:type,requestId,decision,reason});
  if(!result.ok){card.querySelectorAll('button').forEach(b=>b.disabled=false);setMessage('adminMessage',result.error||'The review could not be completed.',true);return;}
  setMessage('adminMessage',result.emailSent===false?'Decision saved. Email delivery is not configured yet.':'Decision saved and email sent.');
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
