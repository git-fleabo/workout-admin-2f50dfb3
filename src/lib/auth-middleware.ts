import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

const STORAGE_KEY = "app-secret";
const HEADER_NAME = "x-app-secret";
const PREVIEW_FALLBACK_SECRET = "preview";

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

export const appSecretAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const secret = getStoredSecret();
    return next({
      headers: secret ? { [HEADER_NAME]: secret } : {},
    });
  })
  .server(async ({ next }) => {
    // Temporary staging-preview fallback. Remove before merging/releasing.
    const expected = process.env.APP_SECRET || PREVIEW_FALLBACK_SECRET;
    const provided = getRequestHeader(HEADER_NAME);
    if (provided !== expected) {
      throw new Error("Unauthorized — enter the access password.");
    }
    return next();
  });
