import {
  recoveryRoutineSchema,
  type RecoveryExercise,
  type RecoveryRoutineInput,
  type RecoveryTemplate,
} from "./recovery.ts";
import { MOVESMETHOD_SOURCE as source } from "./movesmethod-source.ts";

export const MOVESMETHOD_URL = "https://www.skool.com/movesmethod/classroom/828d6756";
export const MOVESMETHOD_GUIDE = `${MOVESMETHOD_URL}?md=9e3ad9537ad34c35be6d713886ff59f2`;
const lessonUrl = (id: string) => `${MOVESMETHOD_URL}?md=${id}`;
const identity = (name: string) =>
  `movesmethod-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "")}`;
type SourceDay = (typeof source.days)[number];

function reference(name: string, lesson: string): RecoveryExercise {
  return {
    id: identity(name),
    exerciseId: null,
    name,
    sets: 1,
    reps: "",
    weight: null,
    hold: null,
    side: "none",
    load: "total",
    source: lessonUrl(lesson),
    setup:
      "Reference only: follow the linked demonstration. No set, repetition, load or hold target is specified here. The single app reference row is not a prescribed set; quick practice records completion only.",
  };
}

function exercise(row: SourceDay, [movement, sets, dose]: SourceDay[4][number]): RecoveryExercise {
  const name = source.moves[movement];
  if (!name) throw new Error(`Unknown Movesmethod movement ${movement}.`);
  const timed = dose.includes("sec");
  const each = /\/leg|\/side|each leg/.test(dose);
  const splitTotal = name === "Thoracic Rotations" || name === "Thoracic Extensions";
  const notes = [
    `Source prescription: ${name} — ${sets} × ${dose}.`,
    "If using added load, kg means total external load. Record band resistance and any assistance in technique notes; no load is preset.",
  ];
  if (name === "Passive Hang")
    notes.push(
      "Accumulate the stated seconds with assistance as needed. The course links Squat Overhead Reachouts as an alternative: https://youtu.be/gvfTTaBsWYQ. No equivalent dose has been inferred for the alternative.",
    );
  if (name === "Shoulder Dislocates")
    notes.push(
      "Controlled movement; choose a suitable wide grip. The source allows a light band instead of a stick.",
    );
  if (name === "Jefferson Curl")
    notes.push("Source tempo: 5-second eccentric. This is lowering tempo, not a static hold.");
  if (splitTotal)
    notes.push(
      "The written target is 10 total, clarified as 5 per side. Separate left/right rows therefore each target 5 reps.",
    );
  if (name === "Thoracic Rotations")
    notes.push("Move slowly, including the palm articulation shown in the lesson.");
  if (name === "Thoracic Extensions")
    notes.push(
      "Pause 2 seconds at the top and bottom. The single hold field represents one pause, not their combined time. The source permits slightly elevated feet when squatting is limited.",
    );
  if (name === "Standing Pullover") notes.push("Pause 2 seconds at the bottom of each repetition.");
  if (
    (row[1] === 1 && ["Single Leg Goodmorning", "Active Pigeon"].includes(name)) ||
    name === "Back Hip Pulse"
  )
    notes.push(
      "Pause 10 seconds on the last repetition only. The hold target stays blank so this is not prescribed on every repetition.",
    );
  if (name === "Wrist Rocks")
    notes.push(
      "10 repetitions in each direction, not 10 combined. Use technique notes to identify directions and any different counts; do not treat directions as left/right sides.",
    );
  if (name === "Shoulder Protocol")
    notes.push(
      "One set is the entire demonstrated shoulder sequence: 20 repetitions PER MOVEMENT, with no pause between movements. Use light or no added weight. This remains one linked protocol block, not an invented list of exercises or 20 repetitions total. Record numeric reps only when every movement has that count; otherwise leave reps blank and describe each count in technique notes.",
    );
  if (name === "Shoulder Extensions")
    notes.push("Slow and controlled; follow the active/passive positions in the demonstration.");
  if (name === "Hamstring Walkouts" || name === "Hamstring Curls")
    notes.push("Slow, controlled movement.");
  if (name === "Hamstring Curls")
    notes.push(
      "The written dose ends in an incomplete slash (eg 1x10/). The count is retained; no per-side multiplier has been inferred. Check the demonstration.",
    );
  if (name === "Single Leg Squat to Box")
    notes.push(
      "The source does not specify whether its repetition count is per leg or combined. No extra side has been inferred; check the demonstration and record which leg/count you perform.",
    );
  if (name === "Horse Stance Squats" || name === "Cossack Squat")
    notes.push(
      "Use the support or regression shown in the linked lesson and record the setup used.",
    );
  if (name === "Wrist Rocks" || name === "Palm Peel Aways" || name === "Forearm Extensions")
    notes.push("Source setup: shoulders above wrists, elbows straight where demonstrated.");
  return {
    id: identity(name),
    exerciseId: null,
    name,
    sets,
    reps: timed
      ? ""
      : splitTotal
        ? "5"
        : name === "Shoulder Protocol"
          ? "20 per movement"
          : dose.match(/^\d+(?:-\d+)?/)![0].replace("-", "–"),
    weight: null,
    hold: timed
      ? Number.parseInt(dose)
      : ["Thoracic Extensions", "Standing Pullover"].includes(name)
        ? 2
        : null,
    side: each || splitTotal ? "each" : "none",
    load: "total",
    setup: notes.join(" "),
    source: lessonUrl(row[2]),
  };
}

function template(row: SourceDay): RecoveryTemplate {
  const [week, day, lesson, flow, doses] = row;
  const full = doses.length === 10;
  const area = full ? "Shoulders, spine, hamstrings, hips & wrists" : "Shoulders, ankles & knees";
  return {
    id: `movesmethod-week-${week}-day-${day}`,
    name: `Day ${day} · ${flow || area}`,
    mode: flow ? "quick" : "measured",
    minutes: flow ? 10 : week < 3 ? 25 : week === 3 ? 35 : 45,
    weekdays: [],
    nextMorning: false,
    exercises: flow ? [reference(flow, lesson)] : doses.map((dose) => exercise(row, dose)),
    notes: [
      `Movesmethod Mobility Toolkit · Week ${week}, Day ${day}. Source: ${lessonUrl(lesson)}.`,
      "The displayed minutes are an app estimate, not the video length or a course-prescribed session duration. Record what you actually perform.",
      flow
        ? "Video-led flow: no written repetition, round or hold prescription is provided. Follow the original lesson and record completion only; no repeated rounds have been invented."
        : "The written weekly targets are saved exactly, including higher set counts in later weeks. Check the linked demonstration for setup and regressions.",
    ].join(" "),
    progression:
      "Choose numbered days and weeks manually. Course guidance allows adapting or repeating practice and favours controlled movement within your current range. No automatic load increases, readiness decision or phase advancement.",
  };
}

/** Personal import support only: never run automatically on page load. */
export function buildMovesmethodRoutines(): RecoveryRoutineInput[] {
  const routines: RecoveryRoutineInput[] = [1, 2, 3, 4].map((week) => ({
    name: `Movesmethod · Mobility Toolkit · Week ${week}`,
    purpose: "Mobility",
    area: "Full body",
    status: "paused",
    notes: [
      `Source: ${MOVESMETHOD_URL}. Usage guide: ${MOVESMETHOD_GUIDE}. Verified 29 October 2026.`,
      "Six numbered lessons are listed in each source week. The guide also says five active days and two rest days; this conflict is preserved rather than resolved by inventing a calendar. Sessions are unscheduled and day/week selection is manual.",
      "Starts paused as an optional separate programme. Activation does not replace or automatically combine it with Shoulder Blueprint or other toolkit practices. Provider completion ticks have not been imported as workouts.",
    ].join(" "),
    templates: source.days.filter((row) => row[0] === week).map(template),
  }));
  routines.push({
    name: "Movesmethod · Joint toolkit · Optional resources",
    purpose: "Mobility",
    area: "Full body",
    status: "paused",
    notes: `Optional joint-specific reference catalogue, separate from the four-week plan. Source: ${MOVESMETHOD_URL}. The course suggests starting with two or three chosen exercises. These pages list demonstrations without written doses, so no measured prescription is invented. Choose which drills to practise and record them in session notes; completion does not mean every listed drill was performed.`,
    templates: source.joints.map(([area, lesson, names]) => ({
      id: `movesmethod-joints-${area.toLowerCase()}`,
      name: `Choose drills · ${area}`,
      mode: "quick",
      minutes: 10,
      weekdays: [],
      nextMorning: false,
      exercises: names.map((name) => reference(name, lesson)),
      notes:
        "Optional reference list: choose the drills you want, rather than treating this as a prescribed circuit. Note your selection in session notes. Completion records that chosen practice only. Displayed minutes are an app estimate; video length is not a prescribed practice duration.",
      progression:
        "No prescribed sets, repetitions, holds or progression are given on this joint index. Use the linked teaching and your chosen practice; no targets or results are inferred.",
    })),
  });
  return routines.map((routine) => recoveryRoutineSchema.parse(routine));
}
