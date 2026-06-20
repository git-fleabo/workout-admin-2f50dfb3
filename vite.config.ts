// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { execSync } from "node:child_process";

function buildId() {
  const envCommit = [
    process.env.GITHUB_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
    process.env.NETLIFY_COMMIT_REF,
    process.env.COMMIT_SHA,
    process.env.SOURCE_VERSION,
    process.env.RENDER_GIT_COMMIT,
    process.env.LOVABLE_GIT_COMMIT_SHA,
  ].find(Boolean);
  if (envCommit) return envCommit.slice(0, 7);

  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
  }
}

export default defineConfig({
  vite: {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId()),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
