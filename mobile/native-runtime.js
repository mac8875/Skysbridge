import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const redirectUrl = window.SKYSBRIDGE_CONFIG?.NATIVE_AUTH_REDIRECT_URL?.trim() || '';
const clients = new Set();
const pendingUrls = [];
const processedUrls = new Set();
const isNative = Capacitor.isNativePlatform();

function authParams(url) {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  return {
    code: query.get('code'),
    tokenHash: query.get('token_hash') || hash.get('token_hash'),
    type: query.get('type') || hash.get('type'),
    accessToken: hash.get('access_token'),
    refreshToken: hash.get('refresh_token'),
    error: query.get('error_description') || hash.get('error_description') || query.get('error'),
  };
}

async function handleAuthUrl(client, url) {
  let params;
  try {
    params = authParams(url);
  } catch {
    return false;
  }

  if (params.error) {
    window.dispatchEvent(new CustomEvent('skysbridge:auth-error', { detail: params.error }));
    return true;
  }

  if (params.code) {
    const { error } = await client.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return true;
  }

  if (params.tokenHash && params.type) {
    const { error } = await client.auth.verifyOtp({
      token_hash: params.tokenHash,
      type: params.type,
    });
    if (error) throw error;
    return true;
  }

  if (params.accessToken && params.refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) throw error;
    return true;
  }

  return false;
}

async function processUrl(url) {
  if (processedUrls.has(url)) return;
  const client = clients.values().next().value;
  if (!client) {
    if (!pendingUrls.includes(url)) pendingUrls.push(url);
    return;
  }

  processedUrls.add(url);
  try {
    await handleAuthUrl(client, url);
  } catch (error) {
    window.dispatchEvent(new CustomEvent('skysbridge:auth-error', {
      detail: error?.message || 'The sign-in link could not be completed.',
    }));
  }
}

function patchSupabase() {
  const factory = window.supabase?.createClient;
  if (!factory || factory.__skysbridgeMobilePatched) return;

  function createClient(...args) {
    const client = factory(...args);
    clients.add(client);

    if (isNative && redirectUrl) {
      const signUp = client.auth.signUp.bind(client.auth);
      client.auth.signUp = (credentials, options = {}) => signUp(credentials, {
        ...options,
        options: {
          ...options.options,
          emailRedirectTo: options.options?.emailRedirectTo || redirectUrl,
        },
      });

      while (pendingUrls.length) processUrl(pendingUrls.shift());
    }

    return client;
  }

  createClient.__skysbridgeMobilePatched = true;
  window.supabase.createClient = createClient;
}

patchSupabase();
window.skysbridgeMobile = {
  isNative,
  redirectUrl: redirectUrl || null,
  processAuthUrl: processUrl,
};

if (isNative) {
  App.addListener('appUrlOpen', ({ url }) => processUrl(url));
  App.getLaunchUrl().then(({ url }) => {
    if (url) return processUrl(url);
  }).catch(() => {});
}
