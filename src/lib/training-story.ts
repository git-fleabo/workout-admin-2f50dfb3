import type { TimelineEntry } from "./supabase-timeline.browser";

export type TrainingStory = {
  lead: string;
  highlights: string[];
};

const plural = (value: number, singular: string, pluralForm = `${singular}s`) =>
  `${value} ${value === 1 ? singular : pluralForm}`;

function sessionKey(entry: TimelineEntry) {
  return entry.sessionId ? `session:${entry.sessionId}` : `entry:${entry.id}`;
}

export function buildTrainingStory(
  entries: TimelineEntry[],
  period: "month" | "year",
): TrainingStory | null {
  if (entries.length === 0) return null;

  const activeDays = new Set(entries.map((entry) => entry.date));
  const trainingEntries = entries.filter(
    (entry) => entry.kind === "workout" || entry.kind === "climb",
  );
  const sessions = new Map<string, TimelineEntry>();
  for (const entry of trainingEntries) {
    const key = sessionKey(entry);
    if (!sessions.has(key)) sessions.set(key, entry);
  }

  const movementCounts = new Map<string, number>();
  for (const entry of entries.filter((item) => item.kind === "workout")) {
    movementCounts.set(entry.title, (movementCounts.get(entry.title) ?? 0) + 1);
  }
  const movements = [...movementCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const [topMovement, topMovementCount] = movements[0] ?? [];

  const recordedMinutes = [...sessions.values()].reduce(
    (total, entry) => total + (entry.minutes ?? 0),
    0,
  );
  const climbMinutes = [...sessions.values()]
    .filter((entry) => entry.kind === "climb")
    .reduce((total, entry) => total + (entry.minutes ?? 0), 0);
  const prs = entries.filter((entry) => entry.isPr).length;

  const highlights: string[] = [];
  if (topMovement && topMovementCount > 1) {
    highlights.push(`${topMovement} appeared in ${plural(topMovementCount, "session")}.`);
  } else if (movements.length > 1) {
    highlights.push(`Training stayed varied across ${plural(movements.length, "movement")}.`);
  } else if (topMovement) {
    highlights.push(`${topMovement} was your recorded movement.`);
  }

  if (period === "year") {
    const sessionsByMonth = new Map<string, number>();
    for (const entry of sessions.values()) {
      const month = entry.date.slice(0, 7);
      sessionsByMonth.set(month, (sessionsByMonth.get(month) ?? 0) + 1);
    }
    const busiest = [...sessionsByMonth.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0];
    if (busiest) {
      const date = new Date(`${busiest[0]}-01T00:00:00Z`);
      const label = new Intl.DateTimeFormat("en-GB", {
        month: "long",
        timeZone: "UTC",
      }).format(date);
      highlights.push(`${label} was busiest with ${plural(busiest[1], "session")}.`);
    }
  }

  if (climbMinutes > 0) {
    const climbingHours = Math.round((climbMinutes / 60) * 10) / 10;
    highlights.push(
      `${climbingHours} climbing ${climbingHours === 1 ? "hour" : "hours"} recorded.`,
    );
  } else if (recordedMinutes > 0) {
    highlights.push(`${Math.round(recordedMinutes / 60)} training hours recorded.`);
  }
  if (prs > 0) highlights.push(`${plural(prs, "personal record")} marked the period.`);

  const activeMonths = new Set(entries.map((entry) => entry.date.slice(0, 7))).size;
  const lead =
    period === "year"
      ? `Across ${plural(activeMonths, "active month")}, you trained on ${plural(activeDays.size, "day")} and logged ${plural(sessions.size, "session")}.`
      : `You trained on ${plural(activeDays.size, "day")} and logged ${plural(sessions.size, "session")} this month.`;

  return { lead, highlights: highlights.slice(0, 3) };
}
