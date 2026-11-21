// The JSON Web Token is the single source of truth for who is logged in and their ROLE.
// The backend signs { sub, name, email, role, iat, exp } at login; the frontend only DECODES
// it (to pick screens and buttons). It never trusts a separately stored role, and the
// server re-verifies the signature + role on every API call, so editing storage gains nothing.

export const TOKEN_KEY = 'sunpower_token';

const b64urlDecode = (part) => {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes); // UTF-8 safe (names with non-ASCII letters)
};

const b64urlEncode = (text) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** Payload of a JWT, or null if it is not a well-formed token. Does NOT verify the signature. */
export function decodeToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(b64urlDecode(parts[1]));
  } catch {
    return null;
  }
}

/** True when the token has an `exp` claim in the past (with a small clock-skew margin). */
export function isExpired(payload, skewSeconds = 10) {
  return !!payload?.exp && payload.exp * 1000 <= Date.now() - skewSeconds * 1000;
}

/** { id, name, email, role, expiresAt } from a valid, unexpired token – otherwise null. */
export function userFromToken(token) {
  const p = decodeToken(token);
  if (!p || !p.role || isExpired(p)) return null;
  return {
    id: Number(p.sub),
    name: p.name,
    email: p.email,
    role: String(p.role).toUpperCase(),
    expiresAt: p.exp ? p.exp * 1000 : null,
  };
}

export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const getCurrentUser = () => userFromToken(getStoredToken());

/**
 * Mock mode only: an UNSIGNED token with the same claims the backend issues, so the app reads
 * the role the same way offline. The real server would reject it (no valid signature).
 */
export function makeMockToken(user, ttlSeconds = 8 * 3600) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = b64urlEncode(
    JSON.stringify({ sub: String(user.id), name: user.name, email: user.email, role: user.role, iat: now, exp: now + ttlSeconds }),
  );
  return `${header}.${payload}.mock`;
}
