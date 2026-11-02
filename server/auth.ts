import { createHash, randomBytes } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import { HttpError } from './errors.js';

// 같은 OAuth 클라이언트를 쓰는 앱끼리 appDataFolder 를 공유한다. 허브는 읽기만 한다
const SCOPE = 'openid email https://www.googleapis.com/auth/drive.appdata';
const SESSION_COOKIE = 'ph_session';
const REFRESH_COOKIE = 'ph_refresh';
const OAUTH_COOKIE = 'ph_oauth';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const env = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '',
  secret: process.env.SESSION_SECRET?.trim() ?? '',
  allowed: (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
});

export const authEnabled = () => !!env().clientId;

export function missingAuthEnv(): string[] {
  const current = env();
  return [
    !current.clientId && 'GOOGLE_CLIENT_ID',
    !current.clientSecret && 'GOOGLE_CLIENT_SECRET',
    !current.secret && 'SESSION_SECRET',
    !current.allowed.length && 'ALLOWED_EMAILS',
  ].filter((name): name is string => !!name);
}

function requireConfig() {
  const missing = missingAuthEnv();
  if (missing.length) throw new HttpError(503, `서버에 로그인 설정(${missing.join(', ')})이 없어요.`);
  return env();
}

const appOrigin = (c: Context) => process.env.APP_ORIGIN?.trim().replace(/\/$/, '') || new URL(c.req.url).origin;

const cookieOptions = (c: Context, maxAge: number): CookieOptions => ({
  httpOnly: true,
  secure: appOrigin(c).startsWith('https://'),
  sameSite: 'Lax',
  path: '/',
  maxAge,
});

const base64Url = (buf: Buffer) => buf.toString('base64url');

// 구글 토큰 엔드포인트에서 TLS 로 직접 받은 id_token 이라 서명 검증 없이 내용만 읽는다
function readIdToken(idToken: unknown): { email?: string; emailVerified: boolean; aud?: string } {
  if (typeof idToken !== 'string') return { emailVerified: false };
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return { email: payload.email?.toLowerCase(), emailVerified: payload.email_verified === true, aud: payload.aud };
  } catch {
    return { emailVerified: false };
  }
}

async function googleToken(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

async function readSession(c: Context): Promise<string | null> {
  const { secret, allowed } = env();
  if (!secret) return null;
  const value = await getSignedCookie(c, secret, SESSION_COOKIE);
  if (!value) return null;
  const [email, expiresAt] = value.split('|');
  if (!email || !(Number(expiresAt) > Date.now()) || !allowed.includes(email)) return null;
  return email;
}

function clearAuthCookies(c: Context) {
  for (const name of [SESSION_COOKIE, REFRESH_COOKIE, OAUTH_COOKIE]) deleteCookie(c, name, { path: '/' });
}

export const authRoutes = new Hono();

authRoutes.get('/login', async (c) => {
  const { clientId, secret } = requireConfig();
  const state = base64Url(randomBytes(16));
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  await setSignedCookie(c, OAUTH_COOKIE, `${state}|${verifier}`, secret, cookieOptions(c, 600));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appOrigin(c)}/api/auth/callback`,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRoutes.get('/callback', async (c) => {
  const { clientId, clientSecret, secret, allowed } = requireConfig();
  const fail = (reason: string) => {
    clearAuthCookies(c);
    return c.redirect(`/?auth=${reason}`);
  };

  const saved = await getSignedCookie(c, secret, OAUTH_COOKIE);
  deleteCookie(c, OAUTH_COOKIE, { path: '/' });
  const [state, verifier] = saved ? saved.split('|') : [];
  const code = c.req.query('code');
  if (!state || !verifier || !code || c.req.query('state') !== state) return fail('error');

  const { ok, data } = await googleToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${appOrigin(c)}/api/auth/callback`,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });
  if (!ok || typeof data.refresh_token !== 'string') {
    console.error('[auth] token exchange failed', data.error);
    return fail('error');
  }

  const { email, emailVerified, aud } = readIdToken(data.id_token);
  if (!email || !emailVerified || aud !== clientId || !allowed.includes(email)) return fail('denied');

  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  await setSignedCookie(c, SESSION_COOKIE, `${email}|${expiresAt}`, secret, cookieOptions(c, SESSION_MAX_AGE));
  await setSignedCookie(c, REFRESH_COOKIE, data.refresh_token, secret, cookieOptions(c, SESSION_MAX_AGE));
  return c.redirect('/');
});

authRoutes.get('/me', async (c) => {
  if (!authEnabled()) return c.json({ enabled: false, email: null });
  return c.json({ enabled: true, email: await readSession(c) });
});

authRoutes.post('/token', async (c) => {
  const { clientId, clientSecret, secret } = requireConfig();
  const refreshToken = (await readSession(c)) && (await getSignedCookie(c, secret, REFRESH_COOKIE));
  if (!refreshToken) throw new HttpError(401, '다시 로그인해 주세요.');

  const { ok, data } = await googleToken({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  if (data.error === 'invalid_grant') {
    clearAuthCookies(c);
    throw new HttpError(401, '구글 로그인이 만료됐어요. 다시 로그인해 주세요.');
  }
  if (!ok || typeof data.access_token !== 'string') {
    console.error('[auth] token refresh failed', data.error);
    throw new HttpError(502, '구글 인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  return c.json({ accessToken: data.access_token, expiresIn: Number(data.expires_in) || 3600 });
});

// revoke 하지 않는다. 같은 클라이언트라 노벨벙커·레시피노트 쪽 권한까지 같이 끊길 수 있다
authRoutes.post('/logout', (c) => {
  clearAuthCookies(c);
  return c.body(null, 204);
});
