import {
  Activity,
  BrainCircuit,
  CalendarDays,
  Dumbbell,
  HeartPulse,
  Info,
  Mountain,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { CoachSetupDialog } from "@/components/coach-setup-dialog";
import { CoachOutcomeReviewCard } from "@/components/coach-outcome-review-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WeeklyCoachRecommendationCard } from "@/components/weekly-coach-recommendation-card";
import { WeeklyCoachDraftDialog } from "@/components/weekly-coach-draft-dialog";
import { WeeklyCoachCapacitySummary } from "@/components/weekly-coach-capacity-summary";
import { WeeklyCoachAdaptationSummary } from "@/components/weekly-coach-adaptation-summary";
import type { CoachReadinessSnapshot, SupportDoseOpportunity } from "@/lib/coach-readiness";
import type { CoachOutcomeReview } from "@/lib/coach-outcome";
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
  type CoachOutcomeRating,
} from "@/lib/weekly-coach-recommendation";
import type { WeeklyPlan, WeeklyPlanAdjustments } from "@/lib/weekly-plan";
import type { WeeklyCoachDraft, WeeklyCoachDraftAddition } from "@/lib/weekly-coach-draft";
import { projectWeeklyCoachCapacity } from "@/lib/weekly-coach-capacity";

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

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
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
  readiness,
  doseOpportunities = [],
  decidedRecommendationKeys = [],
  recommendationHistory = [],
  recommendationPending = false,
  onRecommendationDecision,
  outcomeReview,
  outcomePending = false,
  onOutcomeReview,
  strengthReview,
  weekDraft,
  weekDraftPending = false,
  onApplyWeekDraft,
}: {
  plan: WeeklyPlan;
  programmeSessions: ProgrammeScheduleSession[];
  scheduledPlans: SavedWorkoutPlan[];
  adjustments: WeeklyPlanAdjustments;
  coachingPreferences?: CoachingPreferences;
  focusOptions?: CoachingFocusOption[];
  savingPreferences?: boolean;
  onSavePreferences?: (preferences: CoachingPreferences) => Promise<void>;
  readiness?: CoachReadinessSnapshot;
  doseOpportunities?: SupportDoseOpportunity[];
  decidedRecommendationKeys?: string[];
  recommendationHistory?: WeeklyCoachDecisionHistory[];
  recommendationPending?: boolean;
  onRecommendationDecision?: (
    recommendation: WeeklyCoachRecommendation,
    decision: "accepted" | "rejected",
    chosenDate?: string,
  ) => Promise<void>;
  outcomeReview?: CoachOutcomeReview | null;
  outcomePending?: boolean;
  onOutcomeReview?: (decisionId: string, rating: CoachOutcomeRating) => Promise<void>;
  strengthReview?: ReactNode;
  weekDraft?: WeeklyCoachDraft;
  weekDraftPending?: boolean;
  onApplyWeekDraft?: (additions: WeeklyCoachDraftAddition[]) => Promise<void>;
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
  const savedCapacity = useMemo(
    () =>
      weekDraft && coachingPreferences.saved
        ? projectWeeklyCoachCapacity(weekDraft.capacity, weekDraft.preferences, [])
        : null,
    [coachingPreferences.saved, weekDraft],
  );
  const recommendation = useMemo(
    () =>
      buildWeeklyCoachRecommendation({
        context,
        plan,
        preferences: coachingPreferences,
        scheduledPlans,
        doseOpportunities,
        decidedKeys: decidedRecommendationKeys,
        history: recommendationHistory,
        adaptation: weekDraft?.adaptation,
      }),
    [
      coachingPreferences,
      context,
      decidedRecommendationKeys,
      doseOpportunities,
      plan,
      recommendationHistory,
      scheduledPlans,
      weekDraft?.adaptation,
    ],
  );
  const reviewedOutcomeCount = recommendationHistory.filter((item) => item.outcomeRating).length;
  const reviewDays = plan.days.map((day) => ({
    date: day.date,
    sessions: context.sessions.filter((session) => session.date === day.date),
  }));
  const reviewItemCount =
    Number(Boolean(strengthReview)) + Number(Boolean(outcomeReview ?? recommendation));

  const priorityLabel = (focusId: string) => {
    if (!coachingPreferences.saved) return focusId === "programme" ? "Programme" : null;
    if (focusId === coachingPreferences.primaryFocusId) return "Primary";
    if (coachingPreferences.secondaryFocusIds.includes(focusId)) return "Supporting";
    if (coachingPreferences.maintenanceFocusIds.includes(focusId)) return "Maintenance";
    if (focusId === "programme") return "Programme";
    return null;
  };

  return (
    <Card className="space-y-4 border-blue-400/25 bg-blue-400/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-blue-300" />
            <h2 className="font-semibold">Weekly coach review</h2>
            <Badge variant="outline">
              {coachingPreferences.saved ? "Coach active" : "Read only"}
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium">{context.headline}</p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Review the complete saved week and every proposed coaching change before applying
            anything.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right text-xs text-muted-foreground">
          <div>
            <p>
              {formatUKDateShort(context.startDate)}–{formatUKDateShort(context.endDate)}
            </p>
            <p className="mt-1 capitalize">{context.confidence} planning confidence</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {weekDraft && coachingPreferences.saved && onApplyWeekDraft ? (
              <WeeklyCoachDraftDialog
                draft={weekDraft}
                existingSessions={context.sessions}
                saving={weekDraftPending}
                onApply={onApplyWeekDraft}
              />
            ) : null}
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
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-background/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-300" />
            <p className="text-sm font-semibold">Exact upcoming week</p>
          </div>
          <Badge variant="outline">
            {context.sessions.length} saved session{context.sessions.length === 1 ? "" : "s"}
          </Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {reviewDays.map((day) => (
            <div key={day.date} className="rounded-lg border border-border/70 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {dayLabel(day.date)}
              </p>
              {day.sessions.length ? (
                <div className="mt-2 space-y-2">
                  {day.sessions.map((session) => {
                    const view = KIND_VIEW[session.kind];
                    const Icon = view.icon;
                    const priority = priorityLabel(session.focusId);
                    return (
                      <div key={session.id}>
                        <p className="text-xs font-medium leading-snug">{session.label}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline" className={view.className}>
                            <Icon className="mr-1 h-3 w-3" /> {view.label}
                          </Badge>
                          {priority ? <Badge variant="secondary">{priority}</Badge> : null}
                          {session.completed ? <Badge variant="secondary">Done</Badge> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Open</p>
              )}
            </div>
          ))}
        </div>
        {context.expectations.length ? (
          <p className="text-[11px] text-muted-foreground">
            {context.expectations.length} learned expectation
            {context.expectations.length === 1 ? " is" : "s are"} excluded from this exact view
            until you save a session.
          </p>
        ) : null}
      </div>

      {savedCapacity ? (
        <WeeklyCoachCapacitySummary capacity={savedCapacity} title="Saved weekly capacity" />
      ) : null}

      {weekDraft?.adaptation && coachingPreferences.saved ? (
        <WeeklyCoachAdaptationSummary adaptation={weekDraft.adaptation} />
      ) : null}

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
            {reviewedOutcomeCount ? (
              <Badge variant="outline">
                {reviewedOutcomeCount} outcome{reviewedOutcomeCount === 1 ? "" : "s"} understood
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

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Changes to review</p>
          <Badge variant="outline">
            {reviewItemCount ? `${reviewItemCount} available` : "No change currently needed"}
          </Badge>
        </div>

        {strengthReview}

        {outcomeReview && onOutcomeReview ? (
          <CoachOutcomeReviewCard
            review={outcomeReview}
            pending={outcomePending}
            onReview={onOutcomeReview}
          />
        ) : coachingPreferences.saved && onRecommendationDecision ? (
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
                ? "Your schedule or support decision for this week is recorded."
                : "No safe schedule or support change is suggested from the current saved week."}
            </div>
          )
        ) : null}
      </div>

      <details className="rounded-xl border border-border bg-background/15 p-3">
        <summary className="cursor-pointer text-sm font-medium">Why the coach thinks this</summary>
        <div className="mt-3 space-y-3">
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

          {readiness ? (
            <div className="space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-cyan-300" />
                    <p className="text-sm font-semibold">Readiness evidence</p>
                  </div>
                  <p className="mt-2 text-sm font-medium">{readiness.title}</p>
                  <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{readiness.detail}</p>
                </div>
                <Badge variant="outline" className="border-cyan-400/30 text-cyan-200">
                  {readiness.status === "ready"
                    ? "Ready to review"
                    : readiness.status === "reduce"
                      ? "Reduce"
                      : readiness.status === "hold"
                        ? "Hold"
                        : "Building evidence"}
                </Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {readiness.evidence.map((item) => (
                  <p
                    key={item}
                    className="rounded-lg border border-border/70 bg-background/25 p-2.5 text-xs text-muted-foreground"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <p className="text-xs text-muted-foreground">
        Draft my week follows the current adaptive stance when filling missing priorities. The coach
        can propose one reviewed frequency, dose or placement change at a time; your strength
        programme stays separate. Completed changes are checked against logged evidence, and one
        short check-in fills any important gap.
      </p>
    </Card>
  );
}
