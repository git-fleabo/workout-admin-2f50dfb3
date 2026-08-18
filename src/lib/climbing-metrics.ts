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

export function climbingGradeProgress(entries: ClimbingProgressEntry[]) {
  const byMonth = new Map<
    string,
    { month: string; highestGrade: string; gradeSystem: string | null }
  >();
  for (const entry of entries) {
    if (!entry.grade.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) continue;
    const month = entry.date.slice(0, 7);
    const current = byMonth.get(month);
    if (
      !current ||
      entry.grade.localeCompare(current.highestGrade, undefined, { numeric: true }) > 0
    ) {
      byMonth.set(month, {
        month,
        highestGrade: entry.grade.trim(),
        gradeSystem: entry.gradeSystem ?? null,
      });
    }
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
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
