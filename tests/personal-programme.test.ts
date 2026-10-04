import assert from "node:assert/strict";
import test from "node:test";
import {
  personalPlanSchema,
  personalPlanFromTemplate,
  propagateProgrammeChanges,
  type PersonalProgrammeSession,
} from "../src/lib/personal-programme.ts";
import { FIXED_PROGRESSION, programmeProgressDecision } from "../src/lib/programme-progression.ts";
import type {
  ProgrammeTemplate,
  ProgrammeAssignmentInput,
} from "../src/lib/supabase-programmes.browser.ts";
import type { ExerciseSessionPoint, ExerciseSetPoint } from "../src/lib/training-types.ts";

const exerciseId = "11111111-1111-4111-8111-111111111111";
function session(name: string, weight: string): PersonalProgrammeSession {
  return {
    workoutId: exerciseId,
    revision: 1,
    name,
    scheduledDate: "2026-10-05",
    plan: {
      version: 1,
      locationKind: "gym",
      movements: [
        {
          exerciseId,
          programmeKey: "press:0",
          exercise: "Press",
          workoutType: "Strength",
          trackingMode: "weight_reps",
          targets: {
            durationMinutes: "",
            distance: "",
            distanceUnit: "",
            rounds: "",
            height: "",
            detail: "",
          },
          reason: "",
          sourceDate: "",
          restTime: "2 min",
          progression: { ...FIXED_PROGRESSION },
          setRows: Array.from({ length: 3 }, () => ({
            reps: "8",
            weight,
            durationSeconds: "",
            rpe: "",
            completed: true,
          })),
        },
      ],
    },
  };
}
function point(reps: number[], efforts: Array<number | null>): ExerciseSessionPoint {
  return {
    sessionId: exerciseId,
    methods: [],
    sets: reps.map(
      (rep, i) =>
        ({
          reps: rep,
          rpe: efforts[i],
          weight: 20,
          completed: true,
          aggregateSets: null,
          dataShape: "individual",
          loadSemantics: "total_external_load",
        }) as ExerciseSetPoint,
    ),
  } as ExerciseSessionPoint;
}

test("session edits round-trip with date, rest and exercise progression", () => {
  const plan = session("A", "20");
  plan.plan.movements[0].progression = { ...FIXED_PROGRESSION, type: "double", incrementKg: 0.5 };
  assert.deepEqual(personalPlanSchema.parse(JSON.parse(JSON.stringify(plan.plan))), plan.plan);
  assert.equal(personalPlanSchema.safeParse({ ...plan.plan, movements: [] }).success, false);
  const invalid = structuredClone(plan.plan);
  invalid.movements[0].setRows[0].weight = "Infinity";
  assert.equal(personalPlanSchema.safeParse(invalid).success, false);
});

test("propagation copies only changed matching slots, preserving other targets and dates", () => {
  const before = session("A", "20");
  const after = structuredClone(before);
  after.name = "New A";
  after.scheduledDate = "2026-10-10";
  after.plan.movements[0].setRows[0].weight = "22";
  const later = session("B", "25");
  later.scheduledDate = "2026-10-12";
  const unrelated = session("C", "30");
  unrelated.plan.movements[0].programmeKey = "squat:0";
  const updates = propagateProgrammeChanges(before, after, [later, unrelated]);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].name, "B");
  assert.equal(updates[0].scheduledDate, "2026-10-12");
  assert.equal(updates[0].plan.movements[0].setRows[0].weight, "22");
  assert.equal(later.plan.movements[0].setRows[0].weight, "25");
});

test("a date-only change never overwrites periodised later loads", () => {
  const before = session("A", "20");
  const after = { ...before, scheduledDate: "2026-10-11" };
  assert.deepEqual(propagateProgrammeChanges(before, after, [session("B", "25")]), []);
});

test("programme-specific rep progression uses its range and complete effort evidence", () => {
  const rule = {
    ...FIXED_PROGRESSION,
    type: "double" as const,
    minReps: 8,
    maxReps: 12,
    incrementKg: 0.5,
  };
  assert.equal(
    programmeProgressDecision({ rule, plannedSets: 3, point: point([8, 8, 8], [7, 7, 7]) }).kind,
    "continue",
  );
  assert.equal(
    programmeProgressDecision({ rule, plannedSets: 3, point: point([12, 12, 12], [8, 8, 8]) }).kind,
    "progress",
  );
  assert.equal(
    programmeProgressDecision({ rule, plannedSets: 3, point: point([12, 12, 12], [8, null, 8]) })
      .kind,
    "hold",
  );
  assert.equal(
    programmeProgressDecision({ rule, plannedSets: 3, point: point([12, 12], [7, 7]) }).kind,
    "continue",
  );
  assert.equal(programmeProgressDecision({ rule, plannedSets: 3 }).kind, "baseline");
});

test("fixed targets and source rules never inherit the generic five-rep load increase", () => {
  for (const type of ["fixed", "source"] as const) {
    const decision = programmeProgressDecision({
      rule: { ...FIXED_PROGRESSION, type },
      plannedSets: 3,
      point: point([12, 12, 12], [7, 7, 7]),
    });
    assert.equal(decision.kind, "continue");
    assert.doesNotMatch(decision.detail, /reset.*3|2.5 kg/);
  }
});

function template(methodType: string): ProgrammeTemplate {
  return {
    id: exerciseId,
    name: "Starting block",
    description: null,
    methodType,
    durationWeeks: 2,
    sessionsPerWeek: 2,
    defaultSetChoice: "minimum",
    percentBase: "training_max",
    roundingIncrement: 2.5,
    workouts: [75, 85].map((intensity, index) => ({
      id: `11111111-1111-4111-8111-${String(index + 2).padStart(12, "0")}`,
      name: `Session ${index + 1}`,
      sequenceIndex: index,
      weekNumber: index + 1,
      dayNumber: 1,
      sessionNumber: 1,
      description: null,
      entries: [
        {
          id: exerciseId,
          exerciseId: methodType === "jacked_dumbbell" ? exerciseId : null,
          name: "Press",
          slotKey: "press",
          orderIndex: 0,
          sets: null,
          reps: null,
          minSets: 3,
          maxSets: 3,
          minReps: 5,
          maxReps: 5,
          intensityPercent: intensity,
          intensityMinPercent: intensity,
          intensityMaxPercent: intensity,
          percentBase: "training_max",
          roundingIncrement: 2.5,
          isOptional: false,
          weight: null,
          duration: null,
          rpe: null,
          rpeCap: 8,
          selectionRole: null,
          rest: "3 min",
          notes: "Controlled reps",
        },
      ],
    })),
  };
}
const templateInput: ProgrammeAssignmentInput = {
  programId: exerciseId,
  personId: exerciseId,
  status: "paused",
  startedOn: "2026-10-05",
  notes: "",
  exercises: [
    { slotKey: "press", exerciseId, exerciseName: "Press", trainingMax: 100, focusArea: "Push" },
  ],
};
test("template copies preserve periodised sessions and create complete serialisable prescriptions", () => {
  const source = template("percentage_strength");
  const before = JSON.stringify(source);
  const copied = personalPlanFromTemplate(source, templateInput);
  assert.equal(copied.length, 2);
  assert.equal(copied[0].plan.movements[0].setRows[0].weight, "75");
  assert.equal(copied[1].plan.movements[0].setRows[0].weight, "85");
  assert.equal(copied[0].plan.movements[0].setRows[0].durationSeconds, "");
  assert.equal(copied[0].plan.movements[0].restTime, "3 min");
  assert.equal(copied[1].scheduledDate, "2026-10-12");
  assert.equal(copied[0].plan.movements[0].progression.type, "fixed");
  assert.equal(JSON.stringify(source), before);
});
test("a JACKED copy keeps the source path without inventing load or rep targets", () => {
  const copied = personalPlanFromTemplate(template("jacked_dumbbell"), {
    ...templateInput,
    exercises: [],
  });
  assert.equal(copied[0].plan.movements[0].progression.type, "source");
  assert.equal(copied[0].plan.movements[0].setRows[0].weight, "");
  assert.equal(copied[0].plan.movements[0].setRows[0].reps, "");
});
test("rep progression with mixed loads, methods or unfinished sets does not recommend an increase", () => {
  const rule = { ...FIXED_PROGRESSION, type: "double" as const };
  const mixed = point([12, 12, 12], [7, 7, 7]);
  mixed.sets[1].weight = 25;
  assert.notEqual(
    programmeProgressDecision({ rule, point: mixed, plannedSets: 3 }).kind,
    "progress",
  );
  const unfinished = point([12, 12, 12], [7, 7, 7]);
  unfinished.sets[1].completed = false;
  assert.notEqual(
    programmeProgressDecision({ rule, point: unfinished, plannedSets: 3 }).kind,
    "progress",
  );
  const methods = point([12, 12, 12], [7, 7, 7]);
  methods.methods = [
    { key: "test", trainingMethodId: exerciseId, name: "Drop sets", family: "set_method" },
  ];
  assert.notEqual(
    programmeProgressDecision({ rule, point: methods, plannedSets: 3 }).kind,
    "progress",
  );
});

test("assistance and ambiguous historical loads cannot trigger a kilogram increase", () => {
  const rule = { ...FIXED_PROGRESSION, type: "double" as const };
  for (const mode of ["assistance", "unknown", "bodyweight_contribution"] as const) {
    const assisted = point([12, 12, 12], [7, 7, 7]);
    assisted.sets.forEach((set) => (set.loadSemantics = mode));
    assert.equal(programmeProgressDecision({ rule, point: assisted, plannedSets: 3 }).kind, "hold");
  }
});
