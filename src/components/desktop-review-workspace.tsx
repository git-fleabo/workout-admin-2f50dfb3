import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Award, Lightbulb, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUKDate, formatUKDateShort } from "@/lib/date";
import type { WeeklyReviewData, WeeklyReviewItem } from "@/lib/supabase-weekly-review.browser";
import { cn } from "@/lib/utils";

export type ReviewSection = "overview" | "goals" | "programme";

export function DesktopReviewWorkspace({
  data,
  header,
  summaryStats,
  emptyState,
  goals,
  programme,
  section,
  onSectionChange,
  onCurrentWeek,
}: {
  data: WeeklyReviewData;
  header: ReactNode;
  summaryStats: ReactNode;
  emptyState: ReactNode;
  goals: ReactNode;
  programme: ReactNode;
  section: ReviewSection;
  onSectionChange: (section: ReviewSection) => void;
  onCurrentWeek: () => void;
}) {
  const [selection, setSelection] = useState<{ week: string; id: string } | null>(null);
  const selected =
    data.sessions.find(
      (session) => selection?.week === data.weekStart && session.id === selection.id,
    ) ?? data.sessions[0];

  return (
    <div className="space-y-5" data-testid="desktop-review-workspace">
      {header}
      {emptyState}
      {summaryStats}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {data.comparisonLabel}. Current weeks use the same number of elapsed days.
        </p>
        {!data.isCurrentWeek ? (
          <Button variant="outline" size="sm" onClick={onCurrentWeek}>
            Back to this week
          </Button>
        ) : (
          <Badge variant="outline">Week in progress</Badge>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Tabs
          value={section}
          onValueChange={(value) => onSectionChange(value as ReviewSection)}
          className="min-w-0"
        >
          <TabsList aria-label="Review sections" className="mb-3">
            <TabsTrigger value="overview">Week overview</TabsTrigger>
            <TabsTrigger value="goals">Goals & progress</TabsTrigger>
            <TabsTrigger value="programme">Programme adjustments</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <h2 className="text-sm font-semibold">Programme & extra plans</h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {data.programmeCompletedThisWeek}
                    </p>
                    <p className="text-xs text-muted-foreground">Strength sessions completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {data.supportCompletedThisWeek}
                    </p>
                    <p className="text-xs text-muted-foreground">Supporting sessions completed</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Supporting work does not advance your strength position.
                </p>
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium">
                    {data.adherence.percentage == null
                      ? "No extra workout plans"
                      : `Extra plans · ${data.adherence.percentage}% completed`}
                  </p>
                  {data.adherence.percentage != null ? (
                    <Progress
                      value={data.adherence.percentage}
                      className="h-1.5"
                      aria-label="Extra workout plans completed"
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {data.adherence.completed} completed · {data.adherence.skipped} skipped ·{" "}
                    {data.adherence.open} open
                  </p>
                </div>
                <Link
                  to="/plan"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary"
                >
                  View my programme <ArrowRight className="h-3 w-3" />
                </Link>
              </Card>
              <Card className="p-4">
                <h2 className="text-sm font-semibold">Training mix</h2>
                <p className="mt-1 text-xs text-muted-foreground">Completed sessions by activity</p>
                <div className="mt-4 space-y-3">
                  {data.activityMix.length ? (
                    data.activityMix.map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex justify-between gap-2 text-xs">
                          <span>{item.label}</span>
                          <span className="tabular-nums">{item.sessions}</span>
                        </div>
                        <Progress
                          value={
                            data.summary.sessions
                              ? (item.sessions / data.summary.sessions) * 100
                              : 0
                          }
                          className="h-1.5"
                          aria-label={`${item.label} share of sessions`}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No completed activity to classify.
                    </p>
                  )}
                </div>
                {data.locations.length ? (
                  <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    {data.locations.map((item) => `${item.label} ${item.sessions}`).join(" · ")}
                  </p>
                ) : null}
              </Card>
            </div>

            <Card className="min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <h2 className="font-semibold">Completed sessions</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select a session to inspect its recorded activity.
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/history">
                    History <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              {data.sessions.length ? (
                <Table aria-label="Completed sessions">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Session</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="pr-4 text-right">RPE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sessions.map((session) => (
                      <TableRow
                        key={session.id}
                        data-state={selected?.id === session.id ? "selected" : undefined}
                      >
                        <TableCell className="max-w-64 pl-4">
                          <button
                            type="button"
                            className="w-full rounded-sm py-1 text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-pressed={selected?.id === session.id}
                            onClick={() => setSelection({ week: data.weekStart, id: session.id })}
                          >
                            <span className="block break-words">{session.title}</span>
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                              {session.activities.join(" · ")}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatUKDateShort(session.date)}
                        </TableCell>
                        <TableCell className="text-xs">{session.location}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                          {session.minutes > 0 ? `${session.minutes} min` : "—"}
                        </TableCell>
                        <TableCell className="pr-4 text-right text-xs tabular-nums">
                          {session.rpe ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-4 pb-5 text-sm text-muted-foreground">
                  No completed sessions in this period.
                </p>
              )}
              {selected ? (
                <section
                  aria-label="Selected session"
                  className="space-y-3 border-t border-border bg-muted/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Selected session
                      </p>
                      <h3 className="mt-1 break-words text-sm font-semibold">{selected.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatUKDate(selected.date)} · {selected.location}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link to="/history" search={{ session: selected.id }}>
                        Open full log <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.movements.map((movement) => (
                      <Badge variant="secondary" className="whitespace-normal" key={movement}>
                        {movement}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selected.minutes > 0
                      ? `${selected.minutes} minutes recorded`
                      : "Duration not recorded"}{" "}
                    · {selected.rpe != null ? `RPE ${selected.rpe}` : "Effort not recorded"}
                  </p>
                </section>
              ) : null}
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <ReviewSignals title="Wins and momentum" items={data.highlights} />
              <ReviewSignals title="Worth watching" items={data.watchlist} caution />
            </div>
          </TabsContent>
          <TabsContent value="goals">{goals}</TabsContent>
          <TabsContent value="programme">{programme}</TabsContent>
        </Tabs>

        <aside
          aria-label="Next steps"
          className="sticky top-48 max-h-[calc(100vh-13rem)] overflow-y-auto rounded-xl border border-primary/20 bg-card"
        >
          <div className="border-b border-border bg-primary/5 p-4">
            <Lightbulb className="mb-2 h-5 w-5 text-primary" />
            <h2 className="font-semibold">Suggested next step</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Based on {data.isCurrentWeek ? "this week’s" : "the selected week’s"} logged training.
            </p>
          </div>
          <div className="space-y-4 p-4">
            {data.actions.length ? (
              data.actions.map((action, index) => (
                <div key={action.title} className={cn(index > 0 && "border-t border-border pt-4")}>
                  <h3 className="text-sm font-semibold">{action.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {action.detail}
                  </p>
                  <p className="mt-2 text-xs text-primary">Because: {action.evidence}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No suggestions for this period yet.</p>
            )}
          </div>
          <div className="grid gap-2 border-t border-border p-4">
            <Button asChild size="sm">
              <Link to="/">
                Continue my programme <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/progress">Check exercise progress</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReviewSignals({
  title,
  items,
  caution = false,
}: {
  title: string;
  items: WeeklyReviewItem[];
  caution?: boolean;
}) {
  const Icon = caution ? TriangleAlert : Award;
  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn("h-4 w-4", caution ? "text-amber-500" : "text-primary")} />
        {title}
      </h2>
      <div className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={`${item.title}-${item.detail}`}
              className={cn(
                "border-l-2 pl-3",
                item.tone === "caution"
                  ? "border-amber-500/50"
                  : item.tone === "positive"
                    ? "border-primary/50"
                    : "border-border",
              )}
            >
              <h3 className="text-sm font-medium">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            {caution ? "No watch points flagged for this period." : "No highlights recorded yet."}
          </p>
        )}
      </div>
    </Card>
  );
}
