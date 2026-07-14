import { Archive, CheckCircle2, CircleDot, Clock3, Play, XCircle } from "lucide-react";

import { WorkoutLifecycleBadge } from "@/components/workout-lifecycle-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUKDate } from "@/lib/date";
import type { WorkoutLifecycleRecord } from "@/lib/supabase-plans.browser";
import {
  WORKOUT_LIFECYCLE,
  workoutPlanLifecycleState,
  type WorkoutLifecycleState,
} from "@/lib/workout-lifecycle";

const PRIMARY_STATES: Array<{
  state: WorkoutLifecycleState;
  icon: React.ReactNode;
}> = [
  { state: "planned", icon: <Clock3 className="h-4 w-4" /> },
  { state: "ready", icon: <CircleDot className="h-4 w-4" /> },
  { state: "in_progress", icon: <Play className="h-4 w-4" /> },
  { state: "completed", icon: <CheckCircle2 className="h-4 w-4" /> },
];

export function WorkoutLifecyclePanel({
  records,
  activeDraftPlanId,
  loading = false,
  error = false,
}: {
  records: WorkoutLifecycleRecord[];
  activeDraftPlanId?: string | null;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-sm">Workout lifecycle</CardTitle>
        <p className="text-xs text-muted-foreground">
          Plans and completed sessions stay in Supabase. In-progress drafts autosave on this device.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {PRIMARY_STATES.map(({ state, icon }, index) => (
            <div
              key={state}
              className="relative rounded-lg border border-border bg-secondary/20 p-3"
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className="text-muted-foreground">{icon}</span>
                {WORKOUT_LIFECYCLE[state].label}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {WORKOUT_LIFECYCLE[state].description}
              </p>
              {index < PRIMARY_STATES.length - 1 ? (
                <span className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 bg-background px-0.5 text-muted-foreground lg:block">
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <p className="text-xs font-medium">Recent plan activity</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Skipped
              </span>
              <span className="inline-flex items-center gap-1">
                <Archive className="h-3 w-3" /> Archived means no longer active
              </span>
            </div>
          </div>
          {loading ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">Loading workout activity…</p>
          ) : error ? (
            <p className="px-3 py-4 text-xs text-destructive">
              Workout activity could not be loaded.
            </p>
          ) : records.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              Saved plans will appear here as they move through the lifecycle.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {records.slice(0, 6).map((record) => {
                const state = workoutPlanLifecycleState(
                  record.status,
                  record.id,
                  activeDraftPlanId,
                );
                return (
                  <div
                    key={record.id}
                    className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{record.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {record.locationName ?? record.locationKind ?? "No location"}
                        {record.movements.length ? ` · ${record.movements.join(", ")}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {formatUKDate(record.updatedAt.slice(0, 10))}
                      </span>
                      <WorkoutLifecycleBadge state={state} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
