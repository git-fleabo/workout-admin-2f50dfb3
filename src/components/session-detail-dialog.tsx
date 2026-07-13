import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Layers3, Loader2, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUKDate } from "@/lib/date";
import {
  getSessionDetailClient,
  type SessionDetailEntry,
  type SessionDetailSet,
} from "@/lib/supabase-session-detail.browser";

function displayValue(value: number | string | null | undefined) {
  return value == null || String(value).trim() === "" ? null : String(value).trim();
}

function setParts(set: SessionDetailSet) {
  const weight = displayValue(set.weight);
  const reps = displayValue(set.reps);
  const duration = displayValue(set.durationSeconds);
  const rpe = displayValue(set.rpe);
  return [
    weight ? `${weight} kg` : "",
    reps ? `${reps} reps` : "",
    duration ? `${duration}s` : "",
    rpe ? `RPE ${rpe}` : "",
  ].filter(Boolean);
}

function movementMeta(entry: SessionDetailEntry) {
  return [entry.workoutType, entry.entryKind, entry.progressionLevel]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function MovementDetail({ entry }: { entry: SessionDetailEntry }) {
  const aggregate = entry.sets.length === 1 && Number(entry.sets[0]?.setNumber ?? 0) > 1;
  return (
    <section className="rounded-xl border border-border bg-secondary/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{entry.name}</h3>
          {movementMeta(entry).length ? (
            <p className="mt-1 text-xs text-muted-foreground">{movementMeta(entry).join(" · ")}</p>
          ) : null}
        </div>
        {entry.completed ? (
          <Badge variant="outline" className="border-emerald-400/30 text-emerald-300">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
          </Badge>
        ) : null}
      </div>

      {entry.sets.length ? (
        <div className="mt-3 space-y-2">
          {entry.sets.map((set, index) => {
            const details = setParts(set);
            const assistance = [set.assistanceType, set.assistanceDetail]
              .map(displayValue)
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={`${entry.id}-${index}`}
                className="rounded-lg border border-border/70 bg-background/35 p-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                    {aggregate ? `${set.setNumber} sets` : `Set ${set.setNumber ?? index + 1}`}
                  </span>
                  <span>{details.join(" · ") || "Recorded set"}</span>
                </div>
                {assistance || set.restTime || set.quality ? (
                  <p className="mt-1 pl-0 text-[11px] text-muted-foreground sm:pl-[76px]">
                    {[
                      assistance ? `Assistance: ${assistance}` : "",
                      set.restTime ? `Rest: ${set.restTime}` : "",
                      set.quality ? `Quality: ${set.quality}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {set.segments.length ? (
                  <div className="mt-2 space-y-1.5 sm:ml-[76px]">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-fuchsia-300">
                      {set.segments[0]?.methodName}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {set.segments.map((segment, segmentIndex) => (
                        <span
                          key={segmentIndex}
                          className="rounded-md border border-fuchsia-400/20 bg-fuchsia-400/[0.06] px-2 py-1 text-[11px]"
                        >
                          {segmentIndex + 1}.{" "}
                          {displayValue(segment.weight) ? `${segment.weight} kg` : "—"}
                          {displayValue(segment.reps) ? ` × ${segment.reps}` : ""}
                          {displayValue(segment.rpe) ? ` · RPE ${segment.rpe}` : ""}
                          {displayValue(segment.restAfterSeconds)
                            ? ` · ${segment.restAfterSeconds}s rest`
                            : ""}
                          {segment.rangeOfMotion === "partial" ? " · partial" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {entry.metrics.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.metrics.map((metric) => {
            const value = displayValue(metric.text ?? metric.value);
            return value ? (
              <Badge key={metric.key} variant="secondary" className="font-normal">
                {metric.key.replaceAll("_", " ")}: {value}
                {metric.unit ? ` ${metric.unit}` : ""}
              </Badge>
            ) : null;
          })}
        </div>
      ) : null}

      {entry.notes ? (
        <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">{entry.notes}</p>
      ) : null}
    </section>
  );
}

export function SessionDetailDialog({
  sessionId,
  onOpenChange,
}: {
  sessionId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useQuery({
    queryKey: ["session-detail", sessionId],
    queryFn: () => getSessionDetailClient(sessionId ?? ""),
    enabled: Boolean(sessionId),
    staleTime: 60_000,
  });
  const session = detail.data;

  return (
    <Dialog open={Boolean(sessionId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {detail.isLoading ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Workout details</DialogTitle>
              <DialogDescription>Loading the selected workout.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading workout…
            </div>
          </>
        ) : detail.error ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Workout details unavailable</DialogTitle>
              <DialogDescription>The selected workout could not be loaded.</DialogDescription>
            </DialogHeader>
            <div className="py-10 text-center text-sm text-destructive">
              {detail.error instanceof Error
                ? detail.error.message
                : "This workout could not be loaded."}
            </div>
          </>
        ) : session ? (
          <>
            <DialogHeader>
              <DialogTitle>{session.title}</DialogTitle>
              <DialogDescription>{formatUKDate(session.date)}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              {session.location?.name ? (
                <Badge variant="outline" className="capitalize">
                  <MapPin className="mr-1 h-3 w-3" /> {session.location.name}
                </Badge>
              ) : null}
              {displayValue(session.durationMinutes) ? (
                <Badge variant="outline">
                  <Clock className="mr-1 h-3 w-3" /> {session.durationMinutes} min
                </Badge>
              ) : null}
              {session.intensity ? <Badge variant="outline">{session.intensity}</Badge> : null}
              {displayValue(session.rpe) ? (
                <Badge variant="outline">Session RPE {session.rpe}</Badge>
              ) : null}
            </div>

            {session.methodBlocks.length ? (
              <div className="space-y-2">
                {session.methodBlocks.map((block) => {
                  const movementNames = block.memberEntryIds
                    .map((entryId) => session.entries.find((entry) => entry.id === entryId)?.name)
                    .filter(Boolean);
                  return (
                    <div
                      key={block.id}
                      className="rounded-xl border border-indigo-400/30 bg-indigo-400/[0.06] p-4"
                    >
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <Layers3 className="h-4 w-4 text-indigo-300" /> {block.methodName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {movementNames.join(" → ")}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[
                          block.rounds ? `${block.rounds} rounds` : "",
                          block.restBetweenMovementsSeconds != null
                            ? `${block.restBetweenMovementsSeconds}s between movements`
                            : "",
                          block.restBetweenRoundsSeconds != null
                            ? `${block.restBetweenRoundsSeconds}s between rounds`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="space-y-3">
              {session.entries.length ? (
                session.entries.map((entry) => <MovementDetail key={entry.id} entry={entry} />)
              ) : (
                <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                  No movement details were recorded for this session.
                </div>
              )}
            </div>

            {session.notes ? (
              <div className="rounded-lg border border-border bg-secondary/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Session notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{session.notes}</p>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
