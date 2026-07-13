import {
  ArrowRight,
  Building2,
  CalendarRange,
  CheckCircle2,
  Home,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUKDateShort } from "@/lib/date";
import type { PlannerLocation } from "@/lib/workout-plan";
import type { WeeklyPlan, WeeklyPlanLocation } from "@/lib/weekly-plan";
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

function dayName(date: string, long = false) {
  const parsed = new Date(`${date}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: long ? "long" : "short",
    timeZone: "UTC",
  }).format(parsed);
}

function LocationBadge({ location }: { location: PlannerLocation }) {
  const style = LOCATION_STYLE[location];
  const Icon = style.icon;
  return (
    <Badge variant="outline" className={cn("text-[10px]", style.badge)}>
      <Icon className="mr-1 h-3 w-3" /> {style.label}
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
  onChooseLocation,
}: {
  plan: WeeklyPlan;
  onChooseLocation: (location: PlannerLocation) => void;
}) {
  return (
    <section className="space-y-3" aria-labelledby="weekly-plan-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="weekly-plan-heading" className="flex items-center gap-2 text-base font-semibold">
            <CalendarRange className="h-4 w-4 text-fuchsia-300" /> Next 7 days
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Expected days and rotations inferred from your location-labelled history.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {formatUKDateShort(plan.startDate)}–{formatUKDateShort(plan.endDate)}
        </Badge>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:overflow-visible">
        {plan.days.map((day, index) => {
          const completed = day.completed.length > 0;
          return (
            <div
              key={day.date}
              className={cn(
                "min-h-[104px] w-[116px] shrink-0 rounded-xl border p-3 sm:w-auto",
                index === 0 ? "border-fuchsia-400/30 bg-fuchsia-400/[0.06]" : "border-border",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {index === 0 ? "Today" : dayName(day.date)}
              </p>
              <p className="mt-0.5 text-sm font-medium">{formatUKDateShort(day.date)}</p>
              <div className="mt-3 flex flex-col items-start gap-1.5">
                {day.completed.map((location) => (
                  <div key={`done-${location}`} className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    <LocationBadge location={location} />
                  </div>
                ))}
                {day.expected
                  .filter((location) => !day.completed.includes(location))
                  .map((location) => (
                    <LocationBadge key={location} location={location} />
                  ))}
                {!completed && day.expected.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground/70">Open</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PatternCard plan={plan.locations.home} onChoose={onChooseLocation} />
        <PatternCard plan={plan.locations.gym} onChoose={onChooseLocation} />
      </div>
    </section>
  );
}
