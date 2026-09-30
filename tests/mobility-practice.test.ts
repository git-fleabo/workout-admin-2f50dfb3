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

test("Bridge readiness holds its action while self-directed drills can be logged", () => {
  const bridge = { ...run("bridge"), readiness: "shoulders_first" as const };
  assert.equal(
    mobilityNextAction({
      run: bridge,
      activeDrillCount: 3,
    }).kind,
    "readiness",
  );
  for (const skill of ["pike", "pancake", "side_split", "front_split", "shoulder"] as const) {
    assert.equal(
      mobilityNextAction({
        run: { ...run(skill), planReceived: false },
        activeDrillCount: 1,
        mappedDrillCount: 1,
      }).kind,
      "log",
    );
  }
  assert.equal(
    mobilityNextAction({ run: run("pike"), activeDrillCount: 0 }).label,
    "Add your drills",
  );
});

test("a drill awaiting an exercise match stays in setup", () => {
  assert.equal(
    mobilityNextAction({
      run: run("pike"),
      activeDrillCount: 1,
      mappedDrillCount: 0,
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
    library: [
      {
        id: "exercise",
        name: "Pike",
        workoutType: "Mobility",
        metric: "Distance",
        toolkitSections: ["pike"],
      },
    ],
    locationKind: "home",
  });
  assert.equal(draft.mobilityRunId, "pike-run");
  assert.equal(draft.movements.length, 1);
  assert.equal(draft.movements[0]?.setRows.length, 2);
  assert.equal(draft.movements[0]?.setRows[0]?.weight, "5");
});

test("practice draft rejects a library exercise outside its toolkit skill", () => {
  const drill: MobilityDrill = {
    id: "drill",
    runId: "pike-run",
    exerciseId: "exercise",
    name: "Other exercise",
    lessonUrl: "",
    sortOrder: 0,
    targetSets: 1,
    targetReps: "",
    targetWeightKg: null,
    targetHoldSeconds: null,
    targetDetail: "",
    isActive: true,
  };
  assert.throws(
    () =>
      buildMobilityWorkoutDraft({
        run: run("pike"),
        drills: [drill],
        library: [
          {
            id: "exercise",
            name: "Bridge Rocks",
            workoutType: "Mobility/Flexibility",
            metric: "reps_only",
            toolkitSections: ["bridge"],
          },
        ],
        locationKind: "home",
      }),
    /pike toolkit exercise/,
  );
});

test("a shared toolkit exercise can be used in either tagged skill", () => {
  const drill: MobilityDrill = {
    id: "shared-drill",
    runId: "side_split-run",
    exerciseId: "shared-exercise",
    name: "Adductor Flyes",
    lessonUrl: "",
    sortOrder: 0,
    targetSets: 1,
    targetReps: "8",
    targetWeightKg: null,
    targetHoldSeconds: null,
    targetDetail: "",
    isActive: true,
  };
  const draft = buildMobilityWorkoutDraft({
    run: run("side_split"),
    drills: [drill],
    library: [
      {
        id: "shared-exercise",
        name: "Adductor Flyes",
        workoutType: "Mobility/Flexibility",
        metric: "reps_only",
        toolkitSections: ["pancake", "side_split"],
      },
    ],
    locationKind: "gym",
  });
  assert.equal(draft.mobilityRunId, "side_split-run");
  assert.equal(draft.movements[0]?.exercise, "Adductor Flyes");
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
