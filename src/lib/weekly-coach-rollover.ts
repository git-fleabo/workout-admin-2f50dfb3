import type { CoachingPreferences } from "./coaching-preferences.ts";

export type WeeklyCoachRolloverStatus = "steady" | "lighter" | "rebuild";

export type WeeklyCoachRollover = {
  previousWeekStart: string;
  previousWeekEnd: string;
  status: WeeklyCoachRolloverStatus;
  title: string;
  detail: string;
  evidence: string[];
  plannedSessions: number;
  completedSessions: number;
  adherencePercent: number | null;
  additionLimit: 1 | 2;
};

export type WeeklyCoachRolloverInput = {
  weekStart: string;
  weekEnd: string;
  isCompleteWeek: boolean;
  summary: {
    sessions: number;
    activeDays: number;
    minutes: number;
    hardDays: number;
  };
  adherence: {
    total: number;
    completed: number;
  };
  programmeAdherence: {
    due: number;
    completed: number;
  };
};

export function buildWeeklyCoachRollover({
  review,
  preferences,
}: {
  review: WeeklyCoachRolloverInput;
  preferences: CoachingPreferences;
}): WeeklyCoachRollover | null {
  if (!review.isCompleteWeek || !preferences.saved) return null;
  const plannedSessions = review.adherence.total + review.programmeAdherence.due;
  const completedSessions = review.adherence.completed + review.programmeAdherence.completed;
  const adherencePercent = plannedSessions
    ? Math.round((completedSessions / plannedSessions) * 100)
    : null;
  const exceededCapacity =
    review.summary.activeDays > preferences.weeklyTrainingDays ||
    review.summary.minutes > preferences.weeklyMinutes * 1.1 ||
    review.summary.hardDays > preferences.maxDemandingDays;
  const needsRebuild =
    review.summary.sessions === 0 || (adherencePercent != null && adherencePercent < 60);
  const status: WeeklyCoachRolloverStatus = needsRebuild
    ? "rebuild"
    : exceededCapacity
      ? "lighter"
      : "steady";
  const evidence = [
    plannedSessions
      ? `${completedSessions} of ${plannedSessions} planned sessions completed`
      : `${review.summary.sessions} completed session${review.summary.sessions === 1 ? "" : "s"} with no saved plan`,
    `${review.summary.activeDays} active day${review.summary.activeDays === 1 ? "" : "s"} · ${review.summary.minutes} minutes`,
    `${review.summary.hardDays} demanding day${review.summary.hardDays === 1 ? "" : "s"}`,
  ];

  if (status === "rebuild") {
    return {
      previousWeekStart: review.weekStart,
      previousWeekEnd: review.weekEnd,
      status,
      title: "Rebuild from one clear supporting action",
      detail:
        "Last week was not completed reliably enough to add several new commitments. Keep the strength programme obvious and add at most one short priority.",
      evidence,
      plannedSessions,
      completedSessions,
      adherencePercent,
      additionLimit: 1,
    };
  }
  if (status === "lighter") {
    return {
      previousWeekStart: review.weekStart,
      previousWeekEnd: review.weekEnd,
      status,
      title: "Keep this rollover lighter",
      detail:
        "Last week exceeded at least one saved capacity limit. Carry the programme forward and add at most one supporting priority.",
      evidence,
      plannedSessions,
      completedSessions,
      adherencePercent,
      additionLimit: 1,
    };
  }
  return {
    previousWeekStart: review.weekStart,
    previousWeekEnd: review.weekEnd,
    status,
    title: "Carry the plan forward steadily",
    detail:
      "Last week stayed within your saved capacity and was completed consistently enough to include up to two missing priorities.",
    evidence,
    plannedSessions,
    completedSessions,
    adherencePercent,
    additionLimit: 2,
  };
}
