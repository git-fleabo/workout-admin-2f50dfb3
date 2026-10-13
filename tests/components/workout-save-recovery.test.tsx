import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { addWorkoutSessionClient, type WorkoutSessionInput } from "@/lib/supabase-log.browser";
import { getCurrentPerson } from "@/lib/supabase-people.browser";
import { setSupabaseSession } from "@/lib/supabase-public";
import { flushQueuedWorkoutSaves, pendingWorkoutSaves } from "@/lib/workout-offline-queue";
const input = {
  date: "2026-10-11",
  title: "Yoga",
  completed: true,
  suggestedWorkoutId: "plan",
  mobilityRunId: "mobility",
  entries: [{ exercise: "Yoga", workoutType: "Yoga", duration: "10", pain: "" }],
} as WorkoutSessionInput;
const session = { access_token: "access", refresh_token: "refresh", user: { id: "owner" } };
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function fakeServer(url: RequestInfo | URL) {
  if (String(url).includes("/rpc/")) return reply("saved-session");
  if (String(url).includes("/people"))
    return reply([{ id: "person", auth_user_id: "owner", display_name: "Owner" }]);
  if (String(url).includes("/activity_types"))
    return reply([{ id: "activity", name: "Yoga", slug: "yoga" }]);
  if (String(url).includes("/exercises"))
    return reply([
      {
        id: "exercise",
        name: "Yoga",
        activity_type_id: "activity",
        activity_types: { name: "Yoga" },
      },
    ]);
  return reply([]);
}
beforeEach(async () => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  setSupabaseSession(session);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => fakeServer(url));
  await getCurrentPerson();
});
afterEach(() => vi.restoreAllMocks());
it("finishes offline before any exercise lookup, survives reload and preserves plan/mobility provenance", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  const request = vi.mocked(fetch);
  request.mockClear();
  expect(await addWorkoutSessionClient(input)).toMatchObject({ queued: true });
  expect(request).not.toHaveBeenCalled();
  const retained = pendingWorkoutSaves()[0];
  expect(retained.input).toMatchObject({ suggestedWorkoutId: "plan", mobilityRunId: "mobility" });
  const reloaded = await import("@/lib/workout-offline-queue");
  expect(reloaded.pendingWorkoutSaves()[0].id).toBe(retained.id);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  expect(await flushQueuedWorkoutSaves()).toBe(0);
  const save = request.mock.calls.find(([url]) => String(url).includes("/rpc/save_workout_once"));
  expect(JSON.parse(save?.[1]?.body as string)).toMatchObject({
    p_operation_id: retained.id,
    p_person_id: "person",
    p_suggested_workout_id: "plan",
    p_mobility_run_id: "mobility",
  });
});
it("connection loss during reference preparation retains the raw workout for a later retry", async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
  expect(await addWorkoutSessionClient(input)).toMatchObject({ queued: true });
  expect(pendingWorkoutSaves()[0].input).toEqual(input);
  vi.mocked(fetch).mockImplementation(async (url) => fakeServer(url));
  expect(await flushQueuedWorkoutSaves()).toBe(0);
});
it("retains an offline KB summary and syncs zero sets with its original plan link", async () => {
  const summary = {
    ...input,
    mobilityRunId: undefined,
    title: "KB summary",
    duration: "18",
    notes: "Weight used: 2 × 16 kg",
    kettlebellSummary: { weightUsed: "2 × 16 kg", result: "4", resultLabel: "Rounds completed" },
    entries: [
      {
        exercise: "KB summary",
        workoutType: "Strength",
        setRows: [],
        reps: "",
        sets: "",
        weight: "",
        pain: "",
        notes: "Prescribed workout (reference only)",
      },
    ],
  } as WorkoutSessionInput;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  expect(await addWorkoutSessionClient(summary)).toMatchObject({ queued: true });
  expect(pendingWorkoutSaves()[0].input?.kettlebellSummary).toEqual(summary.kettlebellSummary);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  expect(await flushQueuedWorkoutSaves()).toBe(0);
  const save = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => String(url).includes("/rpc/save_workout_once"));
  const body = JSON.parse(save![1]!.body as string);
  expect(body.p_suggested_workout_id).toBe("plan");
  expect(body.p_entries[0].sets).toEqual([]);
  expect(body.p_entries[0].metrics).toContainEqual({
    metric_key: "weight_used",
    metric_text: "2 × 16 kg",
  });
});
it("a committed save with a lost response retries exactly the same operation and validated payload", async () => {
  const savedBodies: string[] = [];
  vi.mocked(fetch).mockImplementation(async (url, init) => {
    if (String(url).includes("/rpc/")) {
      savedBodies.push(init?.body as string);
      if (savedBodies.length === 1) throw new TypeError("Failed to fetch");
    }
    return fakeServer(url);
  });
  expect(await addWorkoutSessionClient(input)).toMatchObject({ queued: true });
  expect(pendingWorkoutSaves()).toHaveLength(1);
  expect(await flushQueuedWorkoutSaves()).toBe(0);
  expect(savedBodies).toHaveLength(2);
  expect(savedBodies[0]).toBe(savedBodies[1]);
});
it("an unreadable response is also uncertain and keeps the operation for retry", async () => {
  vi.mocked(fetch).mockImplementation(async (url) =>
    String(url).includes("/rpc/")
      ? new Response("broken response", { status: 200 })
      : fakeServer(url),
  );
  expect(await addWorkoutSessionClient(input)).toMatchObject({ queued: true });
  expect(pendingWorkoutSaves()).toHaveLength(1);
});
it("a definite validation rejection keeps the editable draft and removes only that failed operation", async () => {
  window.localStorage.setItem("workout-session-draft:owner", "draft");
  vi.mocked(fetch).mockImplementation(async (url) =>
    String(url).includes("/rpc/") ? reply({ message: "Invalid workout" }, 400) : fakeServer(url),
  );
  await expect(addWorkoutSessionClient(input)).rejects.toThrow("Invalid workout");
  expect(pendingWorkoutSaves()).toHaveLength(0);
  expect(window.localStorage.getItem("workout-session-draft:owner")).toBe("draft");
});
