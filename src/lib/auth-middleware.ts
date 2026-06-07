import { createMiddleware } from "@tanstack/react-start";

// Access-password protection is temporarily disabled.
// These helpers are kept as no-ops so existing imports continue to compile.

export function getStoredSecret(): string | null {
  return null;
}

export function setStoredSecret(_value: string) {
  /* no-op */
}

export function clearStoredSecret() {
  /* no-op */
}

// Pass-through middleware — no header sent, no server-side check.
export const appSecretAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => next())
  .server(async ({ next }) => next());
