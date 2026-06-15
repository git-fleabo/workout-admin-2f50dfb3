const SUPABASE_URL = "https://dvcdghmcqqfvlbzufpyy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_iqg20-V7vRrN97WXoG1miw_Jw8QR2uk";
const SESSION_KEY = "supabase-session";

type Session = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: {
    id: string;
    email?: string;
  };
};

type QueryValue = string | number | boolean | null | undefined;

function queryString(params?: Record<string, QueryValue>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null || value === "") continue;
    qs.set(key, String(value));
  }
  const text = qs.toString();
  return text ? `?${text}` : "";
}

function headers(token?: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token ?? SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
  };
}

export function getSupabaseSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSupabaseSession(session: Session) {
  if (typeof window === "undefined") return;
  const expiresAt =
    session.expires_at ??
    (session.expires_in ? Math.floor(Date.now() / 1000) + session.expires_in : undefined);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, expires_at: expiresAt }));
}

export function clearSupabaseSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

async function authRequest<T>(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase Auth error", res.status, text);
    throw new Error("Supabase sign-in failed.");
  }
  return res.json() as Promise<T>;
}

export async function signInWithPassword(email: string, password: string) {
  const data = await authRequest<Session>("token?grant_type=password", {
    email,
    password,
  });
  setSupabaseSession(data);
  return data;
}

export async function signOutOfSupabase() {
  const session = getSupabaseSession();
  if (session?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: headers(session.access_token),
    }).catch(() => undefined);
  }
  clearSupabaseSession();
}

function sessionNeedsRefresh(session: Session) {
  if (!session.expires_at) return false;
  const refreshBufferSeconds = 60;
  return session.expires_at <= Math.floor(Date.now() / 1000) + refreshBufferSeconds;
}

export async function refreshSupabaseSession() {
  const session = getSupabaseSession();
  if (!session?.refresh_token) {
    clearSupabaseSession();
    throw new Error("Sign in to Supabase first.");
  }

  const data = await authRequest<Session>("token?grant_type=refresh_token", {
    refresh_token: session.refresh_token,
  });
  setSupabaseSession(data);
  return data;
}

async function getActiveSession() {
  const session = getSupabaseSession();
  if (!session?.access_token) throw new Error("Sign in to Supabase first.");
  if (!sessionNeedsRefresh(session)) return session;
  return refreshSupabaseSession();
}

async function restRequest<T>(
  path: string,
  init?: RequestInit,
  params?: Record<string, QueryValue>,
) {
  const session = await getActiveSession();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${queryString(params)}`, {
    ...init,
    headers: {
      ...headers(session.access_token),
      Prefer: "return=representation",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    const refreshed = await refreshSupabaseSession();
    const retry = await fetch(`${SUPABASE_URL}/rest/v1/${path}${queryString(params)}`, {
      ...init,
      headers: {
        ...headers(refreshed.access_token),
        Prefer: "return=representation",
        ...(init?.headers ?? {}),
      },
    });
    if (!retry.ok) {
      const text = await retry.text();
      console.error("Supabase REST error", retry.status, text);
      throw new Error("Supabase request failed.");
    }
    if (retry.status === 204) return undefined as T;
    return retry.json() as Promise<T>;
  }
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase REST error", res.status, text);
    throw new Error("Supabase request failed.");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function supabasePublicSelect<T>(
  table: string,
  params?: Record<string, QueryValue>,
) {
  return restRequest<T[]>(table, { method: "GET" }, params);
}

export function supabasePublicInsert<T>(
  table: string,
  body: Record<string, unknown> | Record<string, unknown>[],
) {
  return restRequest<T[]>(table, {
    method: "POST",
    body: JSON.stringify(Array.isArray(body) ? body : [body]),
  });
}

export function supabasePublicUpdate<T>(
  table: string,
  params: Record<string, QueryValue>,
  body: Record<string, unknown>,
) {
  return restRequest<T[]>(
    table,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
    params,
  );
}

export function supabasePublicDelete<T>(
  table: string,
  params: Record<string, QueryValue>,
) {
  return restRequest<T[]>(table, { method: "DELETE" }, params);
}
