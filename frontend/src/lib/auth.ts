const AUTH_KEY = "cafeos-auth";

export type AuthSession = {
  access_token: string;
  role: string;
  name: string;
};

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(AUTH_KEY);
}

export function authHeaders(): Record<string, string> {
  const session = getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export function roleHome(role: string) {
  if (role === "KITCHEN") return "/kitchen";
  if (role === "ADMIN") return "/admin";
  return "/pos";
}
