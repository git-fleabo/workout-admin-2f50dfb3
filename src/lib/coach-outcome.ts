import type { CoachingRecommendationDecision } from "./supabase-coaching-recommendations.browser.ts";
import type {
  CoachOutcomeRating,
  WeeklyCoachDecisionHistory,
} from "./weekly-coach-recommendation.ts";

export type CoachOutcomeReview = {
  decisionId: string;
  recommendationType: CoachingRecommendationDecision["recommendationType"];
  sessionLabel: string;
  question: string;
  detail: string;
};

type CoachOutcomeLog = {
  id: string;
  completed: boolean;
  pain: string;
  rpe: string;
};

export type CoachOutcomeState = {
  history: WeeklyCoachDecisionHistory[];
  pendingReview: CoachOutcomeReview | null;
  inferredOutcomes: number;
};

function validMetric(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferCompletedOutcome(
  decision: CoachingRecommendationDecision,
  logs: CoachOutcomeLog[],
): CoachOutcomeRating | null {
  if (!decision.completedSessionId) return null;
  const completed = logs.filter((log) => log.id === decision.completedSessionId && log.completed);
  if (!completed.length) return null;
  const pain = completed.map((log) => validMetric(log.pain)).filter((value) => value != null);
  const effort = completed.map((log) => validMetric(log.rpe)).filter((value) => value != null);
  const maxPain = pain.length ? Math.max(...pain) : null;
  const maxEffort = effort.length ? Math.max(...effort) : null;

  if ((maxPain != null && maxPain > 0) || (maxEffort != null && maxEffort >= 9)) {
    return "too_hard";
  }
  if (maxPain === 0 && maxEffort != null && maxEffort >= 6 && maxEffort <= 8) {
    return "right";
  }
  if (maxPain === 0 && maxEffort != null && maxEffort <= 5) {
    return "too_easy";
  }
  return null;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function eligibleForOutcome(decision: CoachingRecommendationDecision, today: string) {
  if (decision.decision !== "accepted") return false;
  if (decision.recommendationType === "skip_support_session") {
    return decision.workoutStatus === "skipped" && today > addDays(decision.weekStart, 6);
  }
  return decision.workoutStatus === "completed" && Boolean(decision.completedSessionId);
}

function reviewCopy(
  decision: CoachingRecommendationDecision,
): Pick<CoachOutcomeReview, "question" | "detail"> {
  if (decision.recommendationType === "adjust_support_dose") {
    return {
      question: "How did this support dose feel?",
      detail:
        "The completed workout does not contain enough pain and effort evidence to judge it confidently.",
    };
  }
  if (decision.recommendationType === "move_session") {
    return {
      question: "How did the week feel after this move?",
      detail: "Your answer will help the coach judge similar schedule changes in later weeks.",
    };
  }
  return {
    question: "How did the week feel after reducing support?",
    detail:
      "Your answer will help the coach decide whether a similar reduction is useful next time.",
  };
}

export function buildCoachOutcomeState({
  decisions,
  logs,
  today,
}: {
  decisions: CoachingRecommendationDecision[];
  logs: CoachOutcomeLog[];
  today: string;
}): CoachOutcomeState {
  let inferredOutcomes = 0;
  const inferredByDecision = new Map<string, CoachOutcomeRating | null>();
  const history = decisions.map((decision) => {
    const inferred =
      decision.decision === "accepted" &&
      decision.recommendationType !== "skip_support_session" &&
      !decision.outcomeRating
        ? inferCompletedOutcome(decision, logs)
        : null;
    if (inferred) inferredOutcomes += 1;
    inferredByDecision.set(decision.id, inferred);
    return {
      ...decision,
      outcomeRating: decision.outcomeRating ?? inferred,
    };
  });
  const pending = decisions
    .filter(
      (decision) =>
        eligibleForOutcome(decision, today) &&
        !decision.outcomeRating &&
        !inferredByDecision.get(decision.id),
    )
    .sort((left, right) => left.decidedAt.localeCompare(right.decidedAt))[0];
  return {
    history,
    pendingReview: pending
      ? {
          decisionId: pending.id,
          recommendationType: pending.recommendationType,
          sessionLabel: pending.sessionLabel,
          ...reviewCopy(pending),
        }
      : null,
    inferredOutcomes,
  };
}
