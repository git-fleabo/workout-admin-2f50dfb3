import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatUKDate, formatUKDateShort } from "@/lib/date";
import { formatGoalReviewValue } from "@/lib/goal-review";
import { cn } from "@/lib/utils";
import type { GoalTrend as GoalTrendData } from "@/lib/goal-trend";
import { buildGoalTrend } from "@/lib/goal-trend";

export function GoalTrendDisclosure({ input }: { input: Parameters<typeof buildGoalTrend>[0] }) {
  const [open, setOpen] = useState(false);
  if (input.goal.goalType === "milestone") return null;
  return (
    <details
      className="border-t border-border pt-2"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-xs font-medium">Four-week trend</summary>
      {open ? (
        <div className="mt-3">
          <GoalTrend key={input.weekStart} trend={buildGoalTrend(input)} />
        </div>
      ) : null}
    </details>
  );
}

export function GoalTrend({ trend }: { trend: GoalTrendData }) {
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const id = useId();
  const selected = trend.weeks.find((week) => week.start === selectedStart) ?? trend.weeks[3];
  const unit = trend.manual ? "check-ins" : trend.goal.targetUnit;
  const value = (number: number | null) => formatGoalReviewValue(number, unit);
  const maximum = Math.max(1, ...trend.weeks.map((week) => week.value ?? 0));
  const recordedWeeks = trend.weeks.filter((week) =>
    week.evidence.some((item) => !trend.measured || item.value != null),
  ).length;
  if (!trend.supported)
    return (
      <p className="text-xs text-muted-foreground">
        Choose an exercise and metric in Goals to show a measured trend.
      </p>
    );
  const weekValue = (week: typeof selected) => {
    if (week.value == null) return week.missingTime ? "Time not recorded" : "Not measured";
    return `${week.missingTime ? "At least " : ""}${value(week.value)}`;
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {trend.measured
          ? "Best measured result in each week. Missing weeks stay unmeasured."
          : trend.manual
            ? "Manual check-ins each week. Counts do not measure performance."
            : "Recorded totals in each week, rather than cumulative goal progress."}{" "}
        {trend.measured ? "Measurements" : trend.manual ? "Check-ins" : "Training recorded"} in{" "}
        {recordedWeeks} of 4 weeks.
      </p>
      <div
        role="group"
        aria-label={`${trend.goal.goal} weekly results`}
        className="grid grid-cols-4 gap-1"
      >
        {trend.weeks.map((week) => (
          <button
            key={week.start}
            type="button"
            aria-pressed={week.start === selected.start}
            aria-controls={`${id}-detail`}
            aria-label={`${formatUKDate(week.start)} to ${formatUKDate(week.end)}: ${weekValue(week)}${week.partialWeek ? ", week so far" : ""}`}
            onClick={() => setSelectedStart(week.start)}
            className={cn(
              "min-w-0 cursor-pointer rounded-lg border border-transparent px-1 py-2 text-center text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              week.start === selected.start
                ? "border-primary/50 bg-primary/10"
                : "hover:bg-muted/40",
            )}
          >
            <span className="flex h-12 items-center justify-center break-words font-medium leading-tight">
              {weekValue(week)}
            </span>
            <span
              aria-hidden="true"
              className="my-2 flex h-16 items-end justify-center rounded bg-muted/25 px-2"
            >
              {week.value == null ? (
                <span className="flex h-full w-full items-center justify-center rounded border border-dashed border-muted-foreground/40 text-muted-foreground">
                  —
                </span>
              ) : (
                <span
                  className={cn(
                    "w-full rounded-t",
                    week.value === 0
                      ? "border-t border-muted-foreground"
                      : week.missingTime
                        ? "border border-dashed border-primary bg-primary/30"
                        : "bg-primary",
                  )}
                  style={{ height: `${(week.value / maximum) * 100}%` }}
                />
              )}
            </span>
            <span className="block text-muted-foreground">{formatUKDateShort(week.start)}</span>
            <span className="block min-h-4 text-muted-foreground">
              {week.partialWeek ? "So far" : "Full week"}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Select a week to inspect its records. Bars compare weekly values; target progress stays in
        the goal summary. An incomplete week is not directly comparable with a full week.
      </p>
      <div
        id={`${id}-detail`}
        role="region"
        aria-labelledby={`${id}-heading`}
        aria-live="polite"
        className="space-y-2 rounded-lg border border-border p-3"
      >
        <h4 id={`${id}-heading`} className="text-xs font-semibold">
          {formatUKDateShort(selected.start)}–{formatUKDate(selected.end)}
          {selected.partialWeek ? " · Week so far" : ""}
        </h4>
        <p className="text-xs font-medium">
          {trend.measured ? "Best this week" : "Recorded this week"}: {weekValue(selected)}
        </p>
        {selected.missingTime ? (
          <p className="text-xs text-muted-foreground">
            Some sessions have no recorded duration. The time shown is incomplete.
          </p>
        ) : null}
        {selected.missingMeasurements > 0 ? (
          <p className="text-xs text-muted-foreground">
            {selected.missingMeasurements} logged session
            {selected.missingMeasurements === 1 ? " is" : "s are"} missing the selected measurement.
          </p>
        ) : null}
        {!selected.sourceCount ? (
          <p className="text-xs text-muted-foreground">
            {trend.measured
              ? "No measured result recorded this week. This does not establish whether performance changed."
              : trend.manual
                ? "No manual check-ins recorded this week."
                : "No completed sessions recorded this week."}
          </p>
        ) : null}
        {selected.best ? (
          <p className="text-xs">
            <Link
              to="/history"
              search={{ session: selected.best.sessionId ?? undefined }}
              className="text-primary underline underline-offset-4"
            >
              View this week’s best log · {formatUKDateShort(selected.best.date)}
            </Link>
          </p>
        ) : null}
        {selected.evidence.length ? (
          <ul className="space-y-2 border-t border-border pt-2 text-xs">
            {selected.evidence.slice(0, 6).map((item) => (
              <li key={item.id} className="break-words">
                {item.sessionId ? (
                  <Link
                    to="/history"
                    search={{ session: item.sessionId }}
                    className="text-primary underline underline-offset-4"
                  >
                    {formatUKDateShort(item.date)}
                    {item.value != null ? ` · ${value(item.value)}` : " · Completed session"}
                  </Link>
                ) : (
                  <span>{formatUKDateShort(item.date)} · Manual check-in</span>
                )}
                <span className="block text-muted-foreground">{item.note}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {selected.evidence.length > 6 ? (
          <p className="text-xs text-muted-foreground">
            Showing the latest 6 of {selected.evidence.length} records. Open History or exercise
            progress for the full record.
          </p>
        ) : null}
      </div>
    </div>
  );
}
