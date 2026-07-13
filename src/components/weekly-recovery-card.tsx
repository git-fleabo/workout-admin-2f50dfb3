import { BatteryLow, CheckCircle2, Gauge, RotateCcw, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeeklyRecoveryMode, WeeklyRecoveryRecommendation } from "@/lib/weekly-recovery";
import { cn } from "@/lib/utils";

const LEVEL_STYLE = {
  normal: {
    icon: CheckCircle2,
    label: "Continue",
    card: "border-emerald-400/20 bg-emerald-400/[0.04]",
    badge: "border-emerald-400/30 text-emerald-300",
  },
  lighter: {
    icon: BatteryLow,
    label: "Lighter exposure",
    card: "border-amber-400/20 bg-amber-400/[0.04]",
    badge: "border-amber-400/30 text-amber-300",
  },
  deload: {
    icon: TriangleAlert,
    label: "Deload signal",
    card: "border-rose-400/20 bg-rose-400/[0.04]",
    badge: "border-rose-400/30 text-rose-300",
  },
} as const;

export function WeeklyRecoveryCard({
  recommendation,
  mode,
  onUseLighterWorkout,
  onApplyDeload,
  onReturnToNormal,
}: {
  recommendation: WeeklyRecoveryRecommendation;
  mode: WeeklyRecoveryMode;
  onUseLighterWorkout: () => void;
  onApplyDeload: () => void;
  onReturnToNormal: () => void;
}) {
  const style = LEVEL_STYLE[recommendation.level];
  const Icon = style.icon;
  const deloadActive = mode === "deload";
  return (
    <Card className={cn(deloadActive ? "border-violet-400/30 bg-violet-400/[0.06]" : style.card)}>
      <CardHeader className="p-4 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4" /> Recovery decision
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Combined workout, other-load, effort, and performance evidence.
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              deloadActive ? "border-violet-400/40 text-violet-300" : style.badge,
            )}
          >
            {deloadActive ? "Deload week active" : style.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-2">
        <div className="flex gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">
              {deloadActive ? "Deload week applied" : recommendation.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {deloadActive
                ? "Strength workouts use the Tired targets: one fewer set and about 10% less load. Your planned days and completed history stay intact."
                : recommendation.detail}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {recommendation.evidence.map((item) => (
            <div
              key={item}
              className="rounded-lg border border-border/70 bg-background/25 p-2.5 text-xs text-muted-foreground"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {deloadActive ? (
            <Button variant="outline" size="sm" onClick={onReturnToNormal}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Return to normal week
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onUseLighterWorkout}>
                <BatteryLow className="mr-1 h-3.5 w-3.5" /> Use lighter next workout
              </Button>
              {recommendation.level !== "normal" ? (
                <Button size="sm" onClick={onApplyDeload}>
                  Apply deload week
                </Button>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
