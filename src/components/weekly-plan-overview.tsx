import {
  ArrowRight,
  Building2,
  CalendarRange,
  CheckCircle2,
  Footprints,
  HeartPulse,
  Home,
  Mountain,
  Pencil,
  RotateCcw,
  Sparkles,
  Trophy,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUKDateShort } from "@/lib/date";
import type { PlannerLocation } from "@/lib/workout-plan";
import type {
  WeeklyPlan,
  WeeklyPlanAdjustments,
  WeeklyPlanItemKind,
  WeeklyPlanLocation,
} from "@/lib/weekly-plan";
import { cn } from "@/lib/utils";

const LOCATION_STYLE = {
  home: {
    label: "Home",
    icon: Home,
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  },
  gym: {
    label: "Gym",
    icon: Building2,
    badge: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  },
} as const;

const ITEM_STYLE: Record<
  WeeklyPlanItemKind,
  { label: string; shortLabel: string; icon: typeof Home; badge: string }
> = {
  home: { ...LOCATION_STYLE.home, shortLabel: "Home" },
  gym: { ...LOCATION_STYLE.gym, shortLabel: "Gym" },
  climb: {
    label: "Climbing",
    shortLabel: "Climb",
    icon: Mountain,
    badge: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  },
  run: {
    label: "Running",
    shortLabel: "Run",
    icon: Footprints,
    badge: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  },
  class: {
    label: "Class",
    shortLabel: "Class",
    icon: Users,
    badge: "border-pink-400/30 bg-pink-400/10 text-pink-300",
  },
  sport: {
    label: "Sport / conditioning",
    shortLabel: "Sport",
    icon: Trophy,
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  },
  recovery: {
    label: "Recovery / mobility",
    shortLabel: "Recovery",
    icon: HeartPulse,
    badge: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  },
};

const ALL_ITEMS = Object.keys(ITEM_STYLE) as WeeklyPlanItemKind[];

function dayName(date: string, long = false) {
  const parsed = new Date(`${date}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: long ? "long" : "short",
    timeZone: "UTC",
  }).format(parsed);
}

function ItemBadge({ item }: { item: WeeklyPlanItemKind }) {
  const style = ITEM_STYLE[item];
  const Icon = style.icon;
  return (
    <Badge variant="outline" className={cn("text-[10px]", style.badge)}>
      <Icon className="mr-1 h-3 w-3" /> {style.shortLabel}
    </Badge>
  );
}

function PatternCard({
  plan,
  onChoose,
}: {
  plan: WeeklyPlanLocation;
  onChoose: (location: PlannerLocation) => void;
}) {
  const style = LOCATION_STYLE[plan.location];
  const Icon = style.icon;
  const movementNames = plan.suggestion?.movements.map((movement) => movement.exercise) ?? [];
  const patternLabel =
    plan.suggestion?.pattern === "rotation" ? "Alternating rotation" : "Repeat recent pattern";
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Icon className="h-4 w-4" /> {style.label}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {plan.frequency > 0
                ? `${plan.frequency} expected day${plan.frequency === 1 ? "" : "s"} · ${plan.confidence} confidence`
                : "No location-labelled cadence yet"}
            </p>
          </div>
          <Badge variant="outline" className="text-[9px] capitalize">
            {plan.sourceDays} source day{plan.sourceDays === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-1">
        {plan.suggestion ? (
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-xs font-medium">{patternLabel}</p>
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
              {movementNames.join(" · ")}
            </p>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            Log a completed {style.label.toLowerCase()} workout to learn its rotation.
          </p>
        )}

        {plan.progressionExercises.length > 0 ? (
          <div className="flex gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] p-2.5 text-xs">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
            <div>
              <p className="font-medium">Due to progress</p>
              <p className="mt-0.5 text-muted-foreground">{plan.progressionExercises.join(", ")}</p>
            </div>
          </div>
        ) : null}

        {plan.fatigueExercises.length > 0 ? (
          <div className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-2.5 text-xs">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <div>
              <p className="font-medium">Watch fatigue</p>
              <p className="mt-0.5 text-muted-foreground">
                {plan.fatigueExercises.join(", ")} · repeated RPE 9+
              </p>
            </div>
          </div>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={!plan.suggestion}
          onClick={() => onChoose(plan.location)}
        >
          Plan this {style.label.toLowerCase()} workout <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function WeeklyPlanOverview({
  plan,
  adjustments,
  onChooseLocation,
  onAdjustDay,
}: {
  plan: WeeklyPlan;
  adjustments: WeeklyPlanAdjustments;
  onChooseLocation: (location: PlannerLocation) => void;
  onAdjustDay: (date: string, items: WeeklyPlanItemKind[] | null) => void;
}) {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const editingDay = plan.days.find((day) => day.date === editingDate);
  const editingItems = editingDay ? (adjustments[editingDay.date] ?? editingDay.inferredItems) : [];
  const toggleEditingItem = (item: WeeklyPlanItemKind) => {
    if (!editingDay) return;
    const next = editingItems.includes(item)
      ? editingItems.filter((current) => current !== item)
      : [...editingItems, item];
    onAdjustDay(editingDay.date, next);
  };

  return (
    <section className="space-y-3" aria-labelledby="weekly-plan-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="weekly-plan-heading" className="flex items-center gap-2 text-base font-semibold">
            <CalendarRange className="h-4 w-4 text-fuchsia-300" /> Next 7 days
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            History-derived suggestions that you can adjust on this device.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {formatUKDateShort(plan.startDate)}–{formatUKDateShort(plan.endDate)}
        </Badge>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:overflow-visible">
        {plan.days.map((day, index) => {
          const plannedItems = adjustments[day.date] ?? day.inferredItems;
          const completed = day.completedItems.length > 0;
          return (
            <div
              key={day.date}
              className={cn(
                "min-h-[142px] w-[126px] shrink-0 rounded-xl border p-3 sm:w-auto",
                index === 0 ? "border-fuchsia-400/30 bg-fuchsia-400/[0.06]" : "border-border",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {index === 0 ? "Today" : dayName(day.date)}
              </p>
              <p className="mt-0.5 text-sm font-medium">{formatUKDateShort(day.date)}</p>
              <div className="mt-3 flex flex-col items-start gap-1.5">
                {day.completedItems.map((item) => (
                  <div key={`done-${item}`} className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    <ItemBadge item={item} />
                  </div>
                ))}
                {plannedItems.map((item) => (
                  <ItemBadge key={item} item={item} />
                ))}
                {!completed && plannedItems.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground/70">Open</span>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 px-1.5 text-[10px] text-muted-foreground"
                onClick={() => setEditingDate(day.date)}
              >
                <Pencil className="mr-1 h-3 w-3" /> Adjust
              </Button>
            </div>
          );
        })}
      </div>

      <Card className="border-sky-400/15 bg-sky-400/[0.03]">
        <CardContent className="flex flex-wrap items-center gap-2 p-3 text-xs">
          <span className="font-medium">Other load learned</span>
          {plan.loadPatterns.length > 0 ? (
            plan.loadPatterns.map((pattern) => (
              <div key={pattern.kind} className="flex items-center gap-1.5">
                <ItemBadge item={pattern.kind} />
                <span className="text-[10px] text-muted-foreground">
                  {pattern.frequency > 0
                    ? `${pattern.frequency}/week · ${pattern.confidence}`
                    : `${pattern.sourceDays} recent · not scheduled`}
                </span>
              </div>
            ))
          ) : (
            <span className="text-muted-foreground">
              No climbing, running, class, sport, or recovery pattern found yet.
            </span>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <PatternCard plan={plan.locations.home} onChoose={onChooseLocation} />
        <PatternCard plan={plan.locations.gym} onChoose={onChooseLocation} />
      </div>

      <Dialog open={Boolean(editingDay)} onOpenChange={(open) => !open && setEditingDate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Adjust{" "}
              {editingDay
                ? `${dayName(editingDay.date, true)}, ${formatUKDateShort(editingDay.date)}`
                : "day"}
            </DialogTitle>
            <DialogDescription>
              Choose the planned training load. Completed items remain visible separately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_ITEMS.map((item) => {
              const style = ITEM_STYLE[item];
              const Icon = style.icon;
              const active = editingItems.includes(item);
              const completed = editingDay?.completedItems.includes(item) ?? false;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  disabled={completed}
                  onClick={() => toggleEditingItem(item)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
                    active
                      ? "border-primary/50 bg-primary/10"
                      : "border-border bg-secondary/20 hover:bg-secondary/40",
                  )}
                >
                  <Icon className="h-4 w-4" /> {style.label}
                  {completed ? (
                    <span className="ml-auto text-[10px] text-muted-foreground">Completed</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editingDay && onAdjustDay(editingDay.date, null)}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Use inferred day
            </Button>
            <Button size="sm" onClick={() => setEditingDate(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
