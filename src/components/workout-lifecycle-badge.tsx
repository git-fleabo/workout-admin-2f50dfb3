import { Badge } from "@/components/ui/badge";
import { WORKOUT_LIFECYCLE, type WorkoutLifecycleState } from "@/lib/workout-lifecycle";
import { cn } from "@/lib/utils";

const STATE_CLASSES: Record<WorkoutLifecycleState, string> = {
  planned: "border-cyan-400/35 bg-cyan-400/[0.08] text-cyan-200",
  ready: "border-violet-400/35 bg-violet-400/[0.08] text-violet-200",
  in_progress: "border-amber-400/35 bg-amber-400/[0.08] text-amber-200",
  completed: "border-emerald-400/35 bg-emerald-400/[0.08] text-emerald-200",
  skipped: "border-slate-400/35 bg-slate-400/[0.08] text-slate-300",
  archived: "border-border bg-muted/40 text-muted-foreground",
};

export function WorkoutLifecycleBadge({
  state,
  className,
}: {
  state: WorkoutLifecycleState;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("text-[10px]", STATE_CLASSES[state], className)}>
      {WORKOUT_LIFECYCLE[state].label}
    </Badge>
  );
}
