import { Activity, CalendarDays, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { WeeklyCoachCapacity, WeeklyCoachCapacityKind } from "@/lib/weekly-coach-capacity";

const KIND_LABEL: Record<WeeklyCoachCapacityKind, string> = {
  strength: "Strength",
  climbing: "Climbing",
  conditioning: "Conditioning",
  yoga: "Yoga",
  mobility: "Mobility",
  skill: "Skills",
  other: "Other",
};

function percentage(value: number, limit: number) {
  return limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0;
}

export function WeeklyCoachCapacitySummary({
  capacity,
  title = "Planned capacity",
}: {
  capacity: WeeklyCoachCapacity;
  title?: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{capacity.headline}</p>
        </div>
        <Badge
          variant="outline"
          className={
            capacity.status === "over_limit"
              ? "border-destructive/40 text-destructive"
              : capacity.status === "near_limit"
                ? "border-amber-400/40 text-amber-200"
                : "border-emerald-400/40 text-emerald-200"
          }
        >
          {capacity.status === "over_limit"
            ? "Over capacity"
            : capacity.status === "near_limit"
              ? "Near capacity"
              : "Fits capacity"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2 rounded-lg bg-secondary/25 p-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock3 className="h-3.5 w-3.5" /> Minutes
            </span>
            <span>
              {capacity.plannedMinutes}/{capacity.weeklyMinutes}
            </span>
          </div>
          <Progress value={percentage(capacity.plannedMinutes, capacity.weeklyMinutes)} />
        </div>
        <div className="space-y-2 rounded-lg bg-secondary/25 p-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <CalendarDays className="h-3.5 w-3.5" /> Training days
            </span>
            <span>
              {capacity.plannedDays}/{capacity.weeklyTrainingDays}
            </span>
          </div>
          <Progress value={percentage(capacity.plannedDays, capacity.weeklyTrainingDays)} />
        </div>
        <div className="space-y-2 rounded-lg bg-secondary/25 p-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="h-3.5 w-3.5" /> Demanding days
            </span>
            <span>
              {capacity.demandingDays}/{capacity.maxDemandingDays}
            </span>
          </div>
          <Progress value={percentage(capacity.demandingDays, capacity.maxDemandingDays)} />
        </div>
      </div>

      {capacity.byKind.length ? (
        <div className="flex flex-wrap gap-1.5">
          {capacity.byKind.map((summary) => (
            <Badge key={summary.kind} variant="secondary">
              {KIND_LABEL[summary.kind]} · {summary.sessions} · ~{summary.minutes} min
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No saved training is using capacity yet.</p>
      )}
    </div>
  );
}
