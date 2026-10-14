// Shared helpers for enforcing a 10-hour absolute session lifetime (independent of idle timeout).
const SESSION_LOGIN_KEY = "nova_session_login_at";
export const SESSION_MAX_AGE_MS = 10 * 60 * 60 * 1000;

export function markSessionStart() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_LOGIN_KEY, Date.now().toString());
}

export function clearSessionStart() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_LOGIN_KEY);
}

export function getSessionStart(): number | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(SESSION_LOGIN_KEY);
  return value ? parseInt(value, 10) : null;
}

export function isSessionExpired(): boolean {
  const start = getSessionStart();
  if (!start) return false;
  return Date.now() - start > SESSION_MAX_AGE_MS;
}
