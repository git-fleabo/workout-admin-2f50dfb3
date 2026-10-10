import test from "node:test";
import assert from "node:assert/strict";
import { buildBaseStrengthPersonalSessions } from "../src/lib/base-strength-personal.ts";
import {
  DEFAULT_VOLUME_INTENSITY_OPTIONS,
  buildBaseStrengthWeeks,
  type BaseStrengthProgrammeId,
} from "../src/lib/base-strength-preview.ts";
import { personalPlanSchema } from "../src/lib/personal-programme.ts";
import { strengthId, strengthChoices, strengthTemplate } from "./helpers/base-strength-fixtures.ts";

const build = (programme: BaseStrengthProgrammeId, choices = strengthChoices(programme)) =>
  buildBaseStrengthPersonalSessions({
    programme,
    options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
    template: strengthTemplate(programme),
    choices,
    startedOn: "2026-10-12",
    increment: 2.5,
    locationKind: "gym",
  });

test("personal source versions preserve waves, stable identities, own variation maxes and pending plus loads", () => {
  const sessions = build("bullmastiff");
  assert.equal(sessions.length, 72);
  assert.equal(sessions[0].scheduledDate, "2026-10-12");
  assert.equal(sessions[1].scheduledDate, "2026-10-13");
  assert.equal(sessions[4].scheduledDate, "2026-10-19");
  assert.equal(sessions[0].plan.movements[0].setRows[0].weight, "70");
  assert.equal(sessions[0].plan.movements[1].setRows[0].weight, "30");
  assert.equal(sessions[4].plan.movements[0].setRows[0].weight, "");
  assert.equal(
    sessions[4].plan.movements[0].programmeKey,
    sessions[0].plan.movements[0].programmeKey,
  );
  assert.equal(sessions[4].plan.movements[0].baseStrength?.week, 2);
  assert.equal(sessions[36].plan.movements[0].baseStrength?.referenceMax, null);
  assert.equal(sessions[36].plan.movements[0].setRows[0].weight, "");
  assert.equal(sessions[24].plan.movements[2].setRows.length, 3);
  assert.equal(sessions[24].plan.movements[2].setRows[0].reps, "8");
  assert.equal(sessions[0].plan.movements[2].setRows[0].reps, "10");
  assert.deepEqual(personalPlanSchema.parse(sessions[0].plan), sessions[0].plan);
});
test("Volume/Intensity uses calendar prescriptions and leaves phase/RPE loads for review", () => {
  const sessions = build("volume_intensity");
  assert.equal(sessions.length, 54);
  assert.equal(sessions[0].plan.movements[0].setRows.length, 3);
  assert.equal(sessions[0].plan.movements[0].setRows[0].weight, "55");
  assert.equal(sessions[0].plan.movements[1].setRows[0].reps, "");
  assert.equal(sessions[0].plan.movements[1].baseStrength?.plusLastSet, true);
  assert.equal(sessions[27].plan.movements[1].setRows[0].rpe, "7");
  assert.equal(sessions[27].plan.movements[1].setRows[0].weight, "");
  assert.equal(sessions[0].plan.movements[2].setRows[0].reps, "8");
});
test("setup rejects missing mappings, open personal accessory choices and invalid maxes or scaffold", () => {
  const choices = strengthChoices("bullmastiff");
  choices["main:squat"].exerciseId = "";
  assert.throws(() => build("bullmastiff", choices), /Choose an exercise/);
  choices["main:squat"].exerciseId = strengthId(10);
  choices["main:squat"].referenceMax = {};
  assert.throws(() => build("bullmastiff", choices), /base-phase estimated max/);
  const vi = strengthChoices("volume_intensity");
  vi["accessory:Row:2"].sets = null;
  assert.throws(() => build("volume_intensity", vi), /sets and reps/);
  const wrong = strengthTemplate("bullmastiff");
  wrong.workouts.pop();
  assert.throws(
    () =>
      buildBaseStrengthPersonalSessions({
        programme: "bullmastiff",
        options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
        template: wrong,
        choices: strengthChoices("bullmastiff"),
        startedOn: "2026-10-12",
        increment: 2.5,
        locationKind: "gym",
      }),
    /unavailable/,
  );
  const invalid = strengthChoices("bullmastiff");
  invalid["main:squat"].referenceMax.base = Infinity;
  assert.throws(() => build("bullmastiff", invalid));
  assert.equal(
    buildBaseStrengthWeeks("volume_intensity", {
      initialWaves: 3,
      buildWaves: 3,
      peakWaves: 4,
      waveIncreasePercent: 2,
    }).length,
    30,
  );
});

test("generic strength-week coaching leaves Base Strength source waves to their own review", async () => {
  const { buildPersonalStrengthProgrammeReview } =
    await import("../src/lib/personal-strength-review.ts");
  const { personalStrengthAssignment, personalStrengthTemplate, personalStrengthRecovery } =
    await import("./helpers/personal-strength-fixtures.ts");
  const assignment = structuredClone(personalStrengthAssignment);
  assignment.personalProgramme!.sessions[0].plan.baseStrength = "bullmastiff";
  assert.equal(
    buildPersonalStrengthProgrammeReview({
      assignment,
      template: personalStrengthTemplate,
      recovery: personalStrengthRecovery,
    }),
    null,
  );
});
