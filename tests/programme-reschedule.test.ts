import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProgrammeReschedulePreview,
  programmeSessionScheduledDate,
  programmeRescheduleClashes,
  reverseProgrammeReschedule,
} from "../src/lib/programme-reschedule.ts";
import {
  personalStrengthAssignment,
  personalStrengthTemplate,
} from "./helpers/personal-strength-fixtures.ts";

const setup = () => ({
  assignment: structuredClone(personalStrengthAssignment),
  template: structuredClone(personalStrengthTemplate),
  lockedWorkoutIds: [] as string[],
  newDate: "2026-10-14",
  today: "2026-10-14",
});

test("a date-only preview retains exact spacing, prescriptions and source numbering", () => {
  const input = setup();
  input.assignment.currentWorkoutIndex = 1;
  input.newDate = "2026-10-16";
  const baseline = JSON.stringify(input.assignment);
  const preview = buildProgrammeReschedulePreview(input);
  assert.equal(preview.anchorWorkoutId, input.template.workouts[1].id);
  assert.equal(preview.sessions.length, input.template.workouts.length - 1);
  assert.equal(preview.sessions[0].newDate, input.newDate);
  for (const session of preview.sessions)
    assert.equal(Date.parse(session.newDate!) - Date.parse(session.date!), preview.days * 86400000);
  assert.equal(JSON.stringify(input.assignment), baseline);
});

test("native and personal dates use the same override with source dates retained", () => {
  const input = setup();
  const workout = input.template.workouts[0];
  const base = programmeSessionScheduledDate(input.assignment, workout);
  input.assignment.scheduleOverrides = { [workout.id]: { date: "2026-10-15", revision: 2 } };
  assert.equal(programmeSessionScheduledDate(input.assignment, workout), "2026-10-15");
  assert.notEqual(input.assignment.personalProgramme!.sessions[0].scheduledDate, "2026-10-15");
  input.assignment.personalProgramme = undefined;
  assert.equal(programmeSessionScheduledDate(input.assignment, workout), "2026-10-15");
  input.assignment.scheduleOverrides = undefined;
  assert.equal(programmeSessionScheduledDate(input.assignment, workout), base);
});

test("invalid dates, started anchors and shifts that cross a fixed session cannot become previews", () => {
  for (const newDate of ["2026-02-30", "2026-10-13", "", "2026-13-01"])
    assert.throws(() => buildProgrammeReschedulePreview({ ...setup(), newDate }));
  const input = setup();
  assert.throws(
    () =>
      buildProgrammeReschedulePreview({
        ...input,
        lockedWorkoutIds: [input.template.workouts[0].id],
      }),
    /already started/,
  );
  assert.throws(
    () =>
      buildProgrammeReschedulePreview({
        ...input,
        newDate: "2026-11-20",
        lockedWorkoutIds: [input.template.workouts[1].id],
      }),
    /session order/,
  );
});

test("clashes refer to exact proposed dates and Undo expects the revisions written by Apply", () => {
  const preview = buildProgrammeReschedulePreview(setup());
  const clashes = programmeRescheduleClashes(preview, [
    { id: "yoga", date: preview.sessions[0].newDate!, title: "Yoga" },
    { id: "other", date: "2027-01-01", title: "Different day" },
  ]);
  assert.deepEqual(
    clashes.map((clash) => clash.id),
    ["yoga"],
  );
  const undo = reverseProgrammeReschedule(preview);
  assert.equal(undo.days, -preview.days);
  assert.equal(undo.newDate, preview.sessions[0].date);
  assert.equal(undo.sessions[0].date, preview.sessions[0].newDate);
  assert.equal(undo.sessions[0].newDate, preview.sessions[0].date);
  assert.equal(undo.sessions[0].scheduleRevision, preview.sessions[0].scheduleRevision + 1);
});
