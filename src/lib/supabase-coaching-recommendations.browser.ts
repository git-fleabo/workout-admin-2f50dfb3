import { getCurrentPerson } from "./supabase-people.browser";
import { supabasePublicRpc, supabasePublicSelect } from "./supabase-public";
import type {
  WeeklyCoachDecisionHistory,
  WeeklyCoachRecommendation,
  WeeklyCoachRecommendationType,
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
  decided_at: string;
};

export type CoachingRecommendationDecision = WeeklyCoachDecisionHistory & {
  id: string;
  recommendationKey: string;
  originalDate: string;
  decidedAt: string;
};

async function requirePerson() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Connect your training profile first.");
  return person;
}

export async function listCoachingRecommendationDecisionsClient(throughWeek: string) {
  const person = await requirePerson();
  const rows = await supabasePublicSelect<RecommendationDecisionRow>(
    "coaching_recommendation_decisions",
    {
      select:
        "id,week_start,recommendation_key,recommendation_type,subject_focus_id,decision,original_date,proposed_date,chosen_date,decided_at",
      person_id: `eq.${person.id}`,
      week_start: `lte.${throughWeek}`,
      order: "decided_at.desc",
      limit: 100,
    },
  );
  return rows.map((row) => ({
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
  }));
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
