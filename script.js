const cfg = window.SKYBRIDGE_CONFIG || {};
const configured = cfg.supabaseUrl && !cfg.supabaseUrl.startsWith("YOUR_") && cfg.supabaseAnonKey && !cfg.supabaseAnonKey.startsWith("YOUR_");
const sb = configured ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

const nav = document.querySelector('.topbar nav');
document.querySelector('.menu').addEventListener('click',()=>nav.classList.toggle('open'));
document.querySelectorAll('.topbar nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
document.getElementById('year').textContent = new Date().getFullYear();

const authModal = document.getElementById('authModal');
const memorialModal = document.getElementById('memorialModal');
let authMode = 'signup';

function openModal(modal){ modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('lock'); }
function closeModals(){ document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden')); document.body.classList.remove('lock'); }
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModals));
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m) closeModals()}));

document.querySelectorAll('[data-open-auth]').forEach(btn=>btn.addEventListener('click',()=>{
  authMode = btn.dataset.openAuth;
  document.getElementById('authTitle').textContent = authMode==='login' ? 'Welcome back' : 'Join our community';
  document.getElementById('authNote').textContent = authMode==='login' ? 'Log in to your protected member area.' : 'Create your protected member account.';
  document.getElementById('authSubmit').textContent = authMode==='login' ? 'Log in' : 'Create account';
  document.getElementById('authMessage').textContent = configured ? '' : 'Supabase is not connected yet. Follow SETUP_GUIDE.txt.';
  openModal(authModal);
}));

document.getElementById('openMemorial').addEventListener('click',()=>openModal(memorialModal));

document.getElementById('authForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const msg = document.getElementById('authMessage');
  if(!sb){ msg.textContent='Supabase is not connected yet. Follow SETUP_GUIDE.txt.'; return; }
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  msg.textContent='Please wait…';
  const result = authMode==='login'
    ? await sb.auth.signInWithPassword({email,password})
    : await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});
  if(result.error){msg.textContent=result.error.message;return;}
  msg.textContent = authMode==='login' ? 'Logged in.' : 'Check your email to confirm your account.';
  if(authMode==='login'){setTimeout(()=>{closeModals();refreshSession();},600);}
});

document.getElementById('signOut').addEventListener('click',async()=>{ if(sb) await sb.auth.signOut(); refreshSession(); });

document.getElementById('memorialForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const msg=document.getElementById('memorialMessage');
  if(!sb){msg.textContent='Supabase is not connected yet. Follow SETUP_GUIDE.txt.';return;}
  const {data:{user}}=await sb.auth.getUser();
  if(!user){msg.textContent='Please log in before submitting a memorial.';return;}
  const payload={
    user_id:user.id,
    child_name:document.getElementById('childName').value.trim(),
    remembrance:document.getElementById('childStory').value.trim(),
    public_requested:document.getElementById('publicConsent').checked
  };
  const {error}=await sb.from('memorials').insert(payload);
  msg.textContent=error ? error.message : 'Your memorial was submitted privately for review.';
  if(!error)e.target.reset();
});

async function refreshSession(){
  if(!sb) return;
  const {data:{session}}=await sb.auth.getSession();
  const panel=document.getElementById('memberPanel');
  panel.classList.toggle('hidden',!session);
  document.getElementById('memberEmail').textContent=session?.user?.email||'';
}
if(sb){refreshSession();sb.auth.onAuthStateChange(()=>refreshSession());}
