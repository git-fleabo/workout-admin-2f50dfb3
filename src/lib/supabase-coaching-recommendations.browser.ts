import { getCurrentPerson } from "./supabase-people.browser";
import { supabasePublicRpc, supabasePublicSelect } from "./supabase-public";
import type {
  WeeklyCoachDecisionHistory,
  WeeklyCoachRecommendation,
  WeeklyCoachRecommendationType,
  CoachOutcomeRating,
} from "./weekly-coach-recommendation";

type RecommendationDecisionRow = {
  id: string;
  week_start: string;
  recommendation_key: string;
  recommendation_type: WeeklyCoachRecommendationType;
  subject_focus_id: string;
  decision: "accepted" | "rejected";
  original_date: string;
  proposed_date: string;
  chosen_date: string | null;
  action_details: Record<string, unknown> | null;
  decided_at: string;
  suggested_workouts: {
    title: string;
    status: string;
    completed_session_id: string | null;
  } | null;
};

type RecommendationOutcomeRow = {
  decision_id: string;
  outcome_rating: CoachOutcomeRating;
  recorded_at: string;
};

export type CoachingRecommendationDecision = WeeklyCoachDecisionHistory & {
  id: string;
  recommendationKey: string;
  originalDate: string;
  decidedAt: string;
  sessionLabel: string;
  workoutStatus: string;
  completedSessionId: string | null;
  outcomeRating: CoachOutcomeRating | null;
  outcomeRecordedAt: string | null;
  adjustment: "progress" | "reduce" | null;
};

async function requirePerson() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Connect your training profile first.");
  return person;
}

export async function listCoachingRecommendationDecisionsClient(throughWeek: string) {
  const person = await requirePerson();
  const [rows, outcomes] = await Promise.all([
    supabasePublicSelect<RecommendationDecisionRow>("coaching_recommendation_decisions", {
      select:
        "id,week_start,recommendation_key,recommendation_type,subject_focus_id,decision,original_date,proposed_date,chosen_date,action_details,decided_at,suggested_workouts!inner(title,status,completed_session_id)",
      person_id: `eq.${person.id}`,
      week_start: `lte.${throughWeek}`,
      order: "decided_at.desc",
      limit: 100,
    }),
    supabasePublicSelect<RecommendationOutcomeRow>("coaching_recommendation_outcomes", {
      select: "decision_id,outcome_rating,recorded_at",
      order: "recorded_at.desc",
      limit: 100,
    }),
  ]);
  const outcomeByDecision = new Map(outcomes.map((outcome) => [outcome.decision_id, outcome]));
  return rows.map<CoachingRecommendationDecision>((row) => ({
    id: row.id,
    weekStart: row.week_start,
    recommendationKey: row.recommendation_key,
    recommendationType: row.recommendation_type,
    subjectFocusId: row.subject_focus_id,
    decision: row.decision,
    originalDate: row.original_date,
    proposedDate: row.proposed_date,
    chosenDate: row.chosen_date,
    decidedAt: row.decided_at,
    sessionLabel: row.suggested_workouts?.title ?? "Reviewed session",
    workoutStatus: row.suggested_workouts?.status ?? "unknown",
    completedSessionId: row.suggested_workouts?.completed_session_id ?? null,
    outcomeRating: outcomeByDecision.get(row.id)?.outcome_rating ?? null,
    outcomeRecordedAt: outcomeByDecision.get(row.id)?.recorded_at ?? null,
    adjustment:
      row.action_details?.adjustment === "progress" || row.action_details?.adjustment === "reduce"
        ? row.action_details.adjustment
        : null,
  }));
}

export async function recordCoachingRecommendationOutcomeClient({
  decisionId,
  rating,
}: {
  decisionId: string;
  rating: CoachOutcomeRating;
}) {
  return supabasePublicRpc<string>("record_coaching_recommendation_outcome", {
    p_decision_id: decisionId,
    p_outcome_rating: rating,
  });
}

export async function decideCoachingRecommendationClient({
  recommendation,
  weekStart,
  decision,
  chosenDate,
}: {
  recommendation: WeeklyCoachRecommendation;
  weekStart: string;
  decision: "accepted" | "rejected";
  chosenDate?: string;
}) {
  return supabasePublicRpc<string>("decide_coaching_recommendation_v3", {
    p_recommendation_type: recommendation.type,
    p_recommendation_key: recommendation.key,
    p_suggested_workout_id: recommendation.suggestedWorkoutId,
    p_week_start: weekStart,
    p_original_date: recommendation.fromDate,
    p_proposed_date: recommendation.proposedDate,
    p_chosen_date:
      decision === "accepted" && recommendation.type === "move_session"
        ? (chosenDate ?? recommendation.proposedDate)
        : null,
    p_decision: decision,
    p_rationale: recommendation.rationale,
    p_action_details:
      recommendation.type === "adjust_support_dose"
        ? {
            adjustment: recommendation.adjustment,
            from_sets: recommendation.currentSets,
            from_value: recommendation.currentValue,
            target_sets: recommendation.targetSets,
            target_value: recommendation.targetValue,
            dose_unit: recommendation.doseUnit,
          }
        : {},
  });
}
