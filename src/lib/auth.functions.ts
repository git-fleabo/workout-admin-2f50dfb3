import { createServerFn } from "@tanstack/react-start";

const PREVIEW_FALLBACK_SECRET = "preview";

function isAllowedSecret(secret: string) {
  const allowed = [process.env.APP_SECRET, PREVIEW_FALLBACK_SECRET].filter(Boolean);
  return allowed.includes(secret);
}

export const verifyAppSecret = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({
    password: typeof d?.password === "string" ? d.password : "",
  }))
  .handler(async ({ data }) => {
    // Temporary staging-preview fallback. Remove before merging/releasing.
    return { ok: isAllowedSecret(data.password) };
  });
