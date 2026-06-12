import { createServerFn } from "@tanstack/react-start";

export const verifyAppSecret = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({
    password: typeof d?.password === "string" ? d.password : "",
  }))
  .handler(async ({ data }) => {
    const expected = process.env.APP_SECRET;
    if (!expected) throw new Error("Server is not configured. Please contact the owner.");
    return { ok: data.password === expected };
  });
