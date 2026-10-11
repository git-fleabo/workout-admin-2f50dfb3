import { withBrowserLock } from "./browser-lock";

// Deliberately kept as a small hand-rolled browser client for now. The data
// layer currently relies on its PostgREST parameter contract, explicit
// 401/refresh retry, and the legacy `supabase-session` storage key. Replacing
// it with supabase-js would require a coordinated migration of every
// `*.browser.ts` module plus auth and local-state compatibility work; do not
// introduce a second client until that migration can be completed and tested
// module by module.
const SUPABASE_URL = "https://dvcdghmcqqfvlbzufpyy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_iqg20-V7vRrN97WXoG1miw_Jw8QR2uk";
const SESSION_KEY = "supabase-session";
export const SUPABASE_SESSION_EVENT = "supabase-session-updated";

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: {
    id: string;
    email?: string;
  };
};

export class SupabaseAuthRequiredError extends Error {}

export class SupabaseRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function isTransientSupabaseError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof SupabaseRequestError && (error.status >= 500 || error.status === 429))
  );
}

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
  window.dispatchEvent(new Event(SUPABASE_SESSION_EVENT));
}

export function clearSupabaseSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SUPABASE_SESSION_EVENT));
}

export function getSupabaseRecoveryTokenFromUrl() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  if (params.get("type") !== "recovery") return null;
  return params.get("access_token");
}

export function clearSupabaseRecoveryUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState(
    null,
    document.title,
    window.location.pathname + window.location.search,
  );
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
    throw new SupabaseRequestError("Supabase sign-in failed.", res.status);
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

export async function updatePasswordWithRecoveryToken(accessToken: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: headers(accessToken),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase password reset error", res.status, text);
    throw new Error("Could not update password.");
  }
  return res.json() as Promise<unknown>;
}

export async function signOutOfSupabase() {
  const session = getSupabaseSession();
  clearSupabaseSession();
  if (session?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: headers(session.access_token),
    }).catch(() => undefined);
  }
}

function sessionNeedsRefresh(session: Session) {
  if (!session.expires_at) return false;
  const refreshBufferSeconds = 60;
  return session.expires_at <= Math.floor(Date.now() / 1000) + refreshBufferSeconds;
}

const refreshes = new Map<string, Promise<Session>>();

export function refreshSupabaseSession(expected = getSupabaseSession()): Promise<Session> {
  if (!expected?.refresh_token) {
    return Promise.reject(new SupabaseAuthRequiredError("Sign in to Supabase first."));
  }
  const existing = refreshes.get(expected.refresh_token);
  if (existing) return existing;
  const work = withBrowserLock("train-track-auth-refresh", async () => {
    const current = getSupabaseSession();
    if (!current || current.user.id !== expected.user.id) {
      throw new SupabaseAuthRequiredError("Your sign-in changed. Try again.");
    }
    if (current.refresh_token !== expected.refresh_token) return current;
    try {
      const data = await authRequest<Session>("token?grant_type=refresh_token", {
        refresh_token: current.refresh_token,
      });
      const latest = getSupabaseSession();
      if (!latest || latest.user.id !== current.user.id) {
        throw new SupabaseAuthRequiredError("Your sign-in changed. Try again.");
      }
      if (latest.refresh_token !== current.refresh_token) return latest;
      setSupabaseSession(data);
      return getSupabaseSession()!;
    } catch (error) {
      const latest = getSupabaseSession();
      if (latest?.user.id === current.user.id && latest.refresh_token !== current.refresh_token) {
        return latest;
      }
      if (error instanceof SupabaseRequestError && [400, 401].includes(error.status)) {
        if (latest?.refresh_token === current.refresh_token) clearSupabaseSession();
        throw new SupabaseAuthRequiredError(
          "Your sign-in expired. Sign in again; your local work is kept.",
        );
      }
      throw error;
    }
  });
  refreshes.set(expected.refresh_token, work);
  void work
    .finally(() => {
      if (refreshes.get(expected.refresh_token) === work) refreshes.delete(expected.refresh_token);
    })
    .catch(() => undefined);
  return work;
}

async function getActiveSession() {
  const session = getSupabaseSession();
  if (!session?.access_token) throw new SupabaseAuthRequiredError("Sign in to Supabase first.");
  if (!sessionNeedsRefresh(session)) return session;
  return refreshSupabaseSession(session);
}

function supabaseErrorMessage(status: number, text: string) {
  try {
    const parsed = JSON.parse(text) as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return [parsed.message, parsed.details, parsed.hint, parsed.code ? `Code: ${parsed.code}` : ""]
      .filter(Boolean)
      .join(" ");
  } catch {
    return text.trim() || `HTTP ${status}`;
  }
}

async function readRestResponse<T>(response: Response, userId: string): Promise<T> {
  const data = response.status === 204 ? undefined : await response.json();
  if (getSupabaseSession()?.user.id !== userId) {
    throw new SupabaseAuthRequiredError("Your sign-in changed. Try again.");
  }
  return data as T;
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
  if (getSupabaseSession()?.user.id !== session.user.id) {
    throw new SupabaseAuthRequiredError("Your sign-in changed. Try again.");
  }
  if (res.status === 401) {
    const latest = getSupabaseSession();
    const refreshed =
      latest?.user.id === session.user.id && latest.access_token !== session.access_token
        ? latest
        : await refreshSupabaseSession(session);
    const retry = await fetch(`${SUPABASE_URL}/rest/v1/${path}${queryString(params)}`, {
      ...init,
      headers: {
        ...headers(refreshed.access_token),
        Prefer: "return=representation",
        ...(init?.headers ?? {}),
      },
    });
    if (getSupabaseSession()?.user.id !== refreshed.user.id) {
      throw new SupabaseAuthRequiredError("Your sign-in changed. Try again.");
    }
    if (!retry.ok) {
      const text = await retry.text();
      console.error("Supabase REST error", retry.status, text);
      throw new SupabaseRequestError(
        `Supabase request failed: ${supabaseErrorMessage(retry.status, text)}`,
        retry.status,
      );
    }
    return readRestResponse<T>(retry, refreshed.user.id);
  }
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase REST error", res.status, text);
    throw new SupabaseRequestError(
      `Supabase request failed: ${supabaseErrorMessage(res.status, text)}`,
      res.status,
    );
  }
  return readRestResponse<T>(res, session.user.id);
}

export function supabasePublicSelect<T>(table: string, params?: Record<string, QueryValue>) {
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

export function supabasePublicDelete<T>(table: string, params: Record<string, QueryValue>) {
  return restRequest<T[]>(table, { method: "DELETE" }, params);
}

export function supabasePublicRpc<T>(functionName: string, body: Record<string, unknown>) {
  return restRequest<T>(`rpc/${functionName}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Used only for logger references, not training history or coaching decisions.
// Cache entries are scoped to the signed-in user and exact query. Denied access
// never falls back to cached data; every write still requires server approval.
export async function supabaseCachedSelect<T>(table: string, params?: Record<string, QueryValue>) {
  const userId = getSupabaseSession()?.user.id;
  if (!userId) throw new SupabaseAuthRequiredError("Sign in to Supabase first.");
  const key = `workout-reference:${userId}:${table}${queryString(params)}`;
  const cached = () => {
    try {
      return JSON.parse(window.localStorage.getItem(key) ?? "null") as T[] | null;
    } catch {
      return null;
    }
  };
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) throw new TypeError("Offline");
    const rows = await supabasePublicSelect<T>(table, params);
    try {
      window.localStorage.setItem(key, JSON.stringify(rows));
    } catch {
      /* Reads work without storage. */
    }
    return rows;
  } catch (error) {
    if (isTransientSupabaseError(error) && getSupabaseSession()?.user.id === userId) {
      const rows = cached();
      if (Array.isArray(rows)) return rows;
    }
    throw error;
  }
}
