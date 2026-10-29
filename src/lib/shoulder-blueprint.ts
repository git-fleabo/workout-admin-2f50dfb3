import {
  recoveryRoutineSchema,
  type RecoveryExercise,
  type RecoveryRoutineInput,
  type RecoveryTemplate,
} from "./recovery.ts";
import { SHOULDER_BLUEPRINT_SOURCE as source } from "./shoulder-blueprint-source.ts";

export const SHOULDER_BLUEPRINT_URL =
  "https://theptinitiative.mykajabi.com/products/the-shoulder-blueprint";
export const SHOULDER_BLUEPRINT_GUIDE = `${SHOULDER_BLUEPRINT_URL}/categories/2153923406/posts/2171821965`;

type SourceLesson = readonly [movement: number, post: number, prescription: string];
type SourceRow = readonly [number: number, category: number, lessons: readonly SourceLesson[]];

// Only spelling/plural variants of the same named movement share an identity.
const aliases: Record<string, string> = {
  "Straight Arm Pulldowns": "Straight Arm Pulldown",
  "Modified Prone Swimmer": "Modified Prone Swimmers",
  "Half Kneeling External Rotations": "Half Kneeling External Rotation",
  "Seated External Rotation Sliders": "Seated External Rotation Slider",
  "Half Kneeling Bottom Up Press": "Half Kneeling Bottoms Up Press",
};

const sourceIssues: Record<number, string> = {
  2172947694:
    "The lesson title prescribes 3 sets of 6 each side; its description mentions 5 rotations. The saved target follows the title. Check the linked lesson before changing that target.",
  2171913737:
    "The source title says 'with a 2 hold' without a unit. No hold duration has been inferred; check the linked demonstration.",
  2171913787:
    "The source title omits the number of seconds for its hold. No hold duration has been inferred; check the linked demonstration.",
};

function exercise(
  category: number,
  [movement, post, prescription]: SourceLesson,
): RecoveryExercise {
  const name = source.moves[movement];
  if (!name) throw new Error(`Unknown Shoulder Blueprint movement ${movement}.`);
  const dose = prescription.replace(/\s*-\s*/g, "-");
  const setsMatch = dose.match(/^(\d+)\s+sets?\s*(?:of\s*)?/i);
  const remainder = setsMatch ? dose.slice(setsMatch[0].length) : dose;
  const timeOnly = remainder.match(/^(\d+)(?:-(\d+))?\s*(min(?:ute)?s?|sec(?:ond)?s?)\b/i);
  const repMatch = !timeOnly && remainder.match(/^(\d+(?:-\d+)?)/);
  const holdPerRep = dose.match(
    /(?:with\s+(?:a\s+)?|reps\s+)(\d+)(?:-(\d+))?\s+sec(?:ond)?s?\s+hold/i,
  );
  let hold: number | null = null;
  if (timeOnly && !timeOnly[2]) hold = Number(timeOnly[1]) * (/^min/i.test(timeOnly[3]) ? 60 : 1);
  else if (holdPerRep && !holdPerRep[2]) hold = Number(holdPerRep[1]);

  const eachSide =
    /(?:each|per) side/i.test(dose) ||
    ["Kneeling Lateral Arm Rotations", "Mini Band External Rotations"].includes(name);
  const bodyweight =
    /(?:Scapular Press|Shoulder Taps|Serratus Press|Plank|Toe Taps|Dolphin Press)/.test(name);
  const unloaded =
    /Release|Foam Rolling|Open Book Holds|Kneeling Lateral Arm|Wall Thoracic Opener|Seated Wall Slides|Seated Overhead Mobilization|Quadruped Serratus/.test(
      name,
    );
  const perHand = /Dumbbell|Weighted Prone W/.test(name);
  const notes = [`Source prescription: ${prescription}.`];
  if (!setsMatch)
    notes.push(
      "The source gives one dose without a set count; one logging row represents that dose.",
    );
  if (timeOnly?.[2] || holdPerRep?.[2])
    notes.push(
      "Keep the stated time range; the single-value hold target is left blank. Record actual seconds.",
    );
  if (/steps/i.test(dose))
    notes.push(
      "For this carry, Reps records the slow step count per leg. Record the arm setup used from the demonstration in technique notes.",
    );
  if (
    /each direction|each directions/i.test(dose) ||
    (name === "Lateral Ball Circles" && /each$/i.test(dose))
  )
    notes.push(
      "The prescribed count is in each direction; do not treat it as a combined circle total.",
    );
  if (/8-10#/.test(dose))
    notes.push(
      "The course's example is 8–10 lb (about 3.6–4.5 kg). No kg load has been prefilled; record the load actually used.",
    );
  if (/Band|Pull Apart|Straight Arm Pulldown|External Rotation/.test(name))
    notes.push(
      "Record band type/resistance and setup in technique notes; kg stays blank unless a load is known.",
    );
  if (sourceIssues[post]) notes.push(sourceIssues[post]);

  return {
    id: `sbp-${(aliases[name] ?? name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-$/, "")}`,
    exerciseId: null,
    name,
    sets: setsMatch ? Number(setsMatch[1]) : 1,
    reps: repMatch ? repMatch[1].replace("-", "–") : "",
    weight: null,
    hold,
    side:
      eachSide && !/each leg|each direction/i.test(dose) && !name.startsWith("High Plank ")
        ? "each"
        : "none",
    load: bodyweight ? "bodyweight" : unloaded ? "unloaded" : perHand ? "per_hand" : "total",
    setup: notes.join(" "),
    source: `${SHOULDER_BLUEPRINT_URL}/categories/${category}/posts/${post}`,
  };
}

function template([number, category, lessons]: SourceRow, bonus = false): RecoveryTemplate {
  const mobility = !bonus && number % 5 === 0;
  return {
    id: bonus ? `shoulder-blueprint-prehab-${number}` : `shoulder-blueprint-day-${number}`,
    name: bonus
      ? `Prehab · Routine ${number}`
      : `Day ${number} · Week ${Math.ceil(number / 5)}${mobility ? " · Mobility" : ""}`,
    mode: "measured",
    minutes: bonus || mobility ? 15 : 20,
    weekdays: [],
    exercises: lessons.map((lesson) => exercise(category, lesson)),
    notes: [
      "The PT Initiative · The Shoulder Blueprint.",
      bonus
        ? "Optional prevention routine for after the main course, as a warm-up or accessory session. Choose one routine when useful."
        : `Choose the numbered course days in order. The course suggests five sessions per week, with rest days arranged to suit you. This is Day ${number}; completion does not automatically change phases.`,
      "The displayed session time is an app estimate, not a duration prescribed by the course. Follow the linked demonstrations for setup and technique. Blank load targets remain unspecified.",
    ].join(" "),
    nextMorning: false,
    progression: bonus
      ? "Use after finishing the main programme. This optional routine has no automatic progression or load increases."
      : "Course guidance: finish the phase with good form and mostly pain-free movement before moving on. Repeat the phase if you are not ready. You choose when to activate the next phase; the app does not assess readiness or increase loads.",
  };
}

/** Personal source import only; does not create workout history or modify the shared Library. */
export function buildShoulderBlueprintRoutines(): RecoveryRoutineInput[] {
  const phaseNames = [
    "Foundations & Essentials",
    "Stability & Optimisation",
    "Progression & Resilience",
  ];
  const routines: RecoveryRoutineInput[] = phaseNames.map((label, index) => ({
    name: `Shoulder Blueprint · Phase ${index + 1} · ${label}`,
    purpose: "",
    area: "Shoulders",
    notes: [
      `Source: ${SHOULDER_BLUEPRINT_URL}. Usage guide: ${SHOULDER_BLUEPRINT_GUIDE}. Verified 29 October 2026.`,
      `Days ${index * 10 + 1}–${index * 10 + 10}; two course weeks. All sessions are manual so rest days can move and no calendar backlog is created.`,
      "Later phases and the optional prevention routines start paused. Use Edit routine → Routine details and status to activate them when you choose.",
      "Lesson-completion ticks in the provider's course have not been copied as performed workouts. Exercise names and prescriptions are course facts; demonstration videos remain on the provider's site.",
    ].join(" "),
    status: index === 0 ? "active" : "paused",
    templates: source.days.slice(index * 10, index * 10 + 10).map((day) => template(day)),
  }));
  routines.push({
    name: "Shoulder Blueprint · Optional prehab & prevention",
    purpose: "Prehab",
    area: "Shoulders",
    status: "paused",
    notes: `The course's five bonus routines are optional warm-ups/accessories for after the main programme. Source: ${SHOULDER_BLUEPRINT_URL}/categories/2153941250. Activate only when you choose. Two source titles omit a hold duration/unit; those hold targets remain blank and are flagged beside the exercise.`,
    templates: source.bonus.map((row) => template(row, true)),
  });
  return routines.map((routine) => recoveryRoutineSchema.parse(routine));
}
