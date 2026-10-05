import { Activity, CalendarRange, Gauge, Repeat2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { WeeklyCoachAdaptation } from "@/lib/weekly-coach-adaptation";

export function WeeklyCoachAdaptationSummary({
  adaptation,
}: {
  adaptation: WeeklyCoachAdaptation;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-fuchsia-300" />
            <p className="text-sm font-semibold">Adaptive coach stance</p>
          </div>
          <p className="mt-2 text-sm font-medium">{adaptation.title}</p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{adaptation.detail}</p>
        </div>
        <Badge
          variant="outline"
          className={
            adaptation.mode === "protect"
              ? "border-amber-400/40 text-amber-200"
              : adaptation.mode === "build"
                ? "border-emerald-400/40 text-emerald-200"
                : "border-blue-400/40 text-blue-200"
          }
        >
          {adaptation.mode === "protect"
            ? "Protect"
            : adaptation.mode === "build"
              ? "Build"
              : "Maintain"}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-background/25 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Repeat2 className="h-3.5 w-3.5" /> Frequency
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{adaptation.frequencyAction}</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/25 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Activity className="h-3.5 w-3.5" /> Dose
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{adaptation.doseAction}</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/25 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <CalendarRange className="h-3.5 w-3.5" /> Placement
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{adaptation.placementAction}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {adaptation.evidence.map((item) => (
          <Badge key={item} variant="secondary" className="whitespace-normal text-left">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}
