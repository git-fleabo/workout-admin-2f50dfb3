export type HeatmapSourceEntry = {
  date: string;
  kind: "workout" | "climb" | "one_rm" | "bodyweight";
  sessionId: string | null;
};

export type TrainingHeatmapDay = {
  date: string;
  sessions: number;
};

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

export function buildTrainingHeatmap(entries: HeatmapSourceEntry[], endDate: string) {
  const end = new Date(`${endDate}T00:00:00Z`);
  const start = addDays(end, -364);
  const sessionsByDate = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (entry.kind !== "workout" && entry.kind !== "climb") continue;
    const date = entry.date;
    const when = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(when.getTime()) || when < start || when > end) continue;
    const sessions = sessionsByDate.get(date) ?? new Set<string>();
    sessions.add(entry.sessionId ?? `${entry.kind}:${date}:${sessions.size}`);
    sessionsByDate.set(date, sessions);
  }
  return Array.from({ length: 365 }, (_, index) => {
    const date = addDays(start, index).toISOString().slice(0, 10);
    return { date, sessions: sessionsByDate.get(date)?.size ?? 0 };
  });
}
