import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatUKDate } from "@/lib/date";
import type { WeekDay } from "@/lib/training-types";
import { dashboardDayLabel, dashboardDaySummary } from "@/lib/dashboard-day";
import { cn } from "@/lib/utils";

export function DesktopDashboardWeek({ days }: { days: WeekDay[] }) {
  const detailsId = useId();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected =
    days.find((day) => day.date === selectedDate) ??
    days.find((day) => day.isToday && day.entries.length > 0) ??
    [...days].reverse().find((day) => day.entries.length > 0 || day.workouts > 0) ??
    days.find((day) => day.isToday) ??
    days[0];

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="h-4 w-4 text-primary" /> This week
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a day to explore your logged training.
          </p>
        </div>
        <Link
          to="/history"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          History <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div
        role="group"
        aria-label="This week’s training"
        className="grid grid-cols-7 gap-2 px-4 pb-4"
      >
        {days.map((day) => {
          const active = day.date === selected?.date;
          const logged = day.entries.length > 0 || day.workouts > 0;
          return (
            <button
              key={day.date}
              type="button"
              aria-label={`${formatUKDate(day.date)} · ${dashboardDaySummary(day)}`}
              aria-pressed={active}
              aria-controls={detailsId}
              aria-current={day.isToday ? "date" : undefined}
              onClick={() => setSelectedDate(day.date)}
              className={cn(
                "flex min-w-0 flex-col items-center gap-2 rounded-lg border px-1 py-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-secondary/15 hover:border-primary/40 hover:bg-secondary/40",
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {day.label}
              </span>
              <span
                className={cn("text-xl font-semibold tabular-nums", day.isToday && "text-primary")}
              >
                {Number(day.date.slice(8, 10))}
              </span>
              <span
                className={cn("h-1.5 w-1.5 rounded-full", logged ? "bg-primary" : "bg-border")}
              />
              <span className="text-[11px] leading-tight text-muted-foreground">
                {dashboardDayLabel(day)}
              </span>
            </button>
          );
        })}
      </div>
      {selected ? (
        <section
          id={detailsId}
          aria-label="Selected day"
          className="border-t border-border bg-muted/15 p-4"
        >
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">{formatUKDate(selected.date)}</h3>
            <p className="text-xs text-muted-foreground">{dashboardDaySummary(selected)}</p>
          </div>
          <DashboardDayEntries day={selected} desktop />
        </section>
      ) : (
        <p className="px-4 pb-4 text-sm text-muted-foreground">No days available for this week.</p>
      )}
    </Card>
  );
}

export function DashboardDayEntries({ day, desktop = false }: { day: WeekDay; desktop?: boolean }) {
  if (!day.entries.length) {
    return <p className="text-sm text-muted-foreground">Nothing logged for this day.</p>;
  }
  return (
    <ul
      className={
        desktop
          ? "grid grid-cols-2 items-start gap-3"
          : "max-h-[68vh] space-y-3 overflow-y-auto pr-1"
      }
    >
      {day.entries.map((entry, index) => (
        <li
          key={`${entry.exercise}-${index}`}
          className="min-w-0 rounded-lg border border-border/60 bg-secondary/20 p-3.5"
        >
          <p className="break-words text-sm font-medium">{entry.exercise}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            {entry.activityLabel}
            {!entry.counts && entry.activityLabel !== "Climbing" ? " · no credit" : ""}
          </p>
          {entry.details.length ? (
            <dl className={cn("mt-3 grid grid-cols-2 gap-2 text-xs", !desktop && "sm:grid-cols-3")}>
              {entry.details.map((detail) => (
                <div
                  key={`${detail.label}-${detail.value}`}
                  className="min-w-0 rounded border border-border/40 bg-background/40 px-2 py-1"
                >
                  <dt className="break-words text-[10px] uppercase tracking-wider text-muted-foreground">
                    {detail.label}
                  </dt>
                  <dd className="break-words text-sm font-medium">{detail.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No performance details were recorded.
            </p>
          )}
          {entry.notes ? (
            <p className="mt-3 break-words border-t border-border/50 pt-2 text-xs text-muted-foreground">
              {entry.notes}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
