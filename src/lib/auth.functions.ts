import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VerifyInput = z.object({ password: z.string().min(1).max(500) });

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const verifyAppSecret = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VerifyInput.parse(d))
  .handler(async ({ data }) => {
    const expected = process.env.APP_SECRET;
    if (!expected) {
      console.error("APP_SECRET is not configured on the server");
      return { ok: false as const };
    }
    return { ok: constantTimeEqual(data.password, expected) };
  });
