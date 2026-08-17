import { beforeEach, describe, expect, it, vi } from "vitest";

import { setSupabaseSession } from "@/lib/supabase-public";
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
});
