import { beforeEach, describe, expect, it, vi } from "vitest";

import { setSupabaseSession } from "@/lib/supabase-public";
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: vi.fn(async () => ({ id: "person-1" })),
}));
import {
  enqueueWorkoutSave,
  flushQueuedWorkoutSaves,
  queuedWorkoutSaveCount,
} from "@/lib/workout-offline-queue";

describe("workout offline queue", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    setSupabaseSession({
      access_token: "access-token",
      refresh_token: "refresh-token",
      user: { id: "person-1" },
    });
  });

  it("keeps a save queued while offline", async () => {
    enqueueWorkoutSave({
      personId: "person-1",
      rpcBody: { p_person_id: "person-1" },
      draftKey: "draft",
    });

    expect(await flushQueuedWorkoutSaves()).toBe(1);
    expect(queuedWorkoutSaveCount()).toBe(1);
  });

  it("replays a queued save and removes its unchanged draft", async () => {
    window.localStorage.setItem("draft", "snapshot");
    enqueueWorkoutSave({
      personId: "person-1",
      rpcBody: { p_person_id: "person-1" },
      draftKey: "draft",
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify("session-1"), { status: 200 }),
    );

    expect(await flushQueuedWorkoutSaves()).toBe(0);
    expect(queuedWorkoutSaveCount()).toBe(0);
    expect(window.localStorage.getItem("draft")).toBeNull();
  });

  it("replays a mobility save with its run link", async () => {
    enqueueWorkoutSave({
      personId: "person-1",
      rpcFunctionName: "save_mobility_workout",
      rpcBody: { p_person_id: "person-1", p_mobility_run_id: "pike-run" },
      draftKey: "draft",
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify("session-1"), { status: 200 }));
    expect(await flushQueuedWorkoutSaves()).toBe(0);
    expect(request.mock.calls[0]?.[0]).toContain("/rpc/save_mobility_workout");
    expect(request.mock.calls[0]?.[1]?.body).toContain("pike-run");
  });

  it("keeps the failed save and later saves in order", async () => {
    enqueueWorkoutSave({
      personId: "person-1",
      rpcBody: { p_person_id: "person-1", order: 1 },
      draftKey: "first",
    });
    enqueueWorkoutSave({
      personId: "person-1",
      rpcBody: { p_person_id: "person-1", order: 2 },
      draftKey: "second",
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network unavailable"));
    expect(await flushQueuedWorkoutSaves()).toBe(2);
    expect(queuedWorkoutSaveCount()).toBe(2);
  });
});
