import { getCurrentPerson } from "./supabase-people.browser";
import { supabasePublicRpc, supabasePublicSelect } from "./supabase-public";
import type { WeeklyCoachRecommendation } from "./weekly-coach-recommendation";

type RecommendationDecisionRow = {
  id: string;
  recommendation_key: string;
  decision: "accepted" | "rejected";
  proposed_date: string;
  chosen_date: string | null;
  decided_at: string;
};

export type CoachingRecommendationDecision = {
  id: string;
  recommendationKey: string;
  decision: "accepted" | "rejected";
  proposedDate: string;
  chosenDate: string | null;
  decidedAt: string;
};

async function requirePerson() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Connect your training profile first.");
  return person;
}

export async function listCoachingRecommendationDecisionsClient(weekStart: string) {
  const person = await requirePerson();
  const rows = await supabasePublicSelect<RecommendationDecisionRow>(
    "coaching_recommendation_decisions",
    {
      select: "id,recommendation_key,decision,proposed_date,chosen_date,decided_at",
      person_id: `eq.${person.id}`,
      week_start: `eq.${weekStart}`,
      order: "decided_at.desc",
    },
  );
  return rows.map((row) => ({
    id: row.id,
    recommendationKey: row.recommendation_key,
    decision: row.decision,
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
  return supabasePublicRpc<string>("decide_coaching_recommendation", {
    p_recommendation_key: recommendation.key,
    p_suggested_workout_id: recommendation.suggestedWorkoutId,
    p_week_start: weekStart,
    p_original_date: recommendation.fromDate,
    p_proposed_date: recommendation.proposedDate,
    p_chosen_date: decision === "accepted" ? (chosenDate ?? recommendation.proposedDate) : null,
    p_decision: decision,
    p_rationale: recommendation.rationale,
  });
}
