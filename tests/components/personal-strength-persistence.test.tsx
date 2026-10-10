import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: mocks.select,
  supabasePublicRpc: mocks.rpc,
  supabasePublicInsert: vi.fn(),
  supabasePublicUpdate: vi.fn(),
  supabasePublicDelete: vi.fn(),
}));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "00000000-0000-4000-8000-000000000001" }),
}));
vi.mock("@/lib/supabase-library.browser", () => ({
  listLibraryClient: async () => ({
    items: [10, 11].map((n) => ({
      id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      active: true,
      enabled: true,
      availableLocationIds: ["00000000-0000-4000-8000-000000000030"],
    })),
    locations: [{ id: "00000000-0000-4000-8000-000000000030", kind: "gym", name: "Gym" }],
  }),
}));
import { listPersonalProgrammesClient } from "@/lib/supabase-personal-programmes.browser";
import {
  getLatestProgrammeStrengthWeekReviewClient,
  applyPersonalStrengthWeekReviewClient,
} from "@/lib/supabase-programme-strength-review.browser";
import {
  getCurrentProgrammeWorkoutOffersClient,
  getUpcomingProgrammeScheduleClient,
  startProgrammeWorkoutClient,
} from "@/lib/supabase-programmes.browser";
import { buildStrengthProgrammeReview } from "@/lib/strength-programme-review";
import {
  personalStrengthAssignment as assignment,
  personalStrengthTemplate as template,
  personalStrengthRecovery as recovery,
  personalStrengthId as id,
} from "../helpers/personal-strength-fixtures";
const draft = buildStrengthProgrammeReview({ assignment, template, recovery })!;
const snapshots = draft.sessions.map((session) => ({
  workout_id: session.workoutId,
  revision: 1,
  name: session.workoutName,
  scheduled_date: session.scheduledDate,
  base_plan: assignment.personalProgramme!.sessions.find(
    (item) => item.workoutId === session.workoutId,
  )!.plan,
  plan: {
    version: 1,
    locationKind: "gym",
    movements: session.movements.map((item) => item.movement),
  },
}));
const rawReview = {
  id: id(400),
  program_assignment_id: assignment.id,
  programme_week: 1,
  start_workout_index: 0,
  end_workout_index: 2,
  workout_ids: draft.sessions.map((session) => session.workoutId),
  recovery_level: "deload",
  recommendation_kind: "reduce",
  applied_at: "2026-10-12",
  applied_adjustments: [
    { personal_sessions: snapshots },
    ...draft.exercises.map((exercise) => ({
      personal_key: exercise.personalKey,
      programme_key: exercise.programmeKey,
      exercise_id: exercise.exerciseId,
      exercise_name: exercise.exerciseName,
      load_adjustment_percent: exercise.proposedManualAdjustmentPercent,
      set_adjustment: exercise.proposedSetAdjustment,
    })),
  ],
};
const rawPersonal = {
  assignment_id: assignment.id,
  name: assignment.personalProgramme!.name,
  personal_programme_sessions: assignment.personalProgramme!.sessions.map((session) => ({
    program_workout_id: session.workoutId,
    name: session.name,
    scheduled_on: session.scheduledDate,
    plan: session.plan,
    revision: session.revision,
  })),
};
function transport() {
  mocks.select.mockImplementation(async (table: string, query: { status?: string }) => {
    if (table === "personal_programmes") return [rawPersonal];
    if (table === "programme_strength_week_reviews") return [rawReview];
    if (table === "program_assignments")
      return [
        {
          id: assignment.id,
          program_id: assignment.programId,
          person_id: assignment.personId,
          status: "active",
          current_workout_index: 0,
          started_on: "2026-10-12",
          program_assignment_exercises: [],
          program_assignment_exercise_pools: [],
        },
      ];
    if (table === "programs")
      return [
        { id: template.id, name: "Source", method_type: "jacked_dumbbell", sessions_per_week: 3 },
      ];
    if (table === "program_workouts")
      return template.workouts.map((workout, i) => ({
        id: workout.id,
        program_id: template.id,
        sequence_index: [1, 2, 3, 7, 8, 9][i],
        week_number: workout.weekNumber,
        day_number: workout.dayNumber,
        name: workout.name,
      }));
    if (table === "suggested_workouts" && query.status === "eq.completed")
      return snapshots.map((snapshot) => ({
        program_workout_id: snapshot.workout_id,
        suggested_workout_entries: [{ target_metrics: { strength_review_id: rawReview.id } }],
        completed_session: {
          completed: true,
          session_entries: snapshot.plan.movements.map((movement, index) => ({
            exercise_id: movement.exerciseId,
            order_index: index,
            completed: true,
            entry_sets: movement.setRows.map((row, i) => ({
              set_number: i + 1,
              reps: row.reps ? Number(row.reps) : null,
              weight: row.weight ? Number(row.weight) : null,
              duration_seconds: row.durationSeconds ? Number(row.durationSeconds) : null,
              rpe: 7,
              completed: true,
            })),
            entry_metrics: [
              { metric_key: "pain", metric_value: 0, metric_text: null },
              { metric_key: "technique", metric_value: null, metric_text: "good" },
            ],
          })),
        },
      }));
    return [];
  });
}
afterEach(() => vi.resetAllMocks());
it("reloads an approved overlay while retaining the original editable prescriptions", async () => {
  transport();
  const personal = (await listPersonalProgrammesClient()).get(assignment.id)!;
  expect(personal.sessions[0].plan.movements[0].setRows).toHaveLength(3);
  expect(personal.sessions[0].plan.movements[0].setRows[0].weight).toBe("20.6");
  expect(personal.sessions[0].reviewedPlan!.movements[0].setRows).toHaveLength(2);
  expect(personal.sessions[0].reviewedPlan!.movements[0].setRows[0].weight).toBe("19.57");
  expect(personal.sessions[3].reviewedPlan).toBeUndefined();
});
it("Today, Plan and the logger use the approved targets and exact review token", async () => {
  transport();
  mocks.rpc.mockResolvedValue(id(500));
  const [offer] = await getCurrentProgrammeWorkoutOffersClient();
  expect(offer.movements[0].setRows[0].weight).toBe("19.57");
  const schedule = await getUpcomingProgrammeScheduleClient("2026-10-12", "2026-10-25");
  expect(schedule[0].movements[0].setRows[0].weight).toBe("19.57");
  const started = await startProgrammeWorkoutClient(assignment.id, id(30));
  expect(started.movements[0].setRows).toHaveLength(2);
  expect(mocks.rpc).toHaveBeenCalledWith(
    "start_personal_programme_session",
    expect.objectContaining({ p_revision: 1, p_strength_review_id: rawReview.id }),
  );
});
it("reads completed reviewed exposures instead of applying native template lift outcomes", async () => {
  transport();
  const review = await getLatestProgrammeStrengthWeekReviewClient(assignment.id);
  expect(review!.personalSessions).toHaveLength(3);
  expect(review!.outcomes).toHaveLength(6);
  expect(review!.outcomes.every((outcome) => outcome.decision === "progress")).toBe(true);
  expect(mocks.select.mock.calls.some(([table]) => table === "program_workout_reviews")).toBe(
    false,
  );
});
it("submits bounded choices and source revisions rather than an arbitrary replacement plan", async () => {
  mocks.rpc.mockResolvedValue(rawReview.id);
  await applyPersonalStrengthWeekReviewClient(assignment.id, draft, "deload");
  expect(mocks.rpc).toHaveBeenCalledWith(
    "apply_personal_strength_week_review",
    expect.objectContaining({
      p_current_workout_index: 0,
      p_sessions: [
        { workout_id: id(20), revision: 1 },
        { workout_id: id(21), revision: 1 },
        { workout_id: id(22), revision: 1 },
      ],
      p_adjustments: [
        {
          programme_key: "press:0",
          exercise_id: id(10),
          load_adjustment_percent: -5,
          set_adjustment: -1,
        },
        {
          programme_key: "grip:0",
          exercise_id: id(11),
          load_adjustment_percent: 0,
          set_adjustment: -1,
        },
      ],
    }),
  );
});
