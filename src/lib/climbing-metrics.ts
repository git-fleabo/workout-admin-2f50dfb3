export const CLIMBING_TRACKING_MODES = ["Time only", "Problems / routes"] as const;
export const CLIMBING_GRADE_SYSTEMS = ["V-scale", "Font", "French", "YDS"] as const;
export const CLIMBING_SEND_TYPES = ["attempt", "flash", "onsight", "redpoint"] as const;
export const MAX_CLIMBING_MINUTES = 720;

type ClimbingMetricInput = {
  minutes: string;
  trackingMode?: string;
  problemsOrRoutes?: string;
  grade?: string;
  gradeSystem?: string;
  sendType?: string;
  isProject?: boolean;
};

function positiveInteger(value: string) {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function climbingMetricIssue({
  minutes,
  trackingMode,
  problemsOrRoutes,
  gradeSystem,
  sendType,
}: ClimbingMetricInput) {
  const duration = positiveInteger(minutes);
  if (duration == null) return "Enter the total climbing time as a whole number of minutes.";
  if (duration > MAX_CLIMBING_MINUTES) {
    return `Climbing time cannot exceed ${MAX_CLIMBING_MINUTES} minutes. For 1h 15m, enter 75.`;
  }
  if (!CLIMBING_TRACKING_MODES.includes(trackingMode as (typeof CLIMBING_TRACKING_MODES)[number])) {
    return "Choose whether to track time only or problems / routes.";
  }
  if (trackingMode === "Problems / routes" && positiveInteger(problemsOrRoutes ?? "") == null) {
    return "Enter the number of problems or routes completed.";
  }
  if (
    trackingMode === "Problems / routes" &&
    gradeSystem &&
    !CLIMBING_GRADE_SYSTEMS.includes(gradeSystem as (typeof CLIMBING_GRADE_SYSTEMS)[number])
  ) {
    return "Choose a valid climbing grade system.";
  }
  if (
    trackingMode === "Problems / routes" &&
    sendType &&
    !CLIMBING_SEND_TYPES.includes(sendType as (typeof CLIMBING_SEND_TYPES)[number])
  ) {
    return "Choose a valid climbing send type.";
  }
  return null;
}

export type ClimbingProgressEntry = {
  date: string;
  grade: string;
  gradeSystem?: string | null;
  sendType?: string | null;
  isProject?: boolean | null;
};

export function climbingGradeOrdinal(grade: string, system: string | null | undefined) {
  const value = grade.trim();
  if (system === "V-scale") {
    if (value.toUpperCase() === "VB") return { ordinal: 1, label: "VB" };
    const match = value.match(/^V(0|[1-9]\d?)([-+]?)$/i);
    if (!match || (match[2] && match[1] !== "0")) return null;
    const number = Number(match[1]);
    return {
      ordinal: number === 0 ? 2 + ["-", "", "+"].indexOf(match[2]) : number + 4,
      label: `V${number}${match[2]}`,
    };
  }
  if (system === "Font" || system === "French") {
    const normalized = system === "Font" ? value.toUpperCase() : value.toLowerCase();
    const lower =
      system === "Font"
        ? ["1", "2", "3", "4", "4+", "5", "5+"]
        : ["1", "2", "3a", "3b", "3c", "4a", "4b", "4c", "5a", "5b", "5c"];
    const low = lower.indexOf(normalized);
    if (low >= 0) return { ordinal: low + 1, label: normalized };
    const match = normalized.match(/^([6-9])([abc])(\+?)$/i);
    if (!match) return null;
    return {
      ordinal:
        lower.length +
        1 +
        (Number(match[1]) - 6) * 6 +
        "abc".indexOf(match[2].toLowerCase()) * 2 +
        (match[3] ? 1 : 0),
      label: normalized,
    };
  }
  if (system === "YDS") {
    const match = value.match(/^5\.(0|[1-9]|1\d)([a-d]?)$/i);
    if (!match) return null;
    const number = Number(match[1]);
    if (number >= 10 !== Boolean(match[2])) return null;
    return {
      ordinal:
        number < 10 ? number + 1 : 11 + (number - 10) * 4 + "abcd".indexOf(match[2].toLowerCase()),
      label: value.toLowerCase(),
    };
  }
  return null;
}

export type ClimbingGradePoint = {
  month: string;
  highestGrade: string;
  gradeSystem: string;
  gradeOrdinal: number;
  gradeLabel: string;
};

export function climbingGradeProgress(entries: ClimbingProgressEntry[]): ClimbingGradePoint[] {
  const byMonthAndSystem = new Map<string, ClimbingGradePoint>();
  for (const entry of entries) {
    const parsed = climbingGradeOrdinal(entry.grade, entry.gradeSystem);
    if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) continue;
    const month = entry.date.slice(0, 7);
    const key = `${entry.gradeSystem}:${month}`;
    const current = byMonthAndSystem.get(key);
    if (!current || parsed.ordinal > current.gradeOrdinal) {
      byMonthAndSystem.set(key, {
        month,
        highestGrade: entry.grade.trim(),
        gradeSystem: entry.gradeSystem!,
        gradeOrdinal: parsed.ordinal,
        gradeLabel: parsed.label,
      });
    }
  }
  return Array.from(byMonthAndSystem.values()).sort(
    (a, b) => a.gradeSystem.localeCompare(b.gradeSystem) || a.month.localeCompare(b.month),
  );
}

export function openClimbingProjects(entries: ClimbingProgressEntry[]) {
  const projects = new Map<string, ClimbingProgressEntry>();
  for (const entry of entries) {
    if (!entry.grade.trim() || !entry.isProject) continue;
    const key = `${entry.gradeSystem ?? ""}:${entry.grade.trim().toLowerCase()}`;
    const current = projects.get(key);
    if (!current || entry.date > current.date) projects.set(key, entry);
  }
  return Array.from(projects.values()).filter((project) => {
    const key = `${project.gradeSystem ?? ""}:${project.grade.trim().toLowerCase()}`;
    return !entries.some(
      (entry) =>
        `${entry.gradeSystem ?? ""}:${entry.grade.trim().toLowerCase()}` === key &&
        entry.date > project.date &&
        entry.sendType === "redpoint",
    );
  });
}

export function supportsClimbingGradient(movement: string) {
  return movement.trim().toLowerCase() === "kilter";
}
