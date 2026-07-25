const { createClient } = require('@supabase/supabase-js');

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const serviceClient = () => {
  if(!process.env.SUPABASE_URL) throw new Error('Netlify environment variable SUPABASE_URL is missing.');
  if(!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Netlify environment variable SUPABASE_SERVICE_ROLE_KEY is missing. Run the v15 Supabase SQL migration or configure this variable.');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken:false, persistSession:false } });
};
async function authenticatedUser(event, adminRequired=false){
  const token=(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) throw new Error('Missing authentication token.');
  const client=serviceClient(); const {data,error}=await client.auth.getUser(token); if(error||!data.user) throw new Error('Invalid session.');
  if(adminRequired){ const {data:profile,error:profileError}=await client.from('profiles').select('is_admin').eq('id',data.user.id).single(); if(profileError||!profile?.is_admin) throw new Error('Administrator access required.'); }
  return {client,user:data.user};
}
async function sendMail({to,subject,html}){
  if(!process.env.RESEND_API_KEY) return false;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM||"Sky's Bridge <notifications@skysbridge.org>",to:[to],subject,html})});
  if(!response.ok) throw new Error(`Email provider returned ${response.status}.`); return true;
}
module.exports={json,authenticatedUser,sendMail};
