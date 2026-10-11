import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  clearSupabaseSession,
  getSupabaseSession,
  refreshSupabaseSession,
  setSupabaseSession,
  supabaseCachedSelect,
  supabasePublicSelect,
} from "@/lib/supabase-public";
const original = {
  access_token: "old-access",
  refresh_token: "old-refresh",
  expires_at: 1,
  user: { id: "owner" },
};
const fresh = {
  ...original,
  access_token: "new-access",
  refresh_token: "new-refresh",
  expires_in: 3600,
  expires_at: undefined,
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  setSupabaseSession(original);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
afterEach(() => vi.restoreAllMocks());
it("parallel page loads share one refresh and rotated session", async () => {
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) =>
      String(url).includes("/auth/") ? response(fresh) : response([]),
    );
  await Promise.all([
    supabasePublicSelect("people"),
    supabasePublicSelect("sessions"),
    supabasePublicSelect("programs"),
  ]);
  expect(request.mock.calls.filter(([url]) => String(url).includes("/auth/"))).toHaveLength(1);
  expect(getSupabaseSession()?.refresh_token).toBe("new-refresh");
  expect(
    request.mock.calls
      .filter(([url]) => String(url).includes("/rest/"))
      .every(
        ([, init]) =>
          (init?.headers as Record<string, string>).Authorization === "Bearer new-access",
      ),
  ).toBe(true);
});
it("late 401 responses use the token already refreshed by another request", async () => {
  setSupabaseSession({ ...original, expires_at: Math.floor(Date.now() / 1000) + 3600 });
  let release!: (response: Response) => void;
  const late = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const request = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (String(url).includes("/auth/")) return response(fresh);
    if ((init?.headers as Record<string, string>).Authorization === "Bearer new-access")
      return response([]);
    if (String(url).includes("sessions")) return late;
    return response({}, 401);
  });
  const first = supabasePublicSelect("people");
  const second = supabasePublicSelect("sessions");
  await first;
  release(response({}, 401));
  await second;
  expect(request.mock.calls.filter(([url]) => String(url).includes("/auth/"))).toHaveLength(1);
});
it.each(["network", "service"])(
  "keeps expired credentials and local drafts after a transient %s failure",
  async (kind) => {
    window.localStorage.setItem("workout-session-draft:owner", "draft");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      if (kind === "network") throw new TypeError("Failed to fetch");
      return response({}, 503);
    });
    await expect(refreshSupabaseSession()).rejects.toThrow();
    expect(getSupabaseSession()?.refresh_token).toBe("old-refresh");
    expect(window.localStorage.getItem("workout-session-draft:owner")).toBe("draft");
  },
);
it("invalid credentials clear only the login, leaving recoverable work", async () => {
  window.localStorage.setItem("workout-save-operation:pending", "retained");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    response({ code: "refresh_token_not_found" }, 400),
  );
  await expect(refreshSupabaseSession()).rejects.toThrow("Sign in again");
  expect(getSupabaseSession()).toBeNull();
  expect(window.localStorage.getItem("workout-save-operation:pending")).toBe("retained");
});
it.each(["logout", "switch"])(
  "a stale refresh cannot overwrite a subsequent %s",
  async (change) => {
    let release!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const refreshing = refreshSupabaseSession();
    if (change === "logout") clearSupabaseSession();
    else setSupabaseSession({ ...fresh, user: { id: "another-owner" } });
    release(response(fresh));
    await expect(refreshing).rejects.toThrow("sign-in changed");
    expect(getSupabaseSession()?.user.id ?? null).toBe(
      change === "logout" ? null : "another-owner",
    );
  },
);
it("a stale failed refresh cannot clear a newer rotated login", async () => {
  let release!: (response: Response) => void;
  vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  const refreshing = refreshSupabaseSession();
  setSupabaseSession(fresh);
  release(response({}, 400));
  await expect(refreshing).resolves.toMatchObject({ refresh_token: "new-refresh" });
  expect(getSupabaseSession()?.access_token).toBe("new-access");
});
it("cached references survive offline reload, stay account scoped and never replace a denial", async () => {
  setSupabaseSession(fresh);
  const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(response([{ id: "gym" }]));
  const params = { select: "id", person_id: "eq.owner" };
  await supabaseCachedSelect("training_locations", params);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  await expect(supabaseCachedSelect("training_locations", params)).resolves.toEqual([
    { id: "gym" },
  ]);
  expect(request).toHaveBeenCalledTimes(1);
  setSupabaseSession({ ...fresh, user: { id: "another-owner" } });
  await expect(supabaseCachedSelect("training_locations", params)).rejects.toThrow("Offline");
  setSupabaseSession(fresh);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  request.mockResolvedValue(response({ message: "Access denied" }, 403));
  await expect(supabaseCachedSelect("training_locations", params)).rejects.toThrow("Access denied");
});

it("independent tabs serialize token rotation with a shared Web Lock", async () => {
  let release: () => void = () => undefined;
  let previous = Promise.resolve();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (_name: string, work: () => Promise<unknown>) => {
        const wait = previous;
        previous = new Promise<void>((resolve) => {
          release = resolve;
        });
        const done = release;
        await wait;
        try {
          return await work();
        } finally {
          done();
        }
      },
    },
  });
  try {
    vi.resetModules();
    const first = await import("@/lib/supabase-public");
    vi.resetModules();
    const second = await import("@/lib/supabase-public");
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) =>
        String(url).includes("/auth/") ? response(fresh) : response([]),
      );
    await Promise.all([
      first.supabasePublicSelect("people"),
      second.supabasePublicSelect("sessions"),
    ]);
    expect(request.mock.calls.filter(([url]) => String(url).includes("/auth/"))).toHaveLength(1);
    expect(first.getSupabaseSession()?.refresh_token).toBe("new-refresh");
    expect(second.getSupabaseSession()?.refresh_token).toBe("new-refresh");
  } finally {
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  }
});

it("late response parsing cannot return one account's data after an account switch", async () => {
  setSupabaseSession(fresh);
  let release!: (rows: unknown[]) => void;
  const result = response([]);
  const parse = vi.spyOn(result, "json").mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  vi.spyOn(globalThis, "fetch").mockResolvedValue(result);
  const loading = supabasePublicSelect("people");
  await vi.waitFor(() => expect(parse).toHaveBeenCalled());
  setSupabaseSession({ ...fresh, user: { id: "another-owner" } });
  release([{ id: "original-profile" }]);
  await expect(loading).rejects.toThrow("sign-in changed");
});
