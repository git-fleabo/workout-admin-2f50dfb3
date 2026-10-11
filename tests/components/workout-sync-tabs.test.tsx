import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { setSupabaseSession } from "@/lib/supabase-public";
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
}));
beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  setSupabaseSession({ access_token: "access", refresh_token: "refresh", user: { id: "owner" } });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
afterEach(() => {
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  vi.restoreAllMocks();
});
async function twoTabs() {
  vi.resetModules();
  const first = await import("@/lib/workout-offline-queue");
  vi.resetModules();
  const second = await import("@/lib/workout-offline-queue");
  const item = first.enqueueWorkoutSave({
    personId: "person",
    rpcBody: { p_person_id: "person" },
    draftKey: "draft",
  });
  return { first, second, item };
}
it("independent tabs use a shared Web Lock to serialize sync", async () => {
  const waits = new Map<string, Promise<void>>();
  const requestLock = vi.fn(async (name: string, work: () => Promise<unknown>) => {
    const previous = waits.get(name) ?? Promise.resolve();
    let release!: () => void;
    waits.set(
      name,
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request: requestLock },
  });
  const { first, second } = await twoTabs();
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify("saved"), { status: 200 }));
  expect(
    await Promise.all([first.flushQueuedWorkoutSaves(), second.flushQueuedWorkoutSaves()]),
  ).toEqual([0, 0]);
  expect(request).toHaveBeenCalledTimes(1);
  expect(
    requestLock.mock.calls.filter(([name]) => name === "train-track-workout-sync"),
  ).toHaveLength(2);
});
it("without Web Locks both tabs reuse the same server operation ID", async () => {
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  const { first, second, item } = await twoTabs();
  const receipts = new Map<string, string>();
  let commits = 0;
  const request = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const operation = JSON.parse(init?.body as string).p_operation_id as string;
    if (!receipts.has(operation)) {
      commits++;
      receipts.set(operation, "saved");
    }
    return new Response(JSON.stringify(receipts.get(operation)), { status: 200 });
  });
  await Promise.all([first.flushQueuedWorkoutSaves(), second.flushQueuedWorkoutSaves()]);
  expect(request).toHaveBeenCalledTimes(2);
  expect(commits).toBe(1);
  expect(
    request.mock.calls.every(
      ([, init]) => JSON.parse(init?.body as string).p_operation_id === item.id,
    ),
  ).toBe(true);
  expect(first.queuedWorkoutSaveCount()).toBe(0);
});
it("a late failed tab cannot resurrect an operation another tab already confirmed", async () => {
  const { first, second } = await twoTabs();
  let release!: (response: Response) => void;
  let calls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    calls++;
    if (calls === 1)
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    return new Response(JSON.stringify("saved"), { status: 200 });
  });
  const delayed = first.flushQueuedWorkoutSaves();
  await vi.waitFor(() => expect(calls).toBe(1));
  await second.flushQueuedWorkoutSaves();
  release(new Response(JSON.stringify({ message: "Temporary failure" }), { status: 503 }));
  await delayed;
  expect(first.queuedWorkoutSaveCount()).toBe(0);
});
