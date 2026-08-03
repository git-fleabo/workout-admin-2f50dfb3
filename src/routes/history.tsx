import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Award,
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Loader2,
  Mountain,
  Scale,
  Search,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkoutLifecycleBadge } from "@/components/workout-lifecycle-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUKDate, formatUKDateShort } from "@/lib/date";
import { deleteSessionClient } from "@/lib/supabase-log.browser";
import {
  getTimelineDataClient,
  type TimelineEntry,
  type TimelineKind,
} from "@/lib/supabase-timeline.browser";
import { cn } from "@/lib/utils";
import { buildTrainingStory, type TrainingStory } from "@/lib/training-story";
import { DeleteConfirmDialog, type DeleteTarget } from "./-form-bits";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History · Training Tracker" },
      {
        name: "description",
        content:
          "Browse workout, climbing, strength and bodyweight history by week, month, quarter or year.",
      },
    ],
  }),
  component: HistoryPage,
});

type PeriodMode = "week" | "month" | "quarter" | "year";
type KindFilter = "all" | TimelineKind;

const PERIODS: { value: PeriodMode; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "workout", label: "Workouts" },
  { value: "climb", label: "Climb" },
  { value: "one_rm", label: "1RM" },
  { value: "bodyweight", label: "Bodyweight" },
];

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const diff = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfPeriod(anchor: Date, mode: PeriodMode) {
  if (mode === "week") return startOfWeek(anchor);
  if (mode === "month") return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  if (mode === "year") return new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
  const quarterMonth = Math.floor(anchor.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(anchor.getUTCFullYear(), quarterMonth, 1));
}

function addPeriod(anchor: Date, mode: PeriodMode, amount: number) {
  const d = new Date(anchor);
  if (mode === "week") d.setUTCDate(d.getUTCDate() + amount * 7);
  if (mode === "month") d.setUTCMonth(d.getUTCMonth() + amount);
  if (mode === "quarter") d.setUTCMonth(d.getUTCMonth() + amount * 3);
  if (mode === "year") d.setUTCFullYear(d.getUTCFullYear() + amount);
  return startOfPeriod(d, mode);
}

function periodEnd(start: Date, mode: PeriodMode) {
  const end = addPeriod(start, mode, 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return end;
}

function periodLabel(start: Date, mode: PeriodMode) {
  const end = periodEnd(start, mode);
  if (mode === "month") {
    return start.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  if (mode === "quarter") {
    const quarter = Math.floor(start.getUTCMonth() / 3) + 1;
    return `Q${quarter} ${start.getUTCFullYear()}`;
  }
  if (mode === "year") return String(start.getUTCFullYear());
  return `${formatUKDateShort(toISODate(start))} - ${formatUKDateShort(toISODate(end))}`;
}

function kindMeta(kind: TimelineKind) {
  if (kind === "climb") {
    return {
      label: "Climb",
      icon: <Mountain className="h-4 w-4" />,
      className: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200",
    };
  }
  if (kind === "one_rm") {
    return {
      label: "1RM",
      icon: <Award className="h-4 w-4" />,
      className: "border-amber-500/30 bg-amber-500/[0.08] text-amber-200",
    };
  }
  if (kind === "bodyweight") {
    return {
      label: "Bodyweight",
      icon: <Scale className="h-4 w-4" />,
      className: "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-200",
    };
  }
  return {
    label: "Workout",
    icon: <Dumbbell className="h-4 w-4" />,
    className: "border-rose-500/30 bg-rose-500/[0.08] text-rose-200",
  };
}

function HistoryPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [anchor, setAnchor] = useState(() => startOfPeriod(new Date(), "month"));
  const [filter, setFilter] = useState<KindFilter>("all");
  const [selected, setSelected] = useState<TimelineEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const timeline = useQuery({
    queryKey: ["timeline"],
    queryFn: () => getTimelineDataClient(),
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSessionClient(id),
    onSuccess: () => {
      toast.success("Session deleted");
      setDeleteTarget(null);
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["timeline"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["recent-workouts"] });
      qc.invalidateQueries({ queryKey: ["recent-climbs"] });
      qc.invalidateQueries({ queryKey: ["exercise-history"] });
      qc.invalidateQueries({ queryKey: ["workout-lifecycle"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const start = startOfPeriod(anchor, mode);
  const end = periodEnd(start, mode);
  const startISO = toISODate(start);
  const endISO = toISODate(end);

  const allPeriodEntries = useMemo(() => {
    const rows = timeline.data?.entries ?? [];
    return rows.filter((entry) => entry.date >= startISO && entry.date <= endISO);
  }, [timeline.data?.entries, startISO, endISO]);

  const periodEntries = useMemo(
    () => allPeriodEntries.filter((entry) => filter === "all" || entry.kind === filter),
    [allPeriodEntries, filter],
  );

  const story = useMemo(
    () => (mode === "month" || mode === "year" ? buildTrainingStory(allPeriodEntries, mode) : null),
    [allPeriodEntries, mode],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    for (const entry of periodEntries) {
      const items = map.get(entry.date) ?? [];
      items.push(entry);
      map.set(entry.date, items);
    }
    return Array.from(map.entries())
      .map(([date, entries]) => {
        const sessionGroups = new Map<string, TimelineEntry[]>();
        for (const entry of entries) {
          const key =
            entry.kind === "workout" && entry.sessionId
              ? `session:${entry.sessionId}`
              : `entry:${entry.id}`;
          sessionGroups.set(key, [...(sessionGroups.get(key) ?? []), entry]);
        }
        const sessions = Array.from(sessionGroups.values()).map((members) => {
          if (members.length === 1) return members[0];
          const first = members[0];
          return {
            ...first,
            id: `session-${first.sessionId}`,
            title: first.subtitle || "Workout",
            subtitle: `${members.length} movements`,
            details: members.map((member) =>
              [member.title, ...member.details].filter(Boolean).join(" · "),
            ),
            notes: members
              .map((member) => member.notes)
              .filter(Boolean)
              .join("\n"),
            isPr: members.some((member) => member.isPr),
          } satisfies TimelineEntry;
        });
        return [date, sessions] as const;
      })
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [periodEntries]);

  const summary = useMemo(() => {
    const activeDays = new Set(periodEntries.map((entry) => entry.date));
    const workoutDays = new Set(
      periodEntries.filter((entry) => entry.kind === "workout").map((entry) => entry.date),
    );
    const climbHours = periodEntries
      .filter((entry) => entry.kind === "climb")
      .reduce((total, entry) => total + (entry.minutes ?? 0) / 60, 0);
    const prs = periodEntries.filter((entry) => entry.isPr).length;
    return {
      entries: periodEntries.length,
      activeDays: activeDays.size,
      workouts: workoutDays.size,
      climbHours: Math.round(climbHours * 10) / 10,
      prs,
    };
  }, [periodEntries]);

  const changeMode = (nextMode: PeriodMode) => {
    setMode(nextMode);
    setAnchor((current) => startOfPeriod(current, nextMode));
  };

  if (timeline.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history...
      </div>
    );
  }

  if (timeline.error || !timeline.data) {
    const message =
      timeline.error instanceof Error
        ? timeline.error.message
        : "Check the Supabase connection and try again.";
    return <Card className="p-6 text-sm text-destructive">Couldn’t load history. {message}</Card>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-muted-foreground">
            {periodLabel(start, mode)} · {summary.entries} entries · {summary.activeDays} active
            days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAnchor((current) => addPeriod(current, mode, -1))}
            aria-label="Previous period"
            title="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[150px] text-center text-sm font-medium">
            {periodLabel(start, mode)}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAnchor((current) => addPeriod(current, mode, 1))}
            aria-label="Next period"
            title="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border p-1">
          {PERIODS.map((period) => (
            <Button
              key={period.value}
              type="button"
              variant={mode === period.value ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => changeMode(period.value)}
            >
              {period.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={filter === item.value ? "secondary" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Entries" value={summary.entries.toString()} />
        <StatTile label="Active days" value={summary.activeDays.toString()} />
        <StatTile label="Workouts" value={summary.workouts.toString()} />
        <StatTile label="Climbing" value={`${summary.climbHours}h`} />
        <StatTile label="PRs" value={summary.prs.toString()} />
      </section>

      {story ? (
        <TrainingStoryCard
          story={story}
          title={
            mode === "year"
              ? `${start.getUTCFullYear()} in training`
              : `${periodLabel(start, mode)} story`
          }
        />
      ) : null}

      {grouped.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
          <Search className="h-5 w-5" />
          No history for this view.
        </Card>
      ) : (
        <section className="space-y-4">
          {grouped.map(([date, entries]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>{formatUKDate(date)}</span>
                <span className="h-px flex-1 bg-border" />
                <span>
                  {entries.length} session{entries.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-2">
                {entries.map((entry) => {
                  const meta = kindMeta(entry.kind);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelected(entry)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition hover:border-foreground/25",
                        meta.className,
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5">{meta.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-semibold text-foreground">
                              {entry.title}
                            </h2>
                            {entry.isPr && (
                              <Badge className="h-5 bg-amber-500 text-black">PR</Badge>
                            )}
                            {entry.kind === "workout" ? (
                              <WorkoutLifecycleBadge state="completed" />
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{entry.subtitle}</p>
                          {entry.details.length > 0 && (
                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                              {entry.details.join(" · ")}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {meta.label}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  {formatUKDate(selected.date)} · {selected.subtitle}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {selected.details.map((detail) => (
                    <Badge key={detail} variant="secondary">
                      {detail}
                    </Badge>
                  ))}
                </div>
                {selected.notes && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                    {selected.notes}
                  </div>
                )}
                {selected.sessionId && (
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={deleteMutation.isPending}
                      onClick={() =>
                        setDeleteTarget({
                          id: selected.sessionId ?? "",
                          title: selected.title,
                          description: `${selected.title} from ${formatUKDate(
                            selected.date,
                          )} will be permanently removed from your log. If this was a multi-exercise session, the whole session will be removed.`,
                        })
                      }
                      className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 h-4 w-4" />
                      )}
                      Delete session
                    </Button>
                  </DialogFooter>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        target={deleteTarget}
        busy={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={(id) => deleteMutation.mutate(id)}
      />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-rose-500/20 bg-rose-500/[0.04] p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </Card>
  );
}

function TrainingStoryCard({ story, title }: { story: TrainingStory; title: string }) {
  return (
    <Card className="border-violet-400/25 bg-gradient-to-br from-violet-400/[0.08] to-transparent p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg border border-violet-400/20 bg-violet-400/10 p-2 text-violet-300">
          <BookOpenText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-violet-100">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">{story.lead}</p>
          {story.highlights.length ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {story.highlights.join(" ")}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
