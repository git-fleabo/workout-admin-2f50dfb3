export type ProgrammeAdherenceSession = {
  assignmentId: string;
  programWorkoutId: string;
  date: string;
};

export type ProgrammeAdherenceLink = {
  assignmentId: string;
  programWorkoutId: string;
  status: "pending" | "accepted" | "completed" | "skipped" | "archived";
  completedSessionId: string | null;
};

export type ProgrammeAdherence = {
  due: number;
  completed: number;
  onTime: number;
  late: number;
  outstanding: number;
  missed: number;
  skipped: number;
  percentage: number | null;
};

export function summarizeProgrammeAdherence({
  sessions,
  links,
  completedSessionDates,
  reviewEnd,
}: {
  sessions: ProgrammeAdherenceSession[];
  links: ProgrammeAdherenceLink[];
  completedSessionDates: Map<string, string>;
  reviewEnd: string;
}): ProgrammeAdherence {
  const linksByWorkout = new Map<string, ProgrammeAdherenceLink>();
  for (const link of links) {
    const key = `${link.assignmentId}:${link.programWorkoutId}`;
    if (!linksByWorkout.has(key)) linksByWorkout.set(key, link);
  }
  const summary: ProgrammeAdherence = {
    due: sessions.length,
    completed: 0,
    onTime: 0,
    late: 0,
    outstanding: 0,
    missed: 0,
    skipped: 0,
    percentage: null,
  };

  for (const session of sessions) {
    const link = linksByWorkout.get(`${session.assignmentId}:${session.programWorkoutId}`);
    const completedDate = link?.completedSessionId
      ? completedSessionDates.get(link.completedSessionId)
      : null;
    if (link?.status === "completed" || completedDate) {
      summary.completed += 1;
      if (completedDate && completedDate > session.date) summary.late += 1;
      else summary.onTime += 1;
      continue;
    }
    if (link?.status === "skipped") {
      summary.skipped += 1;
      continue;
    }
    if (link && (link.status === "pending" || link.status === "accepted")) {
      summary.outstanding += 1;
      continue;
    }
    if (session.date < reviewEnd) summary.missed += 1;
    else summary.outstanding += 1;
  }

  summary.percentage = summary.due ? Math.round((summary.completed / summary.due) * 100) : null;
  return summary;
}
