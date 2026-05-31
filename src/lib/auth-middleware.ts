import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

const STORAGE_KEY = "app-secret";

export function getStoredSecret(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSecret(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function clearStoredSecret() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const appSecretAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const token = getStoredSecret();
    return next({
      headers: token ? { "x-app-secret": token } : {},
    });
  })
  .server(async ({ next }) => {
    const expected = process.env.APP_SECRET;
    if (!expected) {
      console.error("APP_SECRET is not configured on the server");
      throw new Error("Server is not configured. Please contact the owner.");
    }
    const provided = getRequestHeader("x-app-secret") ?? "";
    if (!constantTimeEqual(provided, expected)) {
      throw new Error("Unauthorized — enter the access password.");
    }
    return next();
  });
