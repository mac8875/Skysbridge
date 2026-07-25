const { createClient } = require('@supabase/supabase-js');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const serviceClient = () => {
  if (!process.env.SUPABASE_URL) {
    throw new Error('Netlify environment variable SUPABASE_URL is missing.');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Netlify environment variable SUPABASE_SERVICE_ROLE_KEY is missing.');
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
};

async function authenticatedUser(event, adminRequired = false) {
  const token = (event.headers.authorization || event.headers.Authorization || '')
    .replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing authentication token.');

  const client = serviceClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid session.');

  if (adminRequired) {
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('is_admin')
      .eq('id', data.user.id)
      .single();
    if (profileError || !profile?.is_admin) {
      throw new Error('Administrator access required.');
    }
  }
  return { client, user: data.user };
}

async function microsoftGraphToken() {
  const tenantId = process.env.M365_TENANT_ID;
  const clientId = process.env.M365_CLIENT_ID;
  const clientSecret = process.env.M365_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Microsoft 365 Graph environment variables are incomplete.');
  }

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      })
    }
  );

  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    const detail = tokenPayload.error_description || tokenPayload.error || `HTTP ${tokenResponse.status}`;
    throw new Error(`Microsoft 365 authentication failed: ${detail}`);
  }
  return tokenPayload.access_token;
}

async function sendMail({ to, subject, html, replyTo }) {
  const sender = process.env.M365_SENDER_EMAIL;
  if (!sender) throw new Error('Netlify environment variable M365_SENDER_EMAIL is missing.');

  const recipients = Array.isArray(to) ? to : [to];
  const cleanRecipients = recipients.filter(Boolean).map(address => ({ emailAddress: { address } }));
  if (!cleanRecipients.length) throw new Error('No email recipient was configured.');

  const accessToken = await microsoftGraphToken();
  const message = {
    subject,
    body: { contentType: 'HTML', content: html },
    toRecipients: cleanRecipients
  };
  if (replyTo) {
    message.replyTo = [{ emailAddress: { address: replyTo } }];
  }

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, saveToSentItems: true })
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Microsoft Graph could not send the email: ${detail}`);
  }
  return true;
}

module.exports = { json, authenticatedUser, sendMail };
