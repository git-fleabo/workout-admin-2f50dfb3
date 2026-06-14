import { getServerConfig } from "./config.server";

type QueryValue = string | number | boolean | null | undefined;

function config() {
  const { supabaseUrl, supabaseServiceRoleKey } = getServerConfig();
  if (!supabaseUrl) throw new Error("SUPABASE_URL missing");
  if (!supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return {
    url: supabaseUrl.replace(/\/+$/, ""),
    key: supabaseServiceRoleKey,
  };
}

function queryString(params?: Record<string, QueryValue>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null || value === "") continue;
    qs.set(key, String(value));
  }
  const text = qs.toString();
  return text ? `?${text}` : "";
}

async function request<T>(
  path: string,
  init?: RequestInit,
  params?: Record<string, QueryValue>,
): Promise<T> {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${path}${queryString(params)}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase API error", res.status, text);
    throw new Error("Failed to reach Supabase. Please try again.");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function supabaseSelect<T>(
  table: string,
  params?: Record<string, QueryValue>,
) {
  return request<T[]>(table, { method: "GET" }, params);
}

export function supabaseInsert<T>(
  table: string,
  body: Record<string, unknown> | Record<string, unknown>[],
) {
  return request<T[]>(table, {
    method: "POST",
    body: JSON.stringify(Array.isArray(body) ? body : [body]),
  });
}

export function supabaseUpdate<T>(
  table: string,
  params: Record<string, QueryValue>,
  body: Record<string, unknown>,
) {
  return request<T[]>(table, {
    method: "PATCH",
    body: JSON.stringify(body),
  }, params);
}

export function supabaseDelete<T>(
  table: string,
  params: Record<string, QueryValue>,
) {
  return request<T[]>(table, { method: "DELETE" }, params);
}
