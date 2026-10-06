import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  Layers3,
  Mountain,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_ITEMS,
  ITEM_STYLE,
  WeeklyPlanOverview,
  programmeMovementGuidance,
} from "@/components/weekly-plan-overview";
import { formatUKDateShort } from "@/lib/date";
import { addCalendarDays, calendarWeekDates, startOfMondayWeek } from "@/lib/calendar-week";
import { MOBILITY_SKILLS } from "@/lib/mobility-practice";
import type { SavedWorkoutPlan } from "@/lib/supabase-plans.browser";
import type { ProgrammeScheduleSession } from "@/lib/supabase-programmes.browser";
import type { PlannerLocation, WorkoutPlanMovement } from "@/lib/workout-plan";
import { cn } from "@/lib/utils";

type WeekProps = ComponentProps<typeof WeeklyPlanOverview>;
type BuilderMode = "strength" | "circuit" | "climbing";
type Selection =
  | { type: "day"; date: string }
  | { type: "programme"; key: string }
  | { type: "scheduled"; id: string };
type Panel = "programme" | "coaching" | "mobility" | null;

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const dayLabel = (iso: string, long = false) =>
  new Intl.DateTimeFormat("en-GB", { weekday: long ? "long" : "short", timeZone: "UTC" }).format(
    parse(iso),
  );
const programmeKey = (session: ProgrammeScheduleSession) =>
  `${session.assignmentId}:${session.programWorkoutId}`;

export function DesktopPlanWorkspace({
  programmeHeader,
  coaching,
  mobility,
  weekReady,
  weekError,
  weekProps,
  builderOpen,
  onOpenBuilder,
  onCloseBuilder,
  builderMode,
  builderBrief,
  builderPrescription,
  builderSummary,
  weekStart,
  onWeekStartChange,
  today,
}: {
  programmeHeader: ReactNode;
  coaching: ReactNode;
  mobility: ReactNode;
  weekReady: boolean;
  weekError?: string | null;
  weekProps: WeekProps;
  builderOpen: boolean;
  onOpenBuilder: (mode: BuilderMode, date: string) => void;
  onCloseBuilder: () => void;
  builderMode: BuilderMode;
  builderBrief: ReactNode;
  builderPrescription: ReactNode;
  builderSummary: ReactNode;
  weekStart: string;
  onWeekStartChange: (weekStart: string) => void;
  today: string;
}) {
  const [panel, setPanel] = useState<Panel>(null);

  if (builderOpen) {
    const label =
      builderMode === "strength"
        ? "Strength session"
        : builderMode === "circuit"
          ? "Conditioning session"
          : "Climbing session";
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-3 border-b border-border pb-3">
          <Button variant="ghost" size="sm" onClick={onCloseBuilder}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to week
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Build: {label}</h1>
        </header>
        <div className="grid grid-cols-[280px_minmax(0,1fr)_260px] items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)_300px] xl:gap-5">
          <aside className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto rounded-xl border border-border bg-card/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Session brief
            </p>
            {builderBrief}
          </aside>
          <main className="min-w-0">{builderPrescription}</main>
          <aside className="sticky top-24">{builderSummary}</aside>
        </div>
      </div>
    );
  }

  const current = weekProps.programmeSessions.find((session) => session.status === "current");
  const completedCount = weekProps.programmeSessions.filter(
    (session) => session.status === "completed",
  ).length;

  const panelButton = (key: Exclude<Panel, null>, label: string, icon: ReactNode) => (
    <Button
      variant={panel === key ? "secondary" : "outline"}
      size="sm"
      aria-expanded={panel === key}
      onClick={() => setPanel(panel === key ? null : key)}
    >
      {icon}
      {label}
      <ChevronDown
        className={cn("ml-1 h-3.5 w-3.5 transition", panel === key ? "rotate-180" : "")}
      />
    </Button>
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-4 border-b border-border pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/[0.05] px-3 py-2">
          <Layers3 className="h-4 w-4 shrink-0 text-fuchsia-300" />
          {current ? (
            <div className="min-w-0 text-sm">
              <span className="font-medium">{current.programmeName}</span>
              <span className="text-muted-foreground">
                {" · "}
                {current.weekNumber ? `Week ${current.weekNumber} · ` : ""}
                {current.sessionNumber
                  ? `Session ${current.sessionNumber}`
                  : `Workout ${current.workoutNumber}`}
                {" · "}
                {current.isCatchUp ? "Catch up" : "Next up"}
                {completedCount ? ` · ${completedCount} done this view` : ""}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No active programme session</span>
          )}
        </div>
        <div className="flex gap-2">
          {panelButton("programme", "My Programme", <Layers3 className="mr-1.5 h-4 w-4" />)}
          {panelButton("coaching", "Coaching", <Sparkles className="mr-1.5 h-4 w-4" />)}
          {panelButton("mobility", "Mobility", <HeartPulse className="mr-1.5 h-4 w-4" />)}
        </div>
      </header>

      <section
        hidden={panel !== "programme"}
        className="rounded-xl border border-border bg-card/20 p-4"
      >
        {programmeHeader}
      </section>
      <section
        hidden={panel !== "coaching"}
        className="rounded-xl border border-border bg-card/20 p-4"
      >
        {coaching}
      </section>
      <section
        hidden={panel !== "mobility"}
        className="rounded-xl border border-border bg-card/20 p-4"
      >
        {mobility}
      </section>

      {weekError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive"
        >
          {weekError}
        </div>
      ) : weekReady ? (
        <WeekWorkspace
          weekProps={weekProps}
          weekStart={weekStart}
          onWeekStartChange={onWeekStartChange}
          today={today}
          onOpenBuilder={onOpenBuilder}
          onEditProgramme={() => setPanel("programme")}
        />
      ) : (
        <div className="py-24 text-center text-sm text-muted-foreground">Loading your week…</div>
      )}
    </div>
  );
}

function WeekWorkspace({
  weekProps,
  weekStart,
  onWeekStartChange,
  today,
  onOpenBuilder,
  onEditProgramme,
}: {
  weekProps: WeekProps;
  weekStart: string;
  onWeekStartChange: (weekStart: string) => void;
  today: string;
  onOpenBuilder: (mode: BuilderMode, date: string) => void;
  onEditProgramme: () => void;
}) {
  const {
    plan,
    programmeSessions,
    adjustments,
    scheduledPlans = [],
    scheduling = false,
    onMoveScheduledPlan,
  } = weekProps;
  const [selection, setSelection] = useState<Selection>({ type: "day", date: today });
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);

  const dates = useMemo(() => calendarWeekDates(weekStart), [weekStart]);

  useEffect(() => {
    setSelection({ type: "day", date: dates.includes(today) ? today : dates[0] });
  }, [dates, today, weekStart]);

  const selectedProgramme =
    selection.type === "programme"
      ? programmeSessions.find((session) => programmeKey(session) === selection.key)
      : undefined;
  const selectedScheduled =
    selection.type === "scheduled"
      ? scheduledPlans.find((saved) => saved.suggestedWorkoutId === selection.id)
      : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-labelledby="desktop-week-heading" className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="desktop-week-heading" className="flex items-center gap-2 text-base font-semibold">
            <CalendarRange className="h-4 w-4 text-fuchsia-300" />
            {formatUKDateShort(dates[0])} – {formatUKDateShort(dates[6])}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous week"
              onClick={() => onWeekStartChange(addCalendarDays(weekStart, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={weekStart === startOfMondayWeek(today)}
              onClick={() => {
                onWeekStartChange(startOfMondayWeek(today));
                setSelection({ type: "day", date: today });
              }}
            >
              This week
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next week"
              onClick={() => onWeekStartChange(addCalendarDays(weekStart, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {dates.map((date) => {
            const planDay = plan.days.find((day) => day.date === date);
            const planned = planDay ? (adjustments[date] ?? planDay.inferredItems) : [];
            const completed = planDay?.completedItems ?? [];
            const sessions = programmeSessions.filter((session) => session.date === date);
            const saved = scheduledPlans.filter((item) => item.suggestedFor === date);
            const isSelected = selection.type === "day" && selection.date === date;
            const isToday = date === today;
            const isPast = date < today;
            return (
              <div
                key={date}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setSelection({ type: "day", date })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelection({ type: "day", date });
                  }
                }}
                onDragOver={(event) => {
                  if (!dragId || isPast) return;
                  event.preventDefault();
                  setDropDate(date);
                }}
                onDragLeave={() => setDropDate((value) => (value === date ? null : value))}
                onDrop={(event) => {
                  event.preventDefault();
                  const plan = scheduledPlans.find((item) => item.suggestedWorkoutId === dragId);
                  if (plan && plan.suggestedFor !== date && !isPast) {
                    onMoveScheduledPlan?.(plan.suggestedWorkoutId, date);
                  }
                  setDragId(null);
                  setDropDate(null);
                }}
                className={cn(
                  "flex min-h-[280px] cursor-pointer flex-col rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300",
                  isSelected
                    ? "border-primary/50 bg-primary/[0.06]"
                    : isToday
                      ? "border-fuchsia-400/35 bg-fuchsia-400/[0.05]"
                      : "border-border hover:border-border/80 hover:bg-secondary/20",
                  isPast && "opacity-75",
                  dropDate === date && "border-cyan-300 bg-cyan-400/10",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {isToday ? "Today" : dayLabel(date)}
                  </span>
                  <span className="text-xs font-medium">{formatUKDateShort(date)}</span>
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {sessions.map((session) => (
                    <button
                      type="button"
                      key={programmeKey(session)}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelection({ type: "programme", key: programmeKey(session) });
                      }}
                      className={cn(
                        "rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/[0.08] p-2 text-left text-xs transition hover:border-fuchsia-300/50",
                        selection.type === "programme" &&
                          selection.key === programmeKey(session) &&
                          "ring-2 ring-fuchsia-300",
                      )}
                    >
                      <span className="flex items-center gap-1 font-medium text-fuchsia-200">
                        {session.status === "completed" ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                        ) : (
                          <Layers3 className="h-3 w-3" />
                        )}
                        {session.isCatchUp ? "Catch up · " : ""}
                        {session.sessionNumber
                          ? `Session ${session.sessionNumber}`
                          : `Workout ${session.workoutNumber}`}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-[11px] text-foreground/75">
                        {session.movementNames.join(" · ")}
                      </span>
                    </button>
                  ))}
                  {saved.map((item) => {
                    const movable = item.status !== "completed";
                    return (
                      <button
                        type="button"
                        key={item.suggestedWorkoutId}
                        draggable={movable}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          setDragId(item.suggestedWorkoutId);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDropDate(null);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelection({ type: "scheduled", id: item.suggestedWorkoutId });
                        }}
                        className={cn(
                          "rounded-lg border border-cyan-400/25 bg-cyan-400/[0.07] p-2 text-left text-xs transition hover:border-cyan-300/50",
                          movable && "cursor-grab active:cursor-grabbing",
                          selection.type === "scheduled" &&
                            selection.id === item.suggestedWorkoutId &&
                            "ring-2 ring-cyan-300",
                        )}
                        title={movable ? "Drag to another day to move" : undefined}
                      >
                        <span className="flex items-center gap-1 font-medium capitalize text-cyan-200">
                          {item.status === "completed" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                          ) : item.planKind === "climbing" ? (
                            <Mountain className="h-3 w-3" />
                          ) : item.planKind === "mobility" ? (
                            <HeartPulse className="h-3 w-3" />
                          ) : (
                            <Dumbbell className="h-3 w-3" />
                          )}
                          {item.planKind}
                        </span>
                        <span className="mt-1 block line-clamp-2 text-[11px] text-foreground/80">
                          {item.title}
                        </span>
                      </button>
                    );
                  })}
                  {completed.map((item) => (
                    <ItemChip key={`done-${item}`} item={item} done />
                  ))}
                  {planned.map((item) => (
                    <ItemChip key={item} item={item} />
                  ))}
                  {!sessions.length && !saved.length && !completed.length && !planned.length ? (
                    <span className="text-[11px] text-muted-foreground/60">Open</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Drag a scheduled session to another day to move it. Programme sessions follow your
          programme order.
        </p>
      </section>

      <aside className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border bg-card/30 p-4">
        {selectedProgramme ? (
          <ProgrammeInspector session={selectedProgramme} onEditProgramme={onEditProgramme} />
        ) : selectedScheduled ? (
          <ScheduledInspector
            key={selectedScheduled.suggestedWorkoutId}
            saved={selectedScheduled}
            scheduling={scheduling}
            onStart={() => weekProps.onStartScheduledPlan?.(selectedScheduled)}
            onMove={(date) =>
              weekProps.onMoveScheduledPlan?.(selectedScheduled.suggestedWorkoutId, date)
            }
            onRemove={() => {
              weekProps.onRemoveScheduledPlan?.(selectedScheduled.suggestedWorkoutId);
              setSelection({ type: "day", date: selectedScheduled.suggestedFor ?? today });
            }}
          />
        ) : (
          <DayInspector
            date={selection.type === "day" ? selection.date : today}
            today={today}
            weekProps={weekProps}
            onOpenBuilder={onOpenBuilder}
            onSelect={setSelection}
          />
        )}
      </aside>
    </div>
  );
}

function ItemChip({ item, done = false }: { item: keyof typeof ITEM_STYLE; done?: boolean }) {
  const style = ITEM_STYLE[item];
  const Icon = style.icon;
  return (
    <span className="flex items-center gap-1">
      {done ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-300" /> : null}
      <Badge variant="outline" className={cn("text-[10px]", style.badge)}>
        <Icon className="mr-1 h-3 w-3" /> {style.shortLabel}
      </Badge>
    </span>
  );
}

function MovementTable({ movement }: { movement: WorkoutPlanMovement }) {
  const guidance = programmeMovementGuidance(movement.reason, movement.restTime);
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-sm font-medium">{movement.exercise}</span>
        {movement.restTime ? (
          <Badge variant="outline" className="text-[10px]">
            Rest {movement.restTime}
          </Badge>
        ) : null}
      </div>
      {movement.setRows.length ? (
        <div className="border-t border-border text-xs">
          {movement.setRows.map((set, index) => (
            <div
              key={index}
              className="grid grid-cols-[2.5rem_1fr_1fr] px-3 py-1 odd:bg-secondary/15"
            >
              <span className="text-muted-foreground">{index + 1}</span>
              <span>{set.weight ? `${set.weight} kg` : "—"}</span>
              <span>
                {set.reps
                  ? `${set.reps} reps`
                  : set.durationSeconds
                    ? `${set.durationSeconds}s`
                    : "—"}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {guidance ? (
        <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          {guidance}
        </p>
      ) : null}
    </div>
  );
}

function ProgrammeInspector({
  session,
  onEditProgramme,
}: {
  session: ProgrammeScheduleSession;
  onEditProgramme: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Badge className="border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200">
          Programme
        </Badge>
        <Badge variant="outline" className="capitalize">
          {session.status}
        </Badge>
        {session.isCatchUp ? <Badge variant="secondary">Catch up</Badge> : null}
        {session.status === "upcoming" && !session.isPersonal ? (
          <Badge variant="outline">Provisional</Badge>
        ) : null}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{session.programmeName}</p>
        <h3 className="text-base font-semibold">{session.workoutName}</h3>
        <p className="text-xs text-muted-foreground">
          {dayLabel(session.date, true)}, {formatUKDateShort(session.date)}
          {session.weekNumber ? ` · Week ${session.weekNumber}` : ""}
        </p>
      </div>
      {session.movements.length ? (
        <div className="space-y-2">
          {session.movements.map((movement) => (
            <MovementTable key={movement.exercise} movement={movement} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Exact sets are not available for this session yet.
        </p>
      )}
      {session.selectionNotes.length ? (
        <ul className="space-y-1 rounded-lg border border-border p-3 text-xs text-muted-foreground">
          {session.selectionNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {session.status === "current" ? (
          <Button asChild size="sm">
            <Link to="/">
              <Play className="mr-1.5 h-4 w-4" /> Start from Today
            </Link>
          </Button>
        ) : null}
        {session.isPersonal && session.status !== "completed" ? (
          <Button size="sm" variant="outline" onClick={onEditProgramme}>
            Edit in My Programme
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ScheduledInspector({
  saved,
  scheduling,
  onStart,
  onMove,
  onRemove,
}: {
  saved: SavedWorkoutPlan;
  scheduling: boolean;
  onStart: () => void;
  onMove: (date: string) => void;
  onRemove: () => void;
}) {
  const [moveDate, setMoveDate] = useState(saved.suggestedFor ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => setMoveDate(saved.suggestedFor ?? ""), [saved.suggestedFor]);
  const completed = saved.status === "completed";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Badge className="border-cyan-400/25 bg-cyan-400/10 capitalize text-cyan-200">
          {saved.planKind}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {saved.status}
        </Badge>
      </div>
      <div>
        <h3 className="text-base font-semibold">{saved.title}</h3>
        {saved.suggestedFor ? (
          <p className="text-xs text-muted-foreground">
            {dayLabel(saved.suggestedFor, true)}, {formatUKDateShort(saved.suggestedFor)}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        {saved.movements.map((movement, index) => (
          <MovementTable key={`${movement.exercise}-${index}`} movement={movement} />
        ))}
      </div>
      {!completed ? (
        <div className="space-y-2 border-t border-border pt-3">
          <label className="block text-xs">
            Planned date
            <div className="mt-1 flex gap-2">
              <Input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
              <Button
                variant="outline"
                disabled={!moveDate || moveDate === saved.suggestedFor || scheduling}
                onClick={() => onMove(moveDate)}
              >
                Move
              </Button>
            </div>
          </label>
          <div className="flex items-center justify-between gap-2 pt-1">
            {confirmRemove ? (
              <div className="flex gap-1">
                <Button size="sm" variant="destructive" disabled={scheduling} onClick={onRemove}>
                  Confirm remove
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Remove
              </Button>
            )}
            <Button size="sm" onClick={onStart}>
              <Play className="mr-1.5 h-4 w-4" /> Start
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DayInspector({
  date,
  today,
  weekProps,
  onOpenBuilder,
  onSelect,
}: {
  date: string;
  today: string;
  weekProps: WeekProps;
  onOpenBuilder: (mode: BuilderMode, date: string) => void;
  onSelect: (selection: Selection) => void;
}) {
  const {
    plan,
    programmeSessions,
    adjustments,
    onAdjustDay,
    scheduledPlans = [],
    mobilityRuns = [],
    scheduling = false,
    onScheduleYoga,
    onScheduleMobility,
  } = weekProps;
  const [location, setLocation] = useState<PlannerLocation>("home");
  const [yogaMinutes, setYogaMinutes] = useState("30");
  const [runId, setRunId] = useState(mobilityRuns[0]?.id ?? "");
  useEffect(() => {
    if (!mobilityRuns.some((run) => run.id === runId)) setRunId(mobilityRuns[0]?.id ?? "");
  }, [mobilityRuns, runId]);

  const planDay = plan.days.find((day) => day.date === date);
  const planned = planDay ? (adjustments[date] ?? planDay.inferredItems) : [];
  const sessions = programmeSessions.filter((session) => session.date === date);
  const saved = scheduledPlans.filter((item) => item.suggestedFor === date);
  const isPast = date < today;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {date === today ? "Today" : "Selected day"}
        </p>
        <h3 className="text-base font-semibold">
          {dayLabel(date, true)}, {formatUKDateShort(date)}
        </h3>
      </div>

      <div className="space-y-1.5">
        {sessions.map((session) => (
          <button
            key={programmeKey(session)}
            type="button"
            onClick={() => onSelect({ type: "programme", key: programmeKey(session) })}
            className="block w-full rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/[0.06] px-3 py-2 text-left text-sm hover:border-fuchsia-300/50"
          >
            {session.workoutName}
            <span className="ml-1 text-xs capitalize text-muted-foreground">
              · {session.status}
            </span>
          </button>
        ))}
        {saved.map((item) => (
          <button
            key={item.suggestedWorkoutId}
            type="button"
            onClick={() => onSelect({ type: "scheduled", id: item.suggestedWorkoutId })}
            className="block w-full rounded-lg border border-cyan-400/25 bg-cyan-400/[0.06] px-3 py-2 text-left text-sm hover:border-cyan-300/50"
          >
            {item.title}
            <span className="ml-1 text-xs capitalize text-muted-foreground">· {item.status}</span>
          </button>
        ))}
        {!sessions.length && !saved.length ? (
          <p className="text-xs text-muted-foreground">Nothing scheduled for this day.</p>
        ) : null}
      </div>

      {!isPast ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-semibold">Add to this day</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenBuilder("strength", date)}>
              <Dumbbell className="mr-1 h-3.5 w-3.5" /> Strength
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenBuilder("circuit", date)}>
              <Zap className="mr-1 h-3.5 w-3.5" /> Conditioning
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenBuilder("climbing", date)}>
              <Mountain className="mr-1 h-3.5 w-3.5" /> Climbing
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">
              Training place
              <Select value={location} onValueChange={(v) => setLocation(v as PlannerLocation)}>
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="gym">Gym</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs">
              Yoga minutes
              <Input
                className="mt-1 h-8"
                type="number"
                min={5}
                max={180}
                value={yogaMinutes}
                onChange={(e) => setYogaMinutes(e.target.value)}
              />
            </label>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={scheduling || !onScheduleYoga}
            onClick={() => onScheduleYoga?.(date, location, Math.max(5, Number(yogaMinutes) || 30))}
          >
            Plan yoga
          </Button>
          {mobilityRuns.length ? (
            <div className="flex gap-2">
              <Select value={runId} onValueChange={setRunId}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Mobility practice" />
                </SelectTrigger>
                <SelectContent>
                  {mobilityRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {MOBILITY_SKILLS[run.skill].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={scheduling || !runId || !onScheduleMobility}
                onClick={() => onScheduleMobility?.(date, runId, location)}
              >
                Plan mobility
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Start a mobility practice to schedule it here.
            </p>
          )}
        </div>
      ) : null}

      {planDay ? (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Other training load</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onAdjustDay(date, null)}
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Use inferred
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ITEMS.map((item) => {
              const style = ITEM_STYLE[item];
              const Icon = style.icon;
              const active = planned.includes(item);
              const done = planDay.completedItems.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  disabled={done}
                  onClick={() =>
                    onAdjustDay(
                      date,
                      active ? planned.filter((value) => value !== item) : [...planned, item],
                    )
                  }
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition disabled:opacity-60",
                    active
                      ? "border-primary/50 bg-primary/10"
                      : "border-border hover:bg-secondary/40",
                  )}
                >
                  <Icon className="h-3 w-3" /> {style.shortLabel}
                  {done ? <CheckCircle2 className="h-3 w-3 text-emerald-300" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DesktopBuilderSummary({
  plannedFor,
  mode,
  location,
  movements,
  methodNames,
  fallbackUsed,
  actions,
}: {
  plannedFor: string;
  mode: BuilderMode;
  location: PlannerLocation;
  movements: WorkoutPlanMovement[];
  methodNames: string[];
  fallbackUsed: boolean;
  actions: ReactNode;
}) {
  const workingSets = movements.reduce((total, movement) => total + movement.setRows.length, 0);
  const rows: Array<[string, string]> = [
    [
      "Planned for",
      plannedFor ? `${dayLabel(plannedFor, true)}, ${formatUKDateShort(plannedFor)}` : "—",
    ],
    ["Type", mode === "strength" ? "Strength" : mode === "circuit" ? "Conditioning" : "Climbing"],
    ...(mode !== "climbing"
      ? [["Location", location === "home" ? "Home" : "Gym"] as [string, string]]
      : []),
    ["Movements", String(movements.length)],
    ...(mode !== "climbing" ? [["Working sets", String(workingSets)] as [string, string]] : []),
  ];
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/30 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Session summary
      </p>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {methodNames.length ? (
        <div className="flex flex-wrap gap-1">
          {methodNames.map((name, index) => (
            <Badge key={`${name}-${index}`} variant="outline" className="text-[10px]">
              {name}
            </Badge>
          ))}
        </div>
      ) : null}
      {fallbackUsed ? (
        <p className="rounded-md border border-amber-400/30 bg-amber-400/[0.06] p-2 text-xs text-amber-200">
          Some movements came from another location because there wasn't enough history here.
        </p>
      ) : null}
      {actions ? (
        <div className="[&>div]:static [&>div]:grid-cols-1 [&>div]:shadow-none">{actions}</div>
      ) : (
        <p className="text-xs text-muted-foreground">Build a session to save or start it.</p>
      )}
    </div>
  );
}
