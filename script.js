const cfg = window.SKYBRIDGE_CONFIG || {};
const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.startsWith("YOUR_") && !cfg.supabaseAnonKey.startsWith("YOUR_"));
const sb = configured ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

const nav = document.querySelector('.topbar nav');
document.querySelector('.menu').addEventListener('click',()=>nav.classList.toggle('open'));
document.querySelectorAll('.topbar nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
document.getElementById('year').textContent = new Date().getFullYear();

const authModal = document.getElementById('authModal');
const memorialModal = document.getElementById('memorialModal');
const skyStoryModal = document.getElementById('skyStoryModal');
const memoryModal = document.getElementById('memoryModal');
let authMode = 'signup';

function openModal(modal){
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('lock');
}
function closeModals(){
  document.querySelectorAll('.modal').forEach(m=>{m.classList.add('hidden');m.setAttribute('aria-hidden','true');});
  document.body.classList.remove('lock');
}
function setMessage(id,text,isError=false){
  const el=document.getElementById(id);
  el.textContent=text;
  el.classList.toggle('error',isError);
}

document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModals));
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m) closeModals()}));
document.addEventListener('keydown',e=>{if(e.key==='Escape') closeModals();});

document.querySelectorAll('[data-open-auth]').forEach(btn=>btn.addEventListener('click',()=>openAuth(btn.dataset.openAuth)));

function openAuth(mode='signup'){
  authMode=mode;
  document.getElementById('authTitle').textContent = mode==='login' ? 'Welcome back' : 'Join our community';
  document.getElementById('authNote').textContent = mode==='login' ? 'Log in to your protected member area.' : 'Create your protected member account.';
  document.getElementById('authSubmit').textContent = mode==='login' ? 'Log in' : 'Create account';
  setMessage('authMessage',configured ? '' : 'Supabase is not connected yet.');
  openModal(authModal);
}

document.getElementById('openMemorial').addEventListener('click',async()=>{
  if(!(await requireUser('Please log in before honoring a child.'))) return;
  setMessage('memorialMessage','');
  openModal(memorialModal);
});
document.getElementById('openSkyStory').addEventListener('click',()=>openModal(skyStoryModal));
document.getElementById('openMemory').addEventListener('click',async()=>{
  closeModals();
  if(!(await requireUser('Please log in before leaving a memory.'))) return;
  setMessage('memoryMessage','');
  openModal(memoryModal);
});

async function requireUser(message){
  if(!sb){ openAuth('signup'); setMessage('authMessage','Supabase setup is not complete.',true); return null; }
  const {data:{user}}=await sb.auth.getUser();
  if(!user){ openAuth('login'); setMessage('authMessage',message); return null; }
  return user;
}

document.getElementById('authForm').addEventListener('submit', async e=>{
  e.preventDefault();
  if(!sb){setMessage('authMessage','Supabase setup is not complete.',true);return;}
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  setMessage('authMessage','Please wait…');
  const result = authMode==='login'
    ? await sb.auth.signInWithPassword({email,password})
    : await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});
  if(result.error){setMessage('authMessage',result.error.message,true);return;}
  setMessage('authMessage',authMode==='login' ? 'Logged in.' : 'Please check your email to confirm your account.');
  if(authMode==='login'){setTimeout(()=>{closeModals();refreshSession();},500);}
});

document.getElementById('signOut').addEventListener('click',async()=>{
  if(sb) await sb.auth.signOut();
  refreshSession();
});

document.getElementById('memorialForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const user=await requireUser('Please log in before submitting a memorial.');
  if(!user)return;
  setMessage('memorialMessage','Submitting…');
  const payload={
    user_id:user.id,
    child_name:document.getElementById('childName').value.trim(),
    remembrance:document.getElementById('childStory').value.trim(),
    public_requested:document.getElementById('publicConsent').checked
  };
  const {error}=await sb.from('memorials').insert(payload);
  setMessage('memorialMessage',error ? error.message : 'Your memorial was submitted privately for review.',Boolean(error));
  if(!error)e.target.reset();
});

document.getElementById('memoryForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const user=await requireUser('Please log in before leaving a memory.');
  if(!user)return;
  setMessage('memoryMessage','Submitting…');
  const payload={
    star_slug:'sky',
    user_id:user.id,
    author_name:document.getElementById('memoryAuthor').value.trim(),
    message:document.getElementById('memoryText').value.trim()
  };
  const {error}=await sb.from('memories').insert(payload);
  setMessage('memoryMessage',error ? error.message : 'Thank you. Your memory was submitted privately for review.',Boolean(error));
  if(!error)e.target.reset();
});

async function loadApprovedMemorials(){
  if(!sb)return;
  const {data,error}=await sb.from('memorials')
    .select('id,child_name,remembrance')
    .eq('approved',true)
    .eq('public_requested',true)
    .order('created_at',{ascending:true});
  if(error)return;
  const field=document.getElementById('starField');
  field.querySelectorAll('.star.community-star').forEach(el=>el.remove());
  (data||[]).forEach((item,index)=>{
    const star=document.createElement('button');
    star.type='button';
    star.className='star community-star';
    star.style.setProperty('--i',index+1);
    star.setAttribute('aria-label',`Memorial for ${item.child_name}`);
    star.title=item.remembrance || item.child_name;
    const label=document.createElement('span');
    label.textContent=item.child_name;
    star.appendChild(label);
    field.appendChild(star);
  });
}

async function refreshSession(){
  if(!sb)return;
  const {data:{session}}=await sb.auth.getSession();
  document.getElementById('memberPanel').classList.toggle('hidden',!session);
  document.getElementById('memberEmail').textContent=session?.user?.email||'';
}

if(sb){
  refreshSession();
  loadApprovedMemorials();
  sb.auth.onAuthStateChange(()=>refreshSession());
}
