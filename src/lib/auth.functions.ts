import { createServerFn } from "@tanstack/react-start";

// Access-password protection is temporarily disabled.
// verifyAppSecret always reports success so any remaining UI gate unlocks.
export const verifyAppSecret = createServerFn({ method: "POST" })
  .inputValidator((_d: unknown) => ({}))
  .handler(async () => ({ ok: true as const }));
