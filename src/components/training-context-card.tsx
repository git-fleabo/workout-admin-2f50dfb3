import {
  Activity,
  BrainCircuit,
  Dumbbell,
  HeartPulse,
  Info,
  Mountain,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useMemo } from "react";

import { CoachSetupDialog } from "@/components/coach-setup-dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WeeklyCoachRecommendationCard } from "@/components/weekly-coach-recommendation-card";
import {
  DEFAULT_COACHING_PREFERENCES,
  type CoachingFocusOption,
  type CoachingPreferences,
} from "@/lib/coaching-preferences";
import { formatUKDateShort } from "@/lib/date";
import type { SavedWorkoutPlan } from "@/lib/supabase-plans.browser";
import type { ProgrammeScheduleSession } from "@/lib/supabase-programmes.browser";
import {
  buildTrainingContext,
  type TrainingContextKind,
  type TrainingContextSignal,
} from "@/lib/training-context";
import {
  buildWeeklyCoachRecommendation,
  type WeeklyCoachDecisionHistory,
  type WeeklyCoachRecommendation,
} from "@/lib/weekly-coach-recommendation";
import type { WeeklyPlan, WeeklyPlanAdjustments } from "@/lib/weekly-plan";

const KIND_VIEW: Record<
  TrainingContextKind,
  { label: string; icon: typeof Dumbbell; className: string }
> = {
  strength: {
    label: "Strength",
    icon: Dumbbell,
    className: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  },
  climbing: {
    label: "Climbing",
    icon: Mountain,
    className: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  },
  conditioning: {
    label: "Conditioning",
    icon: Activity,
    className: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  },
  skill: {
    label: "Skill",
    icon: Sparkles,
    className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  },
  mobility: {
    label: "Mobility / recovery",
    icon: HeartPulse,
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  },
  other: {
    label: "Other",
    icon: Activity,
    className: "border-border bg-secondary/40 text-muted-foreground",
  },
};

function SignalIcon({ tone }: { tone: TrainingContextSignal["tone"] }) {
  if (tone === "caution") return <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-300" />;
  if (tone === "positive") return <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300" />;
  return <Info className="mt-0.5 h-4 w-4 text-sky-300" />;
}

export function TrainingContextCard({
  plan,
  programmeSessions,
  scheduledPlans,
  adjustments,
  coachingPreferences = DEFAULT_COACHING_PREFERENCES,
  focusOptions = [
    {
      id: "programme",
      label: "Current strength programme",
      description: "Progress the programme you are currently running.",
    },
  ],
  savingPreferences = false,
  onSavePreferences,
  decidedRecommendationKeys = [],
  recommendationHistory = [],
  recommendationPending = false,
  onRecommendationDecision,
}: {
  plan: WeeklyPlan;
  programmeSessions: ProgrammeScheduleSession[];
  scheduledPlans: SavedWorkoutPlan[];
  adjustments: WeeklyPlanAdjustments;
  coachingPreferences?: CoachingPreferences;
  focusOptions?: CoachingFocusOption[];
  savingPreferences?: boolean;
  onSavePreferences?: (preferences: CoachingPreferences) => Promise<void>;
  decidedRecommendationKeys?: string[];
  recommendationHistory?: WeeklyCoachDecisionHistory[];
  recommendationPending?: boolean;
  onRecommendationDecision?: (
    recommendation: WeeklyCoachRecommendation,
    decision: "accepted" | "rejected",
    chosenDate?: string,
  ) => Promise<void>;
}) {
  const focusLabels = useMemo(
    () => Object.fromEntries(focusOptions.map((option) => [option.id, option.label])),
    [focusOptions],
  );
  const context = useMemo(
    () =>
      buildTrainingContext({
        plan,
        programmeSessions,
        scheduledPlans,
        adjustments,
        coaching: { preferences: coachingPreferences, focusLabels },
      }),
    [adjustments, coachingPreferences, focusLabels, plan, programmeSessions, scheduledPlans],
  );
  const visibleKinds = (Object.keys(KIND_VIEW) as TrainingContextKind[]).filter(
    (kind) => context.counts[kind] > 0,
  );
  const recommendation = useMemo(
    () =>
      buildWeeklyCoachRecommendation({
        context,
        plan,
        preferences: coachingPreferences,
        scheduledPlans,
        decidedKeys: decidedRecommendationKeys,
        history: recommendationHistory,
      }),
    [
      coachingPreferences,
      context,
      decidedRecommendationKeys,
      plan,
      recommendationHistory,
      scheduledPlans,
    ],
  );

  return (
    <Card className="space-y-4 border-blue-400/25 bg-blue-400/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-blue-300" />
            <h2 className="font-semibold">Training context</h2>
            <Badge variant="outline">
              {coachingPreferences.saved ? "Coach active" : "Read only"}
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium">{context.headline}</p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            One view of booked strength, climbing, conditioning, skills and recovery. It explains
            the current week without changing your programme.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right text-xs text-muted-foreground">
          <div>
            <p>
              {formatUKDateShort(context.startDate)}–{formatUKDateShort(context.endDate)}
            </p>
            <p className="mt-1 capitalize">{context.confidence} planning confidence</p>
          </div>
          {onSavePreferences ? (
            <CoachSetupDialog
              preferences={coachingPreferences}
              focusOptions={focusOptions}
              saving={savingPreferences}
              onSave={onSavePreferences}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {coachingPreferences.saved ? (
          <>
            <Badge variant="outline" className="border-blue-400/30 bg-blue-400/10 text-blue-200">
              Primary: {focusLabels[coachingPreferences.primaryFocusId] ?? "Saved focus"}
            </Badge>
            <Badge variant="outline">
              {coachingPreferences.weeklyTrainingDays} days · {coachingPreferences.weeklyMinutes}{" "}
              min
            </Badge>
            <Badge variant="outline">
              Max {coachingPreferences.maxDemandingDays} demanding days
            </Badge>
            {recommendationHistory.length ? (
              <Badge variant="outline">
                Learned from {recommendationHistory.length} review
                {recommendationHistory.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </>
        ) : null}
        {visibleKinds.map((kind) => {
          const view = KIND_VIEW[kind];
          const Icon = view.icon;
          return (
            <Badge key={kind} variant="outline" className={view.className}>
              <Icon className="mr-1 h-3 w-3" /> {view.label} {context.counts[kind]}
            </Badge>
          );
        })}
        <Badge variant="outline">{context.openDays} unbooked days</Badge>
        {context.expectations.length ? (
          <Badge variant="outline">{context.expectations.length} learned expectations</Badge>
        ) : null}
      </div>

      {context.signals.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {context.signals.map((signal) => (
            <div
              key={`${signal.title}:${signal.detail}`}
              className="flex gap-2 rounded-lg border border-border p-3"
            >
              <SignalIcon tone={signal.tone} />
              <div>
                <p className="text-sm font-medium">{signal.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Save sessions or adjust the weekly plan to give the coach more concrete context.
        </p>
      )}

      {coachingPreferences.saved && onRecommendationDecision ? (
        recommendation ? (
          <WeeklyCoachRecommendationCard
            recommendation={recommendation}
            pending={recommendationPending}
            onDecision={(decision, chosenDate) =>
              onRecommendationDecision(recommendation, decision, chosenDate)
            }
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            {decidedRecommendationKeys.length
              ? "Your coaching decision for this week is recorded."
              : "No safe session move is suggested from the current saved schedule."}
          </div>
        )
      ) : null}

      <p className="text-xs text-muted-foreground">
        The coach checks this week against your saved priorities and capacity. It can propose one
        reviewed schedule change or maintenance reduction, but applies it only after you accept.
        Readiness remains deferred.
      </p>
    </Card>
  );
}
