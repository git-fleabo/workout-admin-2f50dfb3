import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  CirclePause,
  Dumbbell,
  ExternalLink,
  Flag,
  Gauge,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  Trophy,
  UserCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateGoalProgress, type GoalProgress } from "@/lib/goal-progress";
import {
  getGoalMetricOptions,
  goalMetricLabel,
  goalTypeLabel,
  GOAL_TYPE_OPTIONS,
} from "@/lib/goal-model";
import { formatUKDateShort, todayISO } from "@/lib/date";
import { getMovementMetricProfile, getTrackingModeLabel } from "@/lib/movement-metrics";
import {
  addGoalCheckinClient,
  addGoalClient,
  claimNoamProfile,
  deleteGoalCheckinClient,
  deleteGoalClient,
  getGoalActivityClient,
  listGoalsClient,
  updateGoalClient,
  updateGoalStatusClient,
  type GoalFields,
} from "@/lib/supabase-goals.browser";
import { getExerciseHistoryClient } from "@/lib/supabase-history.browser";
import { getLibraryClient } from "@/lib/supabase-log.browser";
import type { GoalMetric, GoalRow, GoalStatus, GoalType, LibraryRow } from "@/lib/training-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals · Training Tracker" },
      {
        name: "description",
        content: "Set, structure and track training goals stored in Supabase.",
      },
    ],
  }),
  component: GoalsPage,
});

const PERIODS = ["week", "month", "quarter", "year", "static"] as const;
const STATUS_TABS: Array<{ value: GoalStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "complete", label: "Completed" },
  { value: "archived", label: "Archived" },
];
const PERIOD_LABELS: Record<string, string> = {
  week: "This week",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
  static: "Long-term",
  other: "Other",
};
const PERIOD_ORDER = ["week", "month", "quarter", "year", "static", "other"];

type EditorState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; row: GoalRow };
type GoalExercise = Omit<LibraryRow, "row"> & {
  id: string;
  locationScope: "home" | "gym" | "both";
};
type GoalFormState = {
  goal: string;
  goalType: GoalType;
  exerciseId: string;
  goalMetric: GoalMetric | "";
  targetValue: string;
  targetUnit: string;
  startingValue: string;
  period: string;
  deadline: string;
  notes: string;
  legacyTarget: string;
  legacyMetric: string;
};

const BLANK: GoalFormState = {
  goal: "",
  goalType: "consistency",
  exerciseId: "",
  goalMetric: "sessions",
  targetValue: "",
  targetUnit: "sessions",
  startingValue: "",
  period: "week",
  deadline: "",
  notes: "",
  legacyTarget: "",
  legacyMetric: "",
};

function GoalsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["goals"], queryFn: () => listGoalsClient() });
  const library = useQuery({
    queryKey: ["goals-library"],
    queryFn: getLibraryClient,
    staleTime: 5 * 60_000,
  });
  const activity = useQuery({
    queryKey: ["goal-activity"],
    queryFn: getGoalActivityClient,
    staleTime: 60_000,
  });

  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [pendingDelete, setPendingDelete] = useState<GoalRow | null>(null);
  const [statusTab, setStatusTab] = useState<GoalStatus>("active");
  const exercises = useMemo(
    () => (library.data?.exercises ?? []) as GoalExercise[],
    [library.data?.exercises],
  );
  const exerciseById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );
  const items = useMemo(() => list.data?.items ?? [], [list.data?.items]);
  const linkedExercises = useMemo(() => {
    const linked = new Map<string, GoalExercise>();
    for (const goal of items) {
      if (!goal.exerciseId || (goal.goalType !== "performance" && goal.goalType !== "duration")) {
        continue;
      }
      const exercise = exerciseById.get(goal.exerciseId);
      if (exercise) linked.set(exercise.id, exercise);
    }
    return Array.from(linked.values());
  }, [exerciseById, items]);
  const historyQueries = useQueries({
    queries: linkedExercises.map((exercise) => ({
      queryKey: ["goal-exercise-progress", exercise.id],
      queryFn: () => getExerciseHistoryClient({ id: exercise.id, name: exercise.name }),
      staleTime: 60_000,
    })),
  });
  const historyByExerciseId = useMemo(
    () =>
      new Map(
        linkedExercises.flatMap((exercise, index) => {
          const history = historyQueries[index]?.data;
          return history ? [[exercise.id, history] as const] : [];
        }),
      ),
    [historyQueries, linkedExercises],
  );
  const loadingHistoryIds = useMemo(
    () =>
      new Set(
        linkedExercises
          .filter((_, index) => historyQueries[index]?.isLoading)
          .map((exercise) => exercise.id),
      ),
    [historyQueries, linkedExercises],
  );
  const failedHistoryIds = useMemo(
    () =>
      new Set(
        linkedExercises
          .filter((_, index) => historyQueries[index]?.isError)
          .map((exercise) => exercise.id),
      ),
    [historyQueries, linkedExercises],
  );
  const goalProgressById = useMemo(
    () =>
      new Map(
        items.map((goal) => [
          goal.id,
          calculateGoalProgress({
            goal,
            activitySessions: activity.data,
            exerciseHistory: historyByExerciseId.get(goal.exerciseId),
          }),
        ]),
      ),
    [activity.data, historyByExerciseId, items],
  );

  const refreshGoalViews = () => {
    qc.invalidateQueries({ queryKey: ["goals"] });
    qc.invalidateQueries({ queryKey: ["goal-activity"] });
    qc.invalidateQueries({ queryKey: ["goal-exercise-progress"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const addMutation = useMutation({
    mutationFn: (fields: GoalFields) => addGoalClient(fields),
    onSuccess: () => {
      toast.success("Goal added");
      setEditor({ mode: "closed" });
      refreshGoalViews();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: GoalFields }) =>
      updateGoalClient(id, fields),
    onSuccess: () => {
      toast.success("Goal updated");
      setEditor({ mode: "closed" });
      refreshGoalViews();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: GoalStatus }) =>
      updateGoalStatusClient(id, status),
    onSuccess: (_, variables) => {
      const message =
        variables.status === "complete"
          ? "Goal completed"
          : variables.status === "paused"
            ? "Goal paused"
            : variables.status === "archived"
              ? "Goal archived"
              : "Goal reactivated";
      toast.success(message);
      refreshGoalViews();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGoalClient(id),
    onSuccess: () => {
      toast.success("Goal deleted");
      setPendingDelete(null);
      refreshGoalViews();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkinMutation = useMutation({
    mutationFn: (goalId: string) => addGoalCheckinClient(goalId, todayISO()),
    onSuccess: () => {
      toast.success("Goal marked off");
      refreshGoalViews();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCheckinMutation = useMutation({
    mutationFn: (id: string) => deleteGoalCheckinClient(id),
    onSuccess: () => {
      toast.success("Check-in removed");
      refreshGoalViews();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const claimMutation = useMutation({
    mutationFn: () => claimNoamProfile(),
    onSuccess: () => {
      toast.success("Profile connected");
      refreshGoalViews();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(
    () =>
      STATUS_TABS.reduce(
        (result, status) => {
          result[status.value] = items.filter((item) => item.status === status.value).length;
          return result;
        },
        {} as Record<GoalStatus, number>,
      ),
    [items],
  );
  const grouped = useMemo(() => {
    const buckets = new Map<string, GoalRow[]>();
    for (const item of items.filter((goal) => goal.status === statusTab)) {
      const rawPeriod = (item.period || "other").toLowerCase();
      const key = PERIOD_ORDER.includes(rawPeriod) ? rawPeriod : "other";
      const bucket = buckets.get(key) ?? [];
      bucket.push(item);
      buckets.set(key, bucket);
    }
    return Array.from(buckets.entries()).sort(
      (a, b) => PERIOD_ORDER.indexOf(a[0]) - PERIOD_ORDER.indexOf(b[0]),
    );
  }, [items, statusTab]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Goals</h2>
          <p className="text-xs text-muted-foreground">
            Automatic progress from completed workouts, with manual check-ins where needed
          </p>
        </div>
        <Button
          onClick={() => setEditor({ mode: "create" })}
          className="h-10 shrink-0 font-medium"
          style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add goal
        </Button>
      </div>

      {list.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading goals…
        </div>
      ) : list.data?.needsProfileClaim ? (
        <Card className="space-y-4 border-border bg-card p-5">
          <div>
            <h3 className="text-sm font-semibold">Connect your profile</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Link this Supabase login to Noam&apos;s imported training data.
            </p>
          </div>
          <Button
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
            className="h-10 font-medium"
            style={{
              backgroundImage: "var(--gradient-primary)",
              color: "var(--primary-foreground)",
            }}
          >
            {claimMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <UserCheck className="mr-1 h-4 w-4" />
            )}
            Connect profile
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="space-y-3 p-6 text-sm text-muted-foreground">
          <Target className="h-6 w-6 text-primary" />
          <div>
            <p className="font-medium text-foreground">No goals yet</p>
            <p className="mt-1">Add a consistency, performance, duration or milestone goal.</p>
          </div>
        </Card>
      ) : (
        <>
          <Tabs value={statusTab} onValueChange={(value) => setStatusTab(value as GoalStatus)}>
            <TabsList className="grid h-auto w-full grid-cols-4">
              {STATUS_TABS.map((status) => (
                <TabsTrigger
                  key={status.value}
                  value={status.value}
                  className="gap-1 px-2 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">{status.label}</span>
                  <span className="sm:hidden">{status.label.slice(0, 4)}</span>
                  <span className="text-[10px] text-muted-foreground">{counts[status.value]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {grouped.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              No {STATUS_TABS.find((status) => status.value === statusTab)?.label.toLowerCase()}{" "}
              goals.
            </Card>
          ) : (
            <div className="space-y-5">
              {grouped.map(([period, periodItems]) => (
                <section key={period} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {PERIOD_LABELS[period] ?? period}
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      {periodItems.length} {periodItems.length === 1 ? "goal" : "goals"}
                    </span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {periodItems.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        exercise={exerciseById.get(goal.exerciseId)}
                        progress={goalProgressById.get(goal.id)}
                        progressLoading={
                          activity.isLoading ||
                          (Boolean(goal.exerciseId) && loadingHistoryIds.has(goal.exerciseId))
                        }
                        progressError={
                          (goal.goalType === "consistency" && activity.isError) ||
                          (Boolean(goal.exerciseId) && failedHistoryIds.has(goal.exerciseId))
                        }
                        onEdit={() => setEditor({ mode: "edit", row: goal })}
                        onDelete={() => setPendingDelete(goal)}
                        onStatus={(status) => statusMutation.mutate({ id: goal.id, status })}
                        onCheckin={() => checkinMutation.mutate(goal.id)}
                        onDeleteCheckin={(id) => deleteCheckinMutation.mutate(id)}
                        checkinPending={
                          checkinMutation.variables === goal.id && checkinMutation.isPending
                        }
                        deletingCheckinId={
                          deleteCheckinMutation.isPending ? deleteCheckinMutation.variables : null
                        }
                        statusPending={
                          statusMutation.variables?.id === goal.id && statusMutation.isPending
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <GoalEditorDialog
        state={editor}
        exercises={exercises}
        onClose={() => setEditor({ mode: "closed" })}
        onSubmit={(fields) => {
          if (editor.mode === "create") {
            addMutation.mutate(fields);
          } else if (editor.mode === "edit") {
            updateMutation.mutate({ id: editor.row.id, fields });
          }
        }}
        isPending={addMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this goal permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.goal} and its check-in history will be removed from Supabase. Archive
              it instead if you may want it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GoalCard({
  goal,
  exercise,
  progress,
  progressLoading,
  progressError,
  onEdit,
  onDelete,
  onStatus,
  onCheckin,
  onDeleteCheckin,
  checkinPending,
  deletingCheckinId,
  statusPending,
}: {
  goal: GoalRow;
  exercise?: GoalExercise;
  progress?: GoalProgress;
  progressLoading: boolean;
  progressError: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (status: GoalStatus) => void;
  onCheckin: () => void;
  onDeleteCheckin: (id: string) => void;
  checkinPending: boolean;
  deletingCheckinId: string | null;
  statusPending: boolean;
}) {
  const todayCheckin = goal.checkins.find((checkin) => checkin.date === todayISO());
  const unit = goal.targetUnit || goal.metric || "check-ins";
  const targetLabel =
    goal.goalType === "milestone"
      ? "Complete"
      : progress?.target
        ? formatGoalValue(progress.target, unit)
        : [goal.target, goal.metric].filter(Boolean).join(" ") || "No target";
  const currentLabel =
    progress?.value != null ? formatGoalValue(progress.value, unit) : progressLoading ? "…" : "—";
  const manualProgress = progress && !progress.automatic;

  return (
    <Card className="overflow-hidden border-border bg-card">
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <GoalTypeIcon type={goal.goalType} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{goal.goal}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="px-1.5 py-0 font-medium">
                    {goalTypeLabel(goal.goalType)}
                  </Badge>
                  {progress?.automatic && (
                    <Badge
                      variant="secondary"
                      className="border-transparent px-1.5 py-0 font-medium"
                    >
                      Automatic
                    </Badge>
                  )}
                  {exercise && (
                    <span className="inline-flex items-center gap-1">
                      <Dumbbell className="h-3 w-3" />
                      {exercise.name}
                    </span>
                  )}
                  {goal.deadline && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      By {formatUKDateShort(goal.deadline)}
                    </span>
                  )}
                </div>
              </div>
              <GoalMenu
                goal={goal}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatus={onStatus}
                disabled={statusPending}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-secondary/25 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Current{" "}
                {goal.goalMetric ? goalMetricLabel(goal.goalMetric).toLowerCase() : "progress"}
              </p>
              <p className="mt-0.5 text-lg font-semibold text-primary">{currentLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Target
              </p>
              <p className="mt-0.5 font-semibold">{targetLabel}</p>
            </div>
          </div>
          {progress?.percentage != null && (
            <div className="mt-3 space-y-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    progress.reached ? "bg-emerald-500" : "bg-primary",
                  )}
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>
                  {progress.sourceLabel}
                  {progress.measuredAt ? ` · ${formatUKDateShort(progress.measuredAt)}` : ""}
                </span>
                <span>{progress.reached ? "Target reached" : `${progress.percentage}%`}</span>
              </div>
            </div>
          )}
          {progressError ? (
            <p className="mt-2 text-[11px] text-destructive">
              Automatic progress could not be loaded. Refresh and try again.
            </p>
          ) : (
            !progressLoading &&
            progress?.automatic &&
            progress.value == null && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                No matching completed workout history yet.
              </p>
            )
          )}
        </div>

        {goal.notes && (
          <p className="text-xs leading-relaxed text-muted-foreground">{goal.notes}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 bg-secondary/15 px-4 py-3">
        {goal.status === "active" && (goal.goalType === "milestone" || progress?.reached) ? (
          <Button
            type="button"
            size="sm"
            onClick={() => onStatus("complete")}
            disabled={statusPending}
            className="h-8"
          >
            {statusPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trophy className="mr-1 h-3.5 w-3.5" />
            )}
            {progress?.reached ? "Mark complete" : "Complete goal"}
          </Button>
        ) : goal.status === "active" && manualProgress ? (
          <Button
            type="button"
            size="sm"
            variant={todayCheckin ? "secondary" : "outline"}
            disabled={Boolean(todayCheckin) || checkinPending}
            onClick={onCheckin}
            className="h-8"
          >
            {checkinPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            )}
            {todayCheckin ? "Done today" : "Mark today"}
          </Button>
        ) : null}

        {exercise && (
          <Button variant="ghost" size="sm" className="h-8" asChild>
            <Link to="/progress" search={{ exercise: exercise.id }}>
              View progress <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}

        {progress?.automatic && !exercise && (
          <Button variant="ghost" size="sm" className="h-8" asChild>
            <Link to="/history">
              View workouts <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}

        {manualProgress && (
          <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-1.5">
            {goal.checkins.slice(0, 3).map((checkin) => {
              const removing = deletingCheckinId === checkin.id;
              return (
                <span
                  key={checkin.id}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground"
                >
                  {formatUKDateShort(checkin.date)}
                  <button
                    type="button"
                    onClick={() => onDeleteCheckin(checkin.id)}
                    disabled={removing}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${formatUKDateShort(checkin.date)} check-in`}
                    title="Remove check-in"
                  >
                    {removing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function GoalMenu({
  goal,
  onEdit,
  onDelete,
  onStatus,
  disabled,
}: {
  goal: GoalRow;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (status: GoalStatus) => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Goal actions">
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4" /> Edit
        </DropdownMenuItem>
        {goal.status === "active" && (
          <>
            <DropdownMenuItem onClick={() => onStatus("complete")}>
              <Trophy className="h-4 w-4" /> Complete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatus("paused")}>
              <CirclePause className="h-4 w-4" /> Pause
            </DropdownMenuItem>
          </>
        )}
        {goal.status === "paused" && (
          <DropdownMenuItem onClick={() => onStatus("active")}>
            <Play className="h-4 w-4" /> Resume
          </DropdownMenuItem>
        )}
        {(goal.status === "complete" || goal.status === "archived") && (
          <DropdownMenuItem onClick={() => onStatus("active")}>
            <RotateCcw className="h-4 w-4" /> Reactivate
          </DropdownMenuItem>
        )}
        {goal.status !== "archived" && (
          <DropdownMenuItem onClick={() => onStatus("archived")}>
            <Archive className="h-4 w-4" /> Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" /> Delete permanently
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GoalEditorDialog({
  state,
  exercises,
  onClose,
  onSubmit,
  isPending,
}: {
  state: EditorState;
  exercises: GoalExercise[];
  onClose: () => void;
  onSubmit: (fields: GoalFields) => void;
  isPending: boolean;
}) {
  const initial = state.mode === "edit" ? formFromGoal(state.row) : BLANK;
  const [form, setForm] = useState<GoalFormState>(initial);
  useResetOnChange(state, () => setForm(initial));

  const selectedExercise = exercises.find((exercise) => exercise.id === form.exerciseId);
  const profile = selectedExercise
    ? getMovementMetricProfile({
        workoutType: selectedExercise.workoutType,
        movement: selectedExercise.name,
        defaultMetric: selectedExercise.metric,
      })
    : "weighted";
  const metricOptions = getGoalMetricOptions(form.goalType, profile);
  const selectedMetric = metricOptions.find((option) => option.value === form.goalMetric);
  const requiresExercise = form.goalType === "performance" || form.goalType === "duration";
  const requiresTarget = form.goalType !== "milestone" && form.goalType !== "legacy";

  const update = <K extends keyof GoalFormState>(key: K, value: GoalFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const updateGoalType = (goalType: GoalType) => {
    const nextProfile = selectedExercise ? profile : "weighted";
    const firstMetric = getGoalMetricOptions(goalType, nextProfile)[0];
    setForm((current) => ({
      ...current,
      goalType,
      exerciseId: goalType === "consistency" ? "" : current.exerciseId,
      goalMetric: firstMetric?.value ?? "",
      targetUnit: firstMetric?.unit ?? "",
      period: goalType === "milestone" ? "static" : current.period,
    }));
  };

  const updateExercise = (exerciseId: string) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    const nextProfile = exercise
      ? getMovementMetricProfile({
          workoutType: exercise.workoutType,
          movement: exercise.name,
          defaultMetric: exercise.metric,
        })
      : "weighted";
    const firstMetric = getGoalMetricOptions(form.goalType, nextProfile)[0];
    setForm((current) => ({
      ...current,
      exerciseId: exerciseId === "none" ? "" : exerciseId,
      goalMetric: firstMetric?.value ?? "",
      targetUnit: firstMetric?.unit ?? "",
    }));
  };

  const updateMetric = (goalMetric: GoalMetric) => {
    const option = metricOptions.find((item) => item.value === goalMetric);
    setForm((current) => ({
      ...current,
      goalMetric,
      targetUnit: option?.unit ?? current.targetUnit,
    }));
  };

  const open = state.mode !== "closed";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{state.mode === "edit" ? "Edit goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            Choose a goal type so targets and exercise links stay consistent with Progress.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.goal.trim()) {
              toast.error("Goal name is required");
              return;
            }
            if (requiresExercise && !form.exerciseId) {
              toast.error("Choose an exercise or activity");
              return;
            }
            const targetValue = parsePositiveNumber(form.targetValue);
            if (requiresTarget && !targetValue) {
              toast.error("Enter a target greater than zero");
              return;
            }
            const exercise = exercises.find((item) => item.id === form.exerciseId);
            const trackingMode = exercise?.metric ?? "";
            const metric = form.goalType === "legacy" ? form.legacyMetric : form.targetUnit;
            const target =
              form.goalType === "legacy"
                ? form.legacyTarget
                : targetValue != null
                  ? formatNumber(targetValue)
                  : "";
            onSubmit({
              goal: form.goal.trim(),
              goalType: form.goalType,
              exerciseId: form.exerciseId,
              trackingMode,
              goalMetric: form.goalMetric,
              targetValue: form.goalType === "legacy" ? null : targetValue,
              targetUnit: form.goalType === "legacy" ? "" : form.targetUnit,
              startingValue: parseNumberOrNull(form.startingValue),
              deadline: form.deadline,
              metric,
              target,
              period: form.period,
              notes: form.notes.trim(),
            });
          }}
          className="space-y-4"
        >
          <Field label="Goal type">
            <Select
              value={form.goalType}
              onValueChange={(value) => updateGoalType(value as GoalType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.mode === "edit" && state.row.goalType === "legacy" && (
                  <SelectItem value="legacy">General / legacy</SelectItem>
                )}
                {GOAL_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.goalType !== "legacy" && (
              <p className="text-xs text-muted-foreground">
                {GOAL_TYPE_OPTIONS.find((option) => option.value === form.goalType)?.description}
              </p>
            )}
          </Field>

          <Field label="Goal">
            <Input
              autoFocus
              value={form.goal}
              onChange={(event) => update("goal", event.target.value)}
              placeholder={
                form.goalType === "performance"
                  ? "e.g. Bench press 100kg"
                  : form.goalType === "milestone"
                    ? "e.g. Complete a muscle-up"
                    : "e.g. Train four times per week"
              }
              autoCapitalize="sentences"
            />
          </Field>

          {form.goalType !== "consistency" && form.goalType !== "legacy" && (
            <Field label={requiresExercise ? "Exercise or activity" : "Exercise (optional)"}>
              <Select value={form.exerciseId || "none"} onValueChange={updateExercise}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an exercise" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {!requiresExercise && <SelectItem value="none">No linked exercise</SelectItem>}
                  {exercises.map((exercise) => (
                    <SelectItem key={exercise.id} value={exercise.id}>
                      {exercise.name} · {exercise.workoutType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedExercise && (
                <p className="text-xs text-muted-foreground">
                  Library tracking:{" "}
                  {getTrackingModeLabel({
                    workoutType: selectedExercise.workoutType,
                    movement: selectedExercise.name,
                    defaultMetric: selectedExercise.metric,
                  })}
                </p>
              )}
            </Field>
          )}

          {form.goalType === "legacy" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target">
                <Input
                  value={form.legacyTarget}
                  onChange={(event) => update("legacyTarget", event.target.value)}
                  placeholder="e.g. 4"
                />
              </Field>
              <Field label="Metric">
                <Input
                  value={form.legacyMetric}
                  onChange={(event) => update("legacyMetric", event.target.value)}
                  placeholder="sessions, kg, hrs"
                />
              </Field>
            </div>
          ) : form.goalType !== "milestone" ? (
            <>
              <Field label="Measurement">
                <Select
                  value={form.goalMetric}
                  onValueChange={(value) => updateMetric(value as GoalMetric)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metricOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Target">
                  <Input
                    value={form.targetValue}
                    onChange={(event) => update("targetValue", event.target.value)}
                    placeholder="e.g. 4"
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Unit">
                  <Input value={selectedMetric?.unit ?? form.targetUnit} readOnly />
                </Field>
              </div>
              {(form.goalType === "performance" || form.goalType === "duration") && (
                <Field label="Starting value (optional)">
                  <Input
                    value={form.startingValue}
                    onChange={(event) => update("startingValue", event.target.value)}
                    placeholder="Used as the progress-bar baseline"
                    inputMode="decimal"
                  />
                </Field>
              )}
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Period">
              <Select value={form.period} onValueChange={(value) => update("period", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((period) => (
                    <SelectItem key={period} value={period}>
                      {PERIOD_LABELS[period]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Deadline (optional)">
              <Input
                type="date"
                value={form.deadline}
                onChange={(event) => update("deadline", event.target.value)}
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Optional context or success criteria"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.goal.trim()}
              style={{
                backgroundImage: "var(--gradient-primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : state.mode === "edit" ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formFromGoal(goal: GoalRow): GoalFormState {
  return {
    goal: goal.goal,
    goalType: goal.goalType,
    exerciseId: goal.exerciseId,
    goalMetric: goal.goalMetric,
    targetValue: goal.targetValue != null ? formatNumber(goal.targetValue) : "",
    targetUnit: goal.targetUnit,
    startingValue: goal.startingValue != null ? formatNumber(goal.startingValue) : "",
    period: goal.period || "week",
    deadline: goal.deadline,
    notes: goal.notes,
    legacyTarget: goal.target,
    legacyMetric: goal.metric,
  };
}

function GoalTypeIcon({ type }: { type: GoalType }) {
  if (type === "performance") return <Gauge className="h-4 w-4" />;
  if (type === "duration") return <CalendarDays className="h-4 w-4" />;
  if (type === "milestone") return <Flag className="h-4 w-4" />;
  return <Target className="h-4 w-4" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNumberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function formatGoalValue(value: number, unit: string) {
  const formatted =
    unit === "kg" || unit === "km" ? String(Math.round(value * 10) / 10) : formatNumber(value);
  return `${formatted} ${unit}`.trim();
}

function useResetOnChange<T>(dependency: T, reset: () => void) {
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependency]);
}
