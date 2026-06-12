import { createServerFn } from "@tanstack/react-start";

const PREVIEW_FALLBACK_SECRET = "preview";

export const verifyAppSecret = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({
    password: typeof d?.password === "string" ? d.password : "",
  }))
  .handler(async ({ data }) => {
    // Temporary staging-preview fallback. Remove before merging/releasing.
    const expected = process.env.APP_SECRET || PREVIEW_FALLBACK_SECRET;
    return { ok: data.password === expected };
  });
