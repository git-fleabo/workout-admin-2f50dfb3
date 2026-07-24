export type DataShape = "individual" | "aggregate" | "unknown";

export type LoadSemantics =
  | "total_external_load"
  | "per_implement_load"
  | "combined_implement_load"
  | "added_bodyweight_load"
  | "assistance"
  | "bodyweight_contribution"
  | "none"
  | "unknown";

export type VolumeStatus = "exact" | "ambiguous" | "not_applicable" | "unknown";

export const ESTIMATED_ONE_RM_REP_CEILING = 12;

export function normalizeExerciseName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function resolveReviewedAlias<T extends { aliasName: string; status: string }>(
  value: string,
  aliases: T[],
) {
  const normalized = normalizeExerciseName(value);
  return aliases.find(
    (alias) => alias.status === "reviewed" && normalizeExerciseName(alias.aliasName) === normalized,
  );
}

export function estimatedOneRepMax({
  weight,
  reps,
  dataShape,
  rangeOfMotion,
  repCeiling = ESTIMATED_ONE_RM_REP_CEILING,
}: {
  weight: number | null;
  reps: number | null;
  dataShape: DataShape;
  rangeOfMotion?: string | null;
  repCeiling?: number;
}) {
  if (
    dataShape !== "individual" ||
    weight == null ||
    weight <= 0 ||
    reps == null ||
    reps <= 0 ||
    reps > repCeiling ||
    rangeOfMotion?.trim().toLowerCase() === "partial"
  ) {
    return null;
  }
  return weight * (1 + reps / 30);
}

export function comparableVolume({
  reps,
  weight,
  volumeStatus,
  loadSemantics = "total_external_load",
  implementCount,
}: {
  reps: number | null;
  weight: number | null;
  volumeStatus: VolumeStatus;
  loadSemantics?: LoadSemantics;
  implementCount?: number | null;
}) {
  if (volumeStatus !== "exact" || reps == null || reps <= 0 || weight == null || weight <= 0) {
    return null;
  }
  if (loadSemantics === "per_implement_load") {
    if (implementCount == null || implementCount <= 0) return null;
    return reps * weight * implementCount;
  }
  return reps * weight;
}

export function explicitLoadClassification(semantics: LoadSemantics): {
  loadSemantics: LoadSemantics;
  volumeStatus: VolumeStatus;
  implementCount: number | null;
} {
  if (semantics === "per_implement_load") {
    return { loadSemantics: semantics, volumeStatus: "exact", implementCount: 2 };
  }
  if (semantics === "combined_implement_load") {
    return { loadSemantics: semantics, volumeStatus: "exact", implementCount: null };
  }
  return {
    loadSemantics: semantics,
    volumeStatus: semantics === "unknown" ? "ambiguous" : "exact",
    implementCount: null,
  };
}

export function progressRepValues(
  sets: Array<{
    reps: number | null;
    dataShape?: DataShape;
  }>,
) {
  return sets.flatMap((set) =>
    set.dataShape === "aggregate" || set.dataShape === "unknown" || set.reps == null
      ? []
      : [set.reps],
  );
}

export function inferLoadClassification({
  movement,
  equipment,
  weight,
  assistanceType,
}: {
  movement: string;
  equipment: string | null;
  weight: number | null;
  assistanceType?: string | null;
}): { loadSemantics: LoadSemantics; volumeStatus: VolumeStatus } {
  if (weight == null || weight <= 0) {
    return { loadSemantics: "none", volumeStatus: "not_applicable" };
  }
  const assistance = assistanceType?.trim().toLowerCase();
  if (assistance && assistance !== "none") {
    return { loadSemantics: "assistance", volumeStatus: "ambiguous" };
  }
  const name = movement.trim().toLowerCase();
  if (name.startsWith("weighted ")) {
    return { loadSemantics: "added_bodyweight_load", volumeStatus: "exact" };
  }
  const equipmentKey = equipment?.trim().toLowerCase() ?? "";
  if (equipmentKey.includes("barbell") || equipmentKey.includes("machine")) {
    return { loadSemantics: "total_external_load", volumeStatus: "exact" };
  }
  return { loadSemantics: "unknown", volumeStatus: "ambiguous" };
}

export type GroupingSession = {
  id: string;
  personId: string;
  date: string;
  source: string;
  sourceSheet: string | null;
  sourceRow: number | null;
  createdAt: string;
  locationId: string | null;
  durationMinutes: number | null;
  entryName: string;
  activityName: string;
};

export type GroupingCandidate = {
  key: string;
  confidence: "high" | "ambiguous";
  sessions: GroupingSession[];
};

const GROUPABLE_ACTIVITIES = new Set([
  "Strength",
  "Skills/Calisthenics",
  "Grip",
  "Conditioning",
  "Other",
]);

export function classifySessionGroups(rows: GroupingSession[]): GroupingCandidate[] {
  const compatible = rows.filter((row) => GROUPABLE_ACTIVITIES.has(row.activityName));
  const groups = new Map<string, GroupingSession[]>();
  for (const row of compatible) {
    const key = [row.personId, row.date, row.source, row.sourceSheet ?? ""].join("::");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .filter(([, sessions]) => sessions.length > 1)
    .map(([key, sessions]) => {
      const ordered = [...sessions].sort((left, right) => {
        if (left.sourceRow != null && right.sourceRow != null) {
          return left.sourceRow - right.sourceRow;
        }
        return left.createdAt.localeCompare(right.createdAt);
      });
      const locations = new Set(ordered.map((row) => row.locationId).filter(Boolean));
      const noDurationConflict = ordered.every((row) => row.durationMinutes == null);
      const importedRows = ordered.map((row) => row.sourceRow).filter((row) => row != null);
      const importedContiguous =
        ordered[0]?.source === "google_sheets_import" &&
        ordered[0]?.sourceSheet === "Workout Log" &&
        importedRows.length === ordered.length &&
        Math.max(...importedRows) - Math.min(...importedRows) === ordered.length - 1;
      const createdTimes = ordered.map((row) => Date.parse(row.createdAt));
      const nativeCloseTogether =
        ordered[0]?.source === "manual" &&
        ordered[0]?.sourceSheet === "Workout Log" &&
        createdTimes.every(Number.isFinite) &&
        Math.max(...createdTimes) - Math.min(...createdTimes) <= 15 * 60 * 1000;
      return {
        key,
        confidence:
          noDurationConflict && locations.size <= 1 && (importedContiguous || nativeCloseTogether)
            ? ("high" as const)
            : ("ambiguous" as const),
        sessions: ordered,
      };
    })
    .sort((left, right) => left.sessions[0]!.date.localeCompare(right.sessions[0]!.date));
}
