import { afterEach, expect, it, vi } from "vitest";
import { buildBaseStrengthPersonalSessions } from "@/lib/base-strength-personal";
import { DEFAULT_VOLUME_INTENSITY_OPTIONS } from "@/lib/base-strength-preview";
import { strengthChoices, strengthTemplate } from "../helpers/base-strength-fixtures";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  rpc: vi.fn(),
  personal: vi.fn(),
  library: vi.fn(),
}));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: mocks.select,
  supabasePublicRpc: mocks.rpc,
  supabasePublicInsert: vi.fn(),
  supabasePublicUpdate: vi.fn(),
  supabasePublicDelete: vi.fn(),
}));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
}));
vi.mock("@/lib/supabase-personal-programmes.browser", () => ({
  listPersonalProgrammesClient: mocks.personal,
}));
vi.mock("@/lib/supabase-library.browser", () => ({ listLibraryClient: mocks.library }));
import {
  getCurrentProgrammeWorkoutOffersClient,
  getUpcomingProgrammeScheduleClient,
  startProgrammeWorkoutClient,
} from "@/lib/supabase-programmes.browser";
afterEach(() => vi.resetAllMocks());
it.each(["volume_intensity", "bullmastiff", "dup"] as const)(
  "offers and starts the saved %s session without a generic method generator",
  async (programme) => {
    const template = strengthTemplate(programme, programme === "dup" ? 6 : 18);
    const sessions = buildBaseStrengthPersonalSessions({
      programme,
      template,
      choices: strengthChoices(programme),
      options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
      startedOn: "2026-10-12",
      increment: 2.5,
      locationKind: "gym",
    });
    const next = {
      ...sessions[3],
      revision: 4,
      reviewedPlan: { ...sessions[3].plan, movements: sessions[3].plan.movements.slice(0, 1) },
      strengthReviewId: "review",
    };
    mocks.personal.mockResolvedValue(
      new Map([
        [
          "assignment",
          { name: "My saved programme", sessions: sessions.map((s, i) => (i === 3 ? next : s)) },
        ],
      ]),
    );
    let shiftedDate: string | null = null;
    mocks.select.mockImplementation(async (table: string, params?: { offset?: number }) => {
      if (table === "programme_session_dates" && shiftedDate && !params?.offset)
        return [
          {
            assignment_id: "assignment",
            program_workout_id: next.workoutId,
            scheduled_on: shiftedDate,
            revision: 2,
          },
        ];
      if (table === "programs")
        return [{ id: template.id, name: template.name, method_type: template.methodType }];
      if (table === "program_workouts")
        return template.workouts.map((w) => ({
          id: w.id,
          program_id: template.id,
          name: w.name,
          sequence_index: w.sequenceIndex + 1,
          week_number: w.weekNumber,
          session_number: w.sessionNumber,
        }));
      if (table === "program_assignments")
        return [
          {
            id: "assignment",
            person_id: "person",
            program_id: template.id,
            status: "active",
            current_workout_index: 3,
          },
        ];
      return [];
    });
    mocks.library.mockResolvedValue({
      locations: [{ id: "gym", name: "Gym", kind: "gym" }],
      items: next.plan.movements.map((m) => ({
        id: m.exerciseId,
        active: true,
        enabled: true,
        availableLocationIds: ["gym"],
      })),
    });
    mocks.rpc.mockResolvedValue("saved-plan");
    const [offer] = await getCurrentProgrammeWorkoutOffersClient();
    expect(offer).toMatchObject({
      assignmentId: "assignment",
      methodType: "personal_programme",
      programWorkoutId: next.workoutId,
      workoutNumber: 4,
      scheduledDate: next.scheduledDate,
    });
    expect(offer.movements).toEqual(next.reviewedPlan.movements);
    shiftedDate = "2026-11-01";
    const [moved] = await getCurrentProgrammeWorkoutOffersClient();
    expect(moved.scheduledDate).toBe(shiftedDate);
    expect(moved.movements).toEqual(next.reviewedPlan.movements);
    expect(moved.personalSession?.revision).toBe(4);
    expect(moved.personalSession?.scheduledDate).toBe(next.scheduledDate);
    const calendar = await getUpcomingProgrammeScheduleClient(shiftedDate, shiftedDate);
    expect(
      calendar.find((session) => session.programWorkoutId === next.workoutId)?.scheduledDate,
    ).toBe(shiftedDate);
    const started = await startProgrammeWorkoutClient("assignment", "gym", {}, false);
    expect(started.movements).toEqual(next.reviewedPlan.movements);
    expect(mocks.rpc).toHaveBeenCalledWith("start_personal_programme_session", {
      p_assignment_id: "assignment",
      p_workout_id: next.workoutId,
      p_revision: 4,
      p_location_id: "gym",
      p_easier: false,
      p_strength_review_id: "review",
    });
    // A fresh offer must prevent both start paths from reaching the RPC when a
    // saved target is missing, even if Today previously showed a ready version.
    next.plan.movements[0].setRows[0].weight = "";
    mocks.rpc.mockClear();
    await expect(startProgrammeWorkoutClient("assignment", "gym", {}, false)).rejects.toThrow(
      "choose a load for every set",
    );
    await expect(startProgrammeWorkoutClient("assignment", "gym", {}, true)).rejects.toThrow(
      "choose a load for every set",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.select.mockImplementation(async (table) => {
      if (table === "suggested_workouts")
        return [{ program_assignment_id: "assignment", program_workout_id: next.workoutId }];
      if (table === "programs")
        return [{ id: template.id, name: template.name, method_type: template.methodType }];
      if (table === "program_workouts")
        return template.workouts.map((w) => ({
          id: w.id,
          program_id: template.id,
          sequence_index: w.sequenceIndex,
        }));
      if (table === "program_assignments")
        return [
          {
            id: "assignment",
            person_id: "person",
            program_id: template.id,
            status: "active",
            current_workout_index: 3,
          },
        ];
      return [];
    });
    expect(await getCurrentProgrammeWorkoutOffersClient()).toEqual([]);
  },
);
