import { CalendarPlus, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { WeeklyCoachCapacitySummary } from "@/components/weekly-coach-capacity-summary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrainingContextSession } from "@/lib/training-context";
import {
  validateWeeklyCoachDraftSelection,
  type WeeklyCoachDraft,
  type WeeklyCoachDraftAddition,
  type WeeklyCoachDraftPriority,
} from "@/lib/weekly-coach-draft";
import { projectWeeklyCoachCapacity } from "@/lib/weekly-coach-capacity";

const PRIORITY_LABEL: Record<WeeklyCoachDraftPriority, string> = {
  primary: "Primary",
  supporting: "Supporting",
  maintenance: "Maintenance",
};

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function movementPrescription(addition: WeeklyCoachDraftAddition) {
  return addition.draft.movements.map((movement) => {
    const first = movement.setRows[0];
    const dose = first?.durationSeconds
      ? `${first.durationSeconds}s`
      : first?.reps
        ? `${first.reps} reps`
        : movement.targets.detail || "saved targets";
    return `${movement.exercise} · ${movement.setRows.length} set${movement.setRows.length === 1 ? "" : "s"} · ${dose}`;
  });
}

export function WeeklyCoachDraftDialog({
  draft,
  existingSessions,
  saving,
  onApply,
}: {
  draft: WeeklyCoachDraft;
  existingSessions: TrainingContextSession[];
  saving: boolean;
  onApply: (additions: WeeklyCoachDraftAddition[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [additions, setAdditions] = useState(draft.additions);
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(draft.additions.map((item) => item.id)),
  );

  useEffect(() => {
    if (open) return;
    setAdditions(draft.additions);
    setSelectedIds(new Set(draft.additions.map((item) => item.id)));
  }, [draft, open]);

  const selected = useMemo(
    () => additions.filter((addition) => selectedIds.has(addition.id)),
    [additions, selectedIds],
  );
  const validationError = validateWeeklyCoachDraftSelection(draft, selected);
  const capacity = useMemo(
    () => projectWeeklyCoachCapacity(draft.capacity, draft.preferences, selected),
    [draft.capacity, draft.preferences, selected],
  );
  const days = draft.weekDates.map((date) => ({
    date,
    existing: existingSessions.filter((session) => session.date === date),
    proposed: selected.filter((addition) => addition.date === date),
  }));

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const changeDate = (id: string, date: string) => {
    setAdditions((current) =>
      current.map((addition) => (addition.id === id ? { ...addition, date } : addition)),
    );
  };

  const apply = async () => {
    if (!selected.length || validationError) return;
    try {
      await onApply(selected);
      setOpen(false);
    } catch {
      // The parent mutation keeps the proposal open and shows the actionable error.
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarPlus className="mr-2 h-4 w-4" /> Draft my week
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review your drafted week</DialogTitle>
          <DialogDescription>
            The coach has kept every saved session in place. Choose the additions and dates below;
            nothing is saved until you approve them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-blue-400/25 bg-blue-400/[0.05] p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 text-blue-300" />
              <div>
                <p className="text-sm font-medium">{draft.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The draft can add up to {draft.adaptation.additionLimit} missing priorities and
                  will not move or replace anything already saved.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/[0.04] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{draft.adaptation.title}</p>
              <Badge variant="outline" className="capitalize">
                {draft.adaptation.mode}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{draft.adaptation.detail}</p>
          </div>

          {draft.rollover ? (
            <div className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Rollover from {dayLabel(draft.rollover.previousWeekStart)}–
                    {dayLabel(draft.rollover.previousWeekEnd)}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{draft.rollover.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{draft.rollover.detail}</p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {draft.rollover.status}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {draft.rollover.evidence.map((item) => (
                  <p
                    key={item}
                    className="rounded-lg bg-secondary/30 p-2 text-xs text-muted-foreground"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {additions.length ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Proposed additions</p>
              {additions.map((addition) => {
                const checked = selectedIds.has(addition.id);
                return (
                  <div key={addition.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggle(addition.id, value === true)}
                        aria-label={`Add ${addition.title}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{addition.draft.title}</p>
                          <Badge variant="secondary">{PRIORITY_LABEL[addition.priority]}</Badge>
                          <Badge variant="outline" className="capitalize">
                            {addition.kind} · {addition.draft.locationKind}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{addition.reason}</p>
                        <div className="mt-2 space-y-1">
                          {movementPrescription(addition).map((prescription, index) => (
                            <p key={`${prescription}:${index}`} className="text-xs">
                              {prescription}
                            </p>
                          ))}
                        </div>
                        <label className="mt-3 block max-w-xs text-xs font-medium">
                          Planned day
                          <Select
                            disabled={!checked}
                            value={addition.date}
                            onValueChange={(date) => changeDate(addition.id, date)}
                          >
                            <SelectTrigger
                              className="mt-1"
                              aria-label={`Day for ${addition.title}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {draft.availableDates.map((date) => (
                                <SelectItem key={date} value={date}>
                                  {dayLabel(date)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              There are no additions to approve. Save a supporting goal or mobility practice in
              Coach setup if you want the coach to place it in the week.
            </div>
          )}

          <WeeklyCoachCapacitySummary capacity={capacity} title="Capacity after these choices" />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Entire proposed week</p>
              <Badge variant="outline">
                {selected.length} proposed addition{selected.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {days.map((day) => (
                <div key={day.date} className="rounded-lg border border-border/70 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {dayLabel(day.date)}
                  </p>
                  <div className="mt-2 space-y-2">
                    {day.existing.map((session) => (
                      <div key={session.id}>
                        <p className="text-xs font-medium">{session.label}</p>
                        <Badge variant="outline" className="mt-1">
                          Saved
                        </Badge>
                      </div>
                    ))}
                    {day.proposed.map((addition) => (
                      <div key={addition.id}>
                        <p className="text-xs font-medium">{addition.draft.title}</p>
                        <Badge className="mt-1">Proposed</Badge>
                      </div>
                    ))}
                    {!day.existing.length && !day.proposed.length ? (
                      <p className="text-xs text-muted-foreground">Open</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {validationError && selected.length ? (
            <p className="text-sm text-destructive">{validationError}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Keep my week unchanged
          </Button>
          <Button
            onClick={() => void apply()}
            disabled={!selected.length || Boolean(validationError) || saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add {selected.length || "selected"} session{selected.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
