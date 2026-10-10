import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBaseStrengthWeeks,
  baseStrengthSessions,
  bullmastiffNextLoad,
  roundedPreviewLoad,
  DEFAULT_VOLUME_INTENSITY_OPTIONS,
} from "../src/lib/base-strength-preview.ts";

test("Volume/Intensity repeats waves then resets percentage offsets at each reassessed phase", () => {
  const weeks = buildBaseStrengthWeeks("volume_intensity");
  assert.equal(weeks.length, 18);
  assert.deepEqual(
    [weeks[0].volume?.sets, weeks[0].volume?.reps, weeks[0].volume?.percent],
    [3, 12, 55],
  );
  assert.deepEqual(
    [weeks[5].volume?.sets, weeks[5].volume?.reps, weeks[5].volume?.percent],
    [5, 8, 68],
  );
  assert.deepEqual(
    [weeks[6].phase, weeks[6].volume?.reps, weeks[6].volume?.percent],
    ["build", 10, 60],
  );
  assert.deepEqual(
    [weeks[9].phase, weeks[9].volume?.sets, weeks[9].volume?.reps, weeks[9].volume?.percent],
    ["peak", 5, 5, 75],
  );
  assert.equal(weeks[12].volume?.percent, 78);
  assert.equal(weeks[17].volume?.percent, 91);
  assert.equal(weeks[9].main.percent, null);
  assert.equal(weeks[9].main.rpeTarget, 7);
  assert.deepEqual(
    weeks.slice(9, 12).map((week) => week.main.reps),
    [5, 3, 1],
  );
});

test("Volume/Intensity keeps deadlift intensity-only and overhead press volume-only", () => {
  const [week] = buildBaseStrengthWeeks("volume_intensity");
  const sessions = baseStrengthSessions("volume_intensity", week);
  assert.equal(sessions.length, 3);
  assert.deepEqual(
    sessions.map((session) => session.movements.map((movement) => movement.percent)),
    [
      [55, 65, null],
      [65, 55, null],
      [65, 55, null],
    ],
  );
  assert.deepEqual(
    sessions[1].movements.map((movement) => [movement.reference, movement.plusLastSet]),
    [
      ["deadlift", true],
      ["press", false],
      [null, false],
    ],
  );
  assert.equal(sessions[0].movements[2].sets, null);
});

test("repeat choices change the whole outline and reject unsupported or non-finite inputs", () => {
  const weeks = buildBaseStrengthWeeks("volume_intensity", {
    initialWaves: 3,
    buildWaves: 2,
    peakWaves: 4,
    waveIncreasePercent: 2,
  });
  assert.equal(weeks.length, 27);
  assert.deepEqual(
    weeks.map((week) => week.number),
    Array.from({ length: 27 }, (_, i) => i + 1),
  );
  assert.equal(weeks[9].phase, "build");
  assert.equal(weeks[15].phase, "peak");
  for (const invalid of [
    { initialWaves: 1 },
    { buildWaves: 1.5 },
    { peakWaves: 2 },
    { peakWaves: 5 },
    { waveIncreasePercent: NaN },
    { waveIncreasePercent: 5 },
  ])
    assert.throws(() =>
      buildBaseStrengthWeeks("volume_intensity", {
        ...DEFAULT_VOLUME_INTENSITY_OPTIONS,
        ...invalid,
      }),
    );
});

test("supported repeat choices keep percentage prescriptions below 100%", () => {
  const weeks = buildBaseStrengthWeeks("volume_intensity", {
    initialWaves: 3,
    buildWaves: 3,
    peakWaves: 4,
    waveIncreasePercent: 4,
  });
  assert.ok(
    weeks.every((week) => (week.volume?.percent ?? 0) < 100 && (week.main.percent ?? 0) < 100),
  );
});

test("Bullmastiff distinguishes base/peak targets and leaves performance-dependent loads unresolved", () => {
  const weeks = buildBaseStrengthWeeks("bullmastiff");
  assert.equal(weeks.length, 18);
  assert.deepEqual(
    weeks.slice(0, 3).map((week) => [week.main.sets, week.main.reps, week.main.percent]),
    [
      [4, 6, 70],
      [4, 6, null],
      [4, 6, null],
    ],
  );
  assert.deepEqual(
    weeks.slice(9, 12).map((week) => [week.main.sets, week.main.reps, week.main.percent]),
    [
      [5, 3, 85],
      [3, 3, null],
      [1, 3, null],
    ],
  );
  assert.equal(weeks[12].main.percent, 88);
  assert.equal(weeks[15].main.percent, 92);
  assert.equal(weeks[17].main.reps, 1);
  assert.deepEqual(
    weeks.slice(0, 3).map((week) => week.variation?.sets),
    [3, 4, 5],
  );
  assert.deepEqual(
    weeks.slice(9, 12).map((week) => week.variation?.sets),
    [4, 3, 2],
  );
});

test("variation maxes are separate and accessory omissions are explicit rather than invented", () => {
  const weeks = buildBaseStrengthWeeks("bullmastiff");
  const base = baseStrengthSessions("bullmastiff", weeks[0]);
  assert.equal(base.length, 4);
  assert.equal(base[0].movements[1].reference, "variation");
  assert.equal(base[0].movements[1].percent, 60);
  assert.deepEqual(
    base[0].movements.slice(2).map((movement) => [movement.sets, movement.reps]),
    [
      [2, 10],
      [2, 15],
      [2, 10],
      [2, 15],
    ],
  );
  assert.equal(baseStrengthSessions("bullmastiff", weeks[6])[0].movements[2].sets, null);
  const peak = baseStrengthSessions("bullmastiff", weeks[9]);
  assert.equal(peak[0].movements[1].name, "Pause squat");
  assert.equal(peak[0].movements[2].sets, null);
});

const bull = buildBaseStrengthWeeks("bullmastiff");
const example = {
  week: bull[0],
  nextWeek: bull[1],
  referenceMax: 500,
  nextPhaseMax: null,
  currentLoad: 350,
  lastSetReps: 11,
  allSetsCompleted: true,
  increment: 2.5,
};

test("plus-set increases use reference 1RM, not the working weight", () => {
  const result = bullmastiffNextLoad(example);
  assert.equal(result.kind, "increase");
  assert.equal(result.load, 375);
  assert.match(result.detail, /5 extra reps/);
});

test("no extra reps holds the actual working load even when a different rounding increment is chosen", () => {
  assert.equal(bullmastiffNextLoad({ ...example, lastSetReps: 6, currentLoad: 353 }).load, 353);
  const result = bullmastiffNextLoad({
    ...example,
    referenceMax: 100,
    currentLoad: 70,
    lastSetReps: 7,
  });
  assert.equal(result.kind, "hold");
  assert.equal(result.load, 70);
});

test("missing, inconsistent and invalid performance never produces a progression load", () => {
  for (const invalid of [
    { allSetsCompleted: false },
    { lastSetReps: null },
    { lastSetReps: 5 },
    { lastSetReps: 6.5 },
    { referenceMax: Infinity },
    { currentLoad: 0 },
    { increment: NaN },
  ]) {
    const result = bullmastiffNextLoad({ ...example, ...invalid });
    assert.equal(result.kind, "review");
    assert.equal(result.load, null);
  }
});

test("wave reset supersedes accumulated plus-set load", () => {
  const result = bullmastiffNextLoad({
    ...example,
    week: bull[2],
    nextWeek: bull[3],
    currentLoad: 420,
    lastSetReps: 15,
  });
  assert.equal(result.kind, "reset");
  assert.equal(result.load, 375);
  assert.match(result.detail, /do not carry/);
});

test("the peak transition requires its own reassessed max", () => {
  const input = { ...example, week: bull[8], nextWeek: bull[9] };
  assert.equal(bullmastiffNextLoad(input).kind, "review");
  assert.equal(bullmastiffNextLoad({ ...input, nextPhaseMax: 600 }).load, 510);
});

test("finishing does not silently prescribe a new cycle", () => {
  const result = bullmastiffNextLoad({ ...example, week: bull[17], nextWeek: null });
  assert.equal(result.kind, "finish");
  assert.equal(result.load, null);
});

test("percentage loads round without substituting a discounted training max or missing inputs", () => {
  assert.equal(roundedPreviewLoad(103, 70, 2.5), 72.5);
  assert.equal(roundedPreviewLoad(103, 70, 0.5), 72);
  for (const input of [
    [null, 70, 2.5],
    [100, null, 2.5],
    [-100, 70, 2.5],
    [100, 70, 0],
    [100, Infinity, 2.5],
  ] as const)
    assert.equal(roundedPreviewLoad(...input), null);
});
