import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  addClimbClient,
  BOARD_GRADIENTS,
  deleteSessionClient,
  getLibraryClient,
  getRecentClimbsClient,
} from "@/lib/supabase-log.browser";
import { formatUKDate, todayISO } from "@/lib/date";
import { DateInput, Field, SimpleSelect, RecentList, type RecentEntry } from "./-form-bits";

const today = todayISO;

type ClimbState = {
  date: string;
  type: string;
  trackingMode: string;
  hours: string;
  boulders: string;
  grade: string;
  gradient: string;
  intensity: string;
  rpe: string;
  completed: boolean;
  notes: string;
};

const blank = (): ClimbState => ({
  date: today(),
  type: "",
  trackingMode: "Hours",
  hours: "",
  boulders: "",
  grade: "",
  gradient: "",
  intensity: "",
  rpe: "",
  completed: true,
  notes: "",
});

export function ClimbingForm() {
  const qc = useQueryClient();
  const lib = useQuery({ queryKey: ["library"], queryFn: getLibraryClient });
  const recent = useQuery({ queryKey: ["recent-climbs"], queryFn: getRecentClimbsClient });

  const [form, setForm] = useState<ClimbState>(blank);
  const update = <K extends keyof ClimbState>(k: K, v: ClimbState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const mutate = useMutation({
    mutationFn: () => addClimbClient(form),
    onSuccess: () => {
      toast.success("Climb saved", {
        description: `${form.type || "Climbing"} was added to your log.`,
      });
      setForm((f) => ({ ...blank(), date: f.date, type: f.type, trackingMode: f.trackingMode }));
      qc.invalidateQueries({ queryKey: ["recent-climbs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSessionClient(id),
    onSuccess: () => {
      toast.success("Climb deleted");
      qc.invalidateQueries({ queryKey: ["recent-climbs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.date && (form.hours || form.boulders) && !mutate.isPending;

  const recentEntries: RecentEntry[] =
    recent.data?.recent.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.type || "Climbing",
      meta:
        [
          r.hours && `${r.hours}h`,
          r.boulders && `${r.boulders} boulders`,
          r.grade,
          r.gradient,
          r.rpe && `RPE ${r.rpe}`,
        ]
          .filter(Boolean)
          .join(" · ") || r.trackingMode,
      completed: r.completed,
    })) ?? [];

  return (
    <div className="space-y-6">
      <Card className="space-y-5 border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">New climbing session</h2>
          <Badge variant="outline" className="gap-1 border-border text-muted-foreground">
            <Calendar className="h-3 w-3" /> {formatUKDate(form.date)}
          </Badge>
        </div>

        <Field label="Date">
          <DateInput value={form.date} onChange={(v) => update("date", v)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <SimpleSelect
              value={form.type}
              onChange={(v) => update("type", v)}
              options={lib.data?.climbingTypes ?? ["Climbing", "Bouldering"]}
            />
          </Field>
          <Field label="Tracking">
            <SimpleSelect
              value={form.trackingMode}
              onChange={(v) => update("trackingMode", v)}
              options={lib.data?.trackingModes ?? ["Hours", "Boulders"]}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Hours">
            <Input
              inputMode="decimal"
              value={form.hours}
              onChange={(e) => update("hours", e.target.value)}
              placeholder="e.g. 1.5"
            />
          </Field>
          <Field label="Boulders">
            <Input
              inputMode="numeric"
              value={form.boulders}
              onChange={(e) => update("boulders", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Grade">
            <Input
              value={form.grade}
              onChange={(e) => update("grade", e.target.value)}
              placeholder="V4, 6a…"
            />
          </Field>
          <Field label="Board gradient">
            <SimpleSelect
              value={form.gradient}
              onChange={(v) => update("gradient", v)}
              options={BOARD_GRADIENTS}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">

          <Field label="Intensity">
            <SimpleSelect
              value={form.intensity}
              onChange={(v) => update("intensity", v)}
              options={lib.data?.intensities ?? []}
            />
          </Field>
          <Field label="RPE">
            <Input inputMode="decimal" value={form.rpe} onChange={(e) => update("rpe", e.target.value)} />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Routes, partners, conditions…"
          />
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
          <Label className="text-sm">Completed</Label>
          <Switch checked={form.completed} onCheckedChange={(v) => update("completed", v)} />
        </div>

        <Button
          onClick={() => mutate.mutate()}
          disabled={!canSubmit}
          className="h-12 w-full text-base font-semibold"
          style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
        >
          {mutate.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Plus className="mr-1 h-5 w-5" /> Log session
            </>
          )}
        </Button>
      </Card>

      <RecentList
        loading={recent.isLoading}
        entries={recentEntries}
        deletingId={deleteMutation.variables ?? null}
        onDelete={(entry) => {
          if (!entry.id) return;
          if (!window.confirm(`Delete ${entry.title} from ${formatUKDate(entry.date)}?`)) return;
          deleteMutation.mutate(entry.id);
        }}
        onSelect={(i) => {
          const r = recent.data?.recent[i];
          if (!r) return;
          setForm((f) => ({
            ...f,
            type: r.type ?? f.type,
            trackingMode: r.trackingMode ?? f.trackingMode,
            hours: r.hours ?? f.hours,
            boulders: r.boulders ?? f.boulders,
            grade: r.grade ?? f.grade,
            gradient: r.gradient ?? f.gradient,
            rpe: r.rpe ?? f.rpe,
          }));
          toast.message(`Prefilled from ${r.type || "climb"}`);
        }}
      />
    </div>
  );
}
