import { beforeEach, describe, expect, it, vi } from "vitest";

import { setSupabaseSession } from "@/lib/supabase-public";
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: vi.fn(async () => ({ id: "person-1" })),
}));
import {
  enqueueWorkoutSave,
  flushQueuedWorkoutSaves,
  queuedWorkoutSaveCount,
  pendingWorkoutSaves,
  hasLegacyWorkoutSaves,
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
      rpcBody: { p_person_id: "person-1", p_mobility_run_id: "pike-run" },
      draftKey: "draft",
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify("session-1"), { status: 200 }));
    expect(await flushQueuedWorkoutSaves()).toBe(0);
    expect(request.mock.calls[0]?.[0]).toContain("/rpc/save_workout_once");
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
  it("overlapping flushes share one request and do not lose a save enqueued in flight", async () => {
    enqueueWorkoutSave({
      personId: "person-1",
      rpcBody: { p_person_id: "person-1", order: 1 },
      draftKey: "first",
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    let release!: (response: Response) => void;
    const request = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const first = flushQueuedWorkoutSaves();
    const overlap = flushQueuedWorkoutSaves();
    expect(first).toBe(overlap);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    enqueueWorkoutSave({
      personId: "person-1",
      rpcBody: { p_person_id: "person-1", order: 2 },
      draftKey: "second",
    });
    release(new Response(JSON.stringify("session-1"), { status: 200 }));
    expect(await first).toBe(1);
    expect(await overlap).toBe(1);
    expect(pendingWorkoutSaves()[0].rpcBody).toMatchObject({ order: 2 });
  });
  it("identical finish attempts keep a stable operation ID and never clear a newer draft", async () => {
    window.localStorage.setItem("draft", "first snapshot");
    const data = { personId: "person-1", rpcBody: { p_person_id: "person-1" }, draftKey: "draft" };
    const first = enqueueWorkoutSave(data);
    const second = enqueueWorkoutSave(data);
    expect(first.id).toBe(second.id);
    expect(queuedWorkoutSaveCount()).toBe(1);
    window.localStorage.setItem("draft", "newer work");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify("saved"), { status: 200 }));
    await flushQueuedWorkoutSaves();
    expect(JSON.parse(request.mock.calls[0][1]?.body as string).p_operation_id).toBe(first.id);
    expect(window.localStorage.getItem("draft")).toBe("newer work");
  });
  it("keeps saves scoped to their original account", async () => {
    enqueueWorkoutSave({
      personId: "person-1",
      rpcBody: { p_person_id: "person-1" },
      draftKey: "draft",
    });
    setSupabaseSession({ access_token: "other", refresh_token: "other", user: { id: "other" } });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const request = vi.spyOn(globalThis, "fetch");
    expect(await flushQueuedWorkoutSaves()).toBe(0);
    expect(request).not.toHaveBeenCalled();
    setSupabaseSession({
      access_token: "access",
      refresh_token: "refresh",
      user: { id: "person-1" },
    });
    expect(queuedWorkoutSaveCount()).toBe(1);
  });
  it("does not auto-replay older unkeyed saves that may already have committed", async () => {
    window.localStorage.setItem(
      "workout-save-queue",
      JSON.stringify([{ id: "old", personId: "person-1", rpcBody: { p_person_id: "person-1" } }]),
    );
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const request = vi.spyOn(globalThis, "fetch");
    expect(hasLegacyWorkoutSaves()).toBe(true);
    expect(await flushQueuedWorkoutSaves()).toBe(0);
    expect(request).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("workout-save-queue")).not.toBeNull();
  });
  it("reports storage failure before issuing a save and retains the draft", () => {
    window.localStorage.setItem("draft", "retained");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    expect(() =>
      enqueueWorkoutSave({
        personId: "person-1",
        rpcBody: { p_person_id: "person-1" },
        draftKey: "draft",
      }),
    ).toThrow("could not retain");
    expect(window.localStorage.getItem("draft")).toBe("retained");
  });
});
