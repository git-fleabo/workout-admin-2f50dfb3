import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsBackLink } from "@/components/settings-back-link";
import {
  applyDataQualityFixClient,
  getDataQualityAuditClient,
  type DataQualityFix,
  type DataQualityRow,
} from "@/lib/supabase-data-quality.browser";
import { formatUKDate } from "@/lib/date";

export const Route = createFileRoute("/data-quality")({
  head: () => ({
    meta: [
      { title: "Data Quality · Training Tracker" },
      {
        name: "description",
        content: "Review and safely repair historical workout data quality.",
      },
    ],
  }),
  component: DataQualityPage,
});

function ConfidenceBadge({ row }: { row: DataQualityRow }) {
  if (row.confidence === "high") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        High confidence
      </Badge>
    );
  }
  if (row.confidence === "ambiguous") {
    return <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-200">Ambiguous</Badge>;
  }
  if (row.confidence === "manual") {
    return <Badge variant="outline">Manual review</Badge>;
  }
  return null;
}

function DataQualityPage() {
  const queryClient = useQueryClient();
  const [repairRow, setRepairRow] = useState<DataQualityRow | null>(null);
  const audit = useQuery({
    queryKey: ["data-quality-audit"],
    queryFn: getDataQualityAuditClient,
    staleTime: 60_000,
    refetchOnMount: "always",
  });
  const repair = useMutation({
    mutationFn: ({ fix, payload }: { fix: DataQualityFix; payload: Record<string, unknown> }) =>
      applyDataQualityFixClient(fix.action, fix.entityId, payload),
    onSuccess: async () => {
      setRepairRow(null);
      toast.success("Repair applied and audit trail saved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["data-quality-audit"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["history"] }),
        queryClient.invalidateQueries({ queryKey: ["progress"] }),
        queryClient.invalidateQueries({ queryKey: ["timeline"] }),
        queryClient.invalidateQueries({ queryKey: ["exercise-history"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-workouts"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (audit.isLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking training data…
      </div>
    );
  }

  if (audit.isError || !audit.data) {
    return (
      <Card className="mx-auto max-w-2xl space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold text-destructive">
          <AlertTriangle className="h-5 w-5" /> Audit unavailable
        </div>
        <p className="text-sm text-muted-foreground">
          {audit.error instanceof Error ? audit.error.message : "The audit could not be loaded."}
        </p>
        <Button variant="outline" onClick={() => audit.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  const totalIssues = audit.data.categories.reduce(
    (total, category) => total + category.rows.length,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-4 border-b border-border pb-5">
        <SettingsBackLink />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
              <DatabaseZap className="h-4 w-4" /> Supabase audit
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Data Quality</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review historical ambiguity and apply narrow, validated repairs. Every change saves a
              private rollback snapshot and an audit event.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => audit.refetch()}
              disabled={audit.isFetching}
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${audit.isFetching ? "animate-spin" : ""}`} />
              {audit.isFetching ? "Refreshing…" : "Refresh audit"}
            </Button>
            <Badge variant="outline" className="border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
              Audited repairs
            </Badge>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-2xl font-semibold">{audit.data.sessionCount}</div>
            <div className="text-xs text-muted-foreground">Completed sessions audited</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-semibold">{totalIssues}</div>
            <div className="text-xs text-muted-foreground">Rows and candidate groups surfaced</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium">
              {new Date(audit.data.capturedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              Last live refresh · runs on open, not on a schedule
            </div>
          </Card>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {audit.data.categories.map((category) => (
          <Card key={category.key} className="overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="font-semibold">{category.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {category.description}
                </p>
              </div>
              <div className="flex gap-2">
                {category.rows.some((row) => row.fix) ? (
                  <Badge variant="outline">
                    {category.rows.filter((row) => row.fix).length} fixable
                  </Badge>
                ) : null}
                <Badge variant="secondary">{category.rows.length}</Badge>
              </div>
            </div>
            {category.rows.length ? (
              <div className="max-h-96 divide-y divide-border overflow-y-auto">
                {category.rows.map((row) => (
                  <div key={`${category.key}:${row.id}`} className="space-y-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{row.title}</div>
                        {row.date ? (
                          <div className="text-xs text-muted-foreground">
                            {formatUKDate(row.date)}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <ConfidenceBadge row={row} />
                        {row.fix ? (
                          <Button size="sm" variant="outline" onClick={() => setRepairRow(row)}>
                            <Wrench className="mr-1 h-3.5 w-3.5" /> Repair
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Review only
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{row.detail}</p>
                    <code className="block break-all text-[10px] text-muted-foreground/70">
                      {row.id}
                    </code>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-4 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> No rows in this category
              </div>
            )}
          </Card>
        ))}
      </div>
      <RepairDialog
        row={repairRow}
        exerciseOptions={audit.data.exerciseOptions}
        pending={repair.isPending}
        onClose={() => setRepairRow(null)}
        onApply={(fix, payload) => repair.mutate({ fix, payload })}
      />
    </div>
  );
}

const LOAD_OPTIONS = [
  ["total_external_load", "Total external load"],
  ["per_implement_load", "Per implement"],
  ["combined_implement_load", "Combined implements"],
  ["added_bodyweight_load", "Added bodyweight load"],
  ["assistance", "Assistance"],
  ["bodyweight_contribution", "Bodyweight contribution"],
] as const;

function RepairDialog({
  row,
  exerciseOptions,
  pending,
  onClose,
  onApply,
}: {
  row: DataQualityRow | null;
  exerciseOptions: Array<{ id: string; name: string; activityTypeId: string | null }>;
  pending: boolean;
  onClose: () => void;
  onApply: (fix: DataQualityFix, payload: Record<string, unknown>) => void;
}) {
  const fix = row?.fix;
  const [exerciseId, setExerciseId] = useState("");
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState("");
  const [loadSemantics, setLoadSemantics] = useState("");
  const [implementCount, setImplementCount] = useState("");

  useEffect(() => {
    setExerciseId("");
    setDuration(
      fix?.action === "update_session_metadata" && fix.durationMinutes != null
        ? String(fix.durationMinutes)
        : "",
    );
    setRpe(fix?.action === "update_session_metadata" && fix.rpe != null ? String(fix.rpe) : "");
    setLoadSemantics(
      fix?.action === "classify_load" &&
        fix.loadSemantics &&
        !["unknown", "none"].includes(fix.loadSemantics)
        ? fix.loadSemantics
        : "",
    );
    setImplementCount(
      fix?.action === "classify_load" && fix.implementCount != null
        ? String(fix.implementCount)
        : "",
    );
  }, [fix]);

  if (!row || !fix) return null;

  const payload =
    fix.action === "link_exercise"
      ? { exercise_id: exerciseId }
      : fix.action === "update_session_metadata"
        ? { duration_minutes: duration, rpe }
        : fix.action === "classify_load"
          ? {
              load_semantics: loadSemantics,
              implement_count: loadSemantics === "per_implement_load" ? implementCount : null,
            }
          : {};
  const disabled =
    pending ||
    (fix.action === "link_exercise" && !exerciseId) ||
    (fix.action === "update_session_metadata" && !duration && !rpe) ||
    (fix.action === "classify_load" &&
      (!loadSemantics || (loadSemantics === "per_implement_load" && !implementCount)));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Repair {row.title}</DialogTitle>
          <DialogDescription>
            This is applied immediately. The original row is preserved in a private rollback
            snapshot and the change is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {fix.action === "link_exercise" ? (
            <div className="space-y-2">
              <Label>Canonical exercise</Label>
              <Select value={exerciseId} onValueChange={setExerciseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an exercise" />
                </SelectTrigger>
                <SelectContent>
                  {exerciseOptions.map((exercise) => (
                    <SelectItem key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The movement name and activity type will use the selected exercise.
              </p>
            </div>
          ) : null}

          {fix.action === "update_session_metadata" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="repair-duration">Duration (minutes)</Label>
                <Input
                  id="repair-duration"
                  type="number"
                  min="1"
                  max="1440"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repair-rpe">Final RPE (1–10)</Label>
                <Input
                  id="repair-rpe"
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  value={rpe}
                  onChange={(event) => setRpe(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {fix.action === "classify_load" ? (
            <>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                Recorded load: {fix.weight} kg
                {fix.equipment ? ` · ${fix.equipment}` : ""}
              </div>
              <div className="space-y-2">
                <Label>What does the recorded load mean?</Label>
                <Select value={loadSemantics} onValueChange={setLoadSemantics}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose load meaning" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOAD_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {loadSemantics === "per_implement_load" ? (
                <div className="space-y-2">
                  <Label htmlFor="repair-implements">Number of implements</Label>
                  <Input
                    id="repair-implements"
                    type="number"
                    min="1"
                    max="10"
                    value={implementCount}
                    onChange={(event) => setImplementCount(event.target.value)}
                  />
                </div>
              ) : null}
            </>
          ) : null}

          {fix.action === "delete_empty_set" ? (
            <p className="rounded-md border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">
              This set has no reps, load, duration, distance, RPE, notes, rest, assistance or method
              segments. It will be removed.
            </p>
          ) : null}

          {fix.action === "clear_session_provenance" || fix.action === "clear_entry_provenance" ? (
            <p className="text-sm text-muted-foreground">
              Retired spreadsheet source fields will be cleared. The workout data itself is
              unchanged.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onApply(fix, payload)} disabled={disabled}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply audited repair
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
