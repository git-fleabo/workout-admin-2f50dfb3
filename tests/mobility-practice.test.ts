import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMobilityWorkoutDraft,
  currentMobilityRun,
  isToolkitLessonUrl,
  mobilityNextAction,
  type MobilityDrill,
  type MobilityRun,
} from "../src/lib/mobility-practice.ts";

const run = (skill: MobilityRun["skill"]): MobilityRun => ({
  id: `${skill}-run`,
  personId: "person",
  skill,
  status: "active",
  phase: "setup",
  startedOn: "2026-09-30",
  endedOn: null,
  reviewOn: null,
  readiness: skill === "bridge" ? "ready" : "unchecked",
  readinessCheckedOn: null,
  readinessLeftDeg: null,
  readinessRightDeg: null,
  planReceived: true,
  notes: "",
});

test("Pike and Bridge choose current runs independently", () => {
  const oldPike = { ...run("pike"), id: "old", status: "archived" as const };
  assert.equal(currentMobilityRun([oldPike, run("bridge"), run("pike")], "pike")?.id, "pike-run");
  assert.equal(currentMobilityRun([oldPike, run("bridge")], "bridge")?.id, "bridge-run");
});

test("Bridge readiness holds its action while Pike can log", () => {
  const bridge = { ...run("bridge"), readiness: "shoulders_first" as const };
  assert.equal(
    mobilityNextAction({
      run: bridge,
      assessmentCount: 5,
      activeDrillCount: 3,
      today: "2026-09-30",
    }).kind,
    "readiness",
  );
  assert.equal(
    mobilityNextAction({
      run: run("pike"),
      assessmentCount: 5,
      activeDrillCount: 3,
      today: "2026-09-30",
    }).kind,
    "log",
  );
});

test("a drill awaiting an exercise match stays in setup", () => {
  assert.equal(
    mobilityNextAction({
      run: run("pike"),
      assessmentCount: 5,
      activeDrillCount: 1,
      mappedDrillCount: 0,
      today: "2026-09-30",
    }).label,
    "Match drills to library exercises",
  );
});

test("practice draft carries only the selected skill run and personal targets", () => {
  const drill: MobilityDrill = {
    id: "drill",
    runId: "pike-run",
    exerciseId: "exercise",
    name: "Chosen drill",
    lessonUrl: "",
    sortOrder: 0,
    targetSets: 2,
    targetReps: "8",
    targetWeightKg: 5,
    targetHoldSeconds: null,
    targetDetail: "Own plan",
    isActive: true,
  };
  const draft = buildMobilityWorkoutDraft({
    run: run("pike"),
    drills: [drill],
    library: [{ id: "exercise", name: "Pike", workoutType: "Mobility", metric: "Distance" }],
    locationKind: "home",
  });
  assert.equal(draft.mobilityRunId, "pike-run");
  assert.equal(draft.movements.length, 1);
  assert.equal(draft.movements[0]?.setRows.length, 2);
  assert.equal(draft.movements[0]?.setRows[0]?.weight, "5");
});

test("lesson references must stay on the toolkit", () => {
  assert.equal(
    isToolkitLessonUrl(
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/123/posts/456",
    ),
    true,
  );
  assert.equal(
    isToolkitLessonUrl(
      "https://www.matthewismith.com.evil.test/products/mobility-flexibility-toolkit/",
    ),
    false,
  );
  assert.equal(isToolkitLessonUrl("javascript:alert(1)"), false);
  assert.equal(
    isToolkitLessonUrl(
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/posts/123?token=secret",
    ),
    false,
  );
});
