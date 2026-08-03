import {
  Building2,
  CalendarRange,
  CheckCircle2,
  Footprints,
  HeartPulse,
  Home,
  Layers3,
  Mountain,
  Pencil,
  RotateCcw,
  Trophy,
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
import type { ProgrammeScheduleSession } from "@/lib/supabase-programmes.browser";
import type { WeeklyPlan, WeeklyPlanAdjustments, WeeklyPlanItemKind } from "@/lib/weekly-plan";
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

export function WeeklyPlanOverview({
  plan,
  programmeSessions,
  adjustments,
  onAdjustDay,
}: {
  plan: WeeklyPlan;
  programmeSessions: ProgrammeScheduleSession[];
  adjustments: WeeklyPlanAdjustments;
  onAdjustDay: (date: string, items: WeeklyPlanItemKind[] | null) => void;
}) {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [selectedProgrammeSession, setSelectedProgrammeSession] =
    useState<ProgrammeScheduleSession | null>(null);
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
            <CalendarRange className="h-4 w-4 text-fuchsia-300" /> Your next 7 days
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Programme dates are fixed. Open a session to preview its full prescription; other
            training can be adjusted on this device.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {formatUKDateShort(plan.startDate)}–{formatUKDateShort(plan.endDate)}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-7">
        {plan.days.map((day, index) => {
          const plannedItems = adjustments[day.date] ?? day.inferredItems;
          const scheduledProgrammeSessions = programmeSessions.filter(
            (session) => session.date === day.date,
          );
          const completed = day.completedItems.length > 0;
          return (
            <div
              key={day.date}
              className={cn(
                "min-h-0 w-full rounded-xl border p-3 sm:min-h-[142px]",
                index === 0 ? "border-fuchsia-400/30 bg-fuchsia-400/[0.06]" : "border-border",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {index === 0 ? "Today" : dayName(day.date)}
              </p>
              <p className="mt-0.5 text-sm font-medium">{formatUKDateShort(day.date)}</p>
              <div className="mt-3 flex flex-col items-start gap-1.5">
                {scheduledProgrammeSessions.map((session) => (
                  <button
                    type="button"
                    key={`${session.assignmentId}:${session.programWorkoutId}`}
                    onClick={() => setSelectedProgrammeSession(session)}
                    className="w-full rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/[0.08] p-2 text-left transition hover:border-fuchsia-300/50 hover:bg-fuchsia-400/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
                  >
                    <div className="flex items-center gap-1 text-[10px] font-medium text-fuchsia-200">
                      {session.status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                      ) : (
                        <Layers3 className="h-3 w-3" />
                      )}
                      {session.weekNumber ? `W${session.weekNumber} · ` : ""}
                      {session.sessionNumber
                        ? `Session ${session.sessionNumber}`
                        : `Workout ${session.workoutNumber}`}
                    </div>
                    <p className="mt-1 line-clamp-3 text-[10px] leading-snug text-foreground/75">
                      {session.movementNames.join(" · ")}
                    </p>
                    <p className="mt-1.5 text-[10px] font-medium text-fuchsia-200">
                      View workout details
                    </p>
                  </button>
                ))}
                {day.completedItems.map((item) => (
                  <div key={`done-${item}`} className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    <ItemBadge item={item} />
                  </div>
                ))}
                {plannedItems.map((item) => (
                  <ItemBadge key={item} item={item} />
                ))}
                {!completed &&
                plannedItems.length === 0 &&
                scheduledProgrammeSessions.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground/70">Open</span>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-auto min-h-7 w-full min-w-0 justify-start whitespace-normal px-1.5 py-1 text-left text-[10px] leading-tight text-muted-foreground"
                onClick={() => setEditingDate(day.date)}
              >
                <Pencil className="mr-1 h-3 w-3 shrink-0" />
                {scheduledProgrammeSessions.length ? (
                  <>
                    <span className="sm:hidden">Adjust extras</span>
                    <span className="hidden sm:inline">Adjust other training</span>
                  </>
                ) : (
                  "Adjust day"
                )}
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

      <Dialog
        open={Boolean(selectedProgrammeSession)}
        onOpenChange={(open) => !open && setSelectedProgrammeSession(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200">
                Programme
              </Badge>
              {selectedProgrammeSession?.status === "upcoming" ? (
                <Badge variant="outline">Provisional</Badge>
              ) : null}
            </div>
            <DialogTitle>
              {selectedProgrammeSession
                ? `${dayName(selectedProgrammeSession.date, true)}, ${formatUKDateShort(selectedProgrammeSession.date)}`
                : "Programme session"}
            </DialogTitle>
            <DialogDescription>
              {selectedProgrammeSession?.programmeName} · {selectedProgrammeSession?.workoutName}
            </DialogDescription>
          </DialogHeader>

          {selectedProgrammeSession ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/[0.05] p-3 text-xs text-muted-foreground">
                This preview uses your current training maxes and latest programme review. Later
                sessions are provisional and may adjust after earlier workouts; the scheduled date
                stays fixed.
              </div>

              {selectedProgrammeSession.movements.length ? (
                <div className="space-y-3">
                  {selectedProgrammeSession.movements.map((movement) => (
                    <Card key={movement.exercise}>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <CardTitle className="text-sm">{movement.exercise}</CardTitle>
                          {movement.restTime ? (
                            <Badge variant="outline">Rest {movement.restTime}</Badge>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 p-4 pt-1">
                        <div className="overflow-hidden rounded-lg border border-border">
                          <div className="grid grid-cols-[3rem_1fr_1fr] bg-secondary/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <span>Set</span>
                            <span>Weight</span>
                            <span>Reps</span>
                          </div>
                          {movement.setRows.map((set, index) => (
                            <div
                              key={`${movement.exercise}-${index}`}
                              className="grid grid-cols-[3rem_1fr_1fr] border-t border-border px-3 py-2 text-sm"
                            >
                              <span className="text-muted-foreground">{index + 1}</span>
                              <span>{set.weight ? `${set.weight} kg` : "—"}</span>
                              <span>{set.reps || "—"}</span>
                            </div>
                          ))}
                        </div>
                        {movement.reason ? (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {movement.reason}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Exact sets are not available for this session. Check its exercise mappings and
                  training maxes in programme settings.
                </p>
              )}

              {selectedProgrammeSession.selectionNotes.length ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold">Chosen when you start</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {selectedProgrammeSession.selectionNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setSelectedProgrammeSession(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
