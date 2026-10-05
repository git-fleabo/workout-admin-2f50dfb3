import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  normaliseCoachingPreferences,
  type CoachingFocusOption,
  type CoachingPreferences,
} from "@/lib/coaching-preferences";

export function CoachSetupDialog({
  preferences,
  focusOptions,
  saving,
  onSave,
}: {
  preferences: CoachingPreferences;
  focusOptions: CoachingFocusOption[];
  saving: boolean;
  onSave: (preferences: CoachingPreferences) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(preferences);
  const availableIds = useMemo(
    () => new Set(focusOptions.map((option) => option.id)),
    [focusOptions],
  );

  useEffect(() => {
    if (!open) setDraft(normaliseCoachingPreferences(preferences, availableIds));
  }, [availableIds, open, preferences]);

  const selectPrimary = (id: string) => {
    setDraft((current) => ({
      ...current,
      primaryFocusId: id,
      secondaryFocusIds: current.secondaryFocusIds.filter((focusId) => focusId !== id),
      maintenanceFocusIds: current.maintenanceFocusIds.filter((focusId) => focusId !== id),
    }));
  };
  const toggleSecondary = (id: string, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      secondaryFocusIds: checked
        ? [...current.secondaryFocusIds.filter((focusId) => focusId !== id), id].slice(0, 2)
        : current.secondaryFocusIds.filter((focusId) => focusId !== id),
      maintenanceFocusIds: checked
        ? current.maintenanceFocusIds.filter((focusId) => focusId !== id)
        : current.maintenanceFocusIds,
    }));
  };
  const toggleMaintenance = (id: string, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      secondaryFocusIds: checked
        ? current.secondaryFocusIds.filter((focusId) => focusId !== id)
        : current.secondaryFocusIds,
      maintenanceFocusIds: checked
        ? [...current.maintenanceFocusIds.filter((focusId) => focusId !== id), id]
        : current.maintenanceFocusIds.filter((focusId) => focusId !== id),
    }));
  };

  const save = async () => {
    try {
      await onSave(normaliseCoachingPreferences({ ...draft, saved: true }, availableIds));
      setOpen(false);
    } catch {
      // The parent mutation keeps the dialog open and shows the actionable error.
    }
  };

  const remainingOptions = focusOptions.filter((option) => option.id !== draft.primaryFocusId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={preferences.saved ? "outline" : "default"} size="sm">
          {preferences.saved ? "Edit coach setup" : "Set priorities"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Coach setup</DialogTitle>
          <DialogDescription>
            Tell the coach what should progress, what should support it, and how much training fits
            your week. You can change this before any week is built.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="primary-focus">
              Primary focus
            </label>
            <Select value={draft.primaryFocusId} onValueChange={selectPrimary}>
              <SelectTrigger id="primary-focus">
                <SelectValue placeholder="Choose the main focus" />
              </SelectTrigger>
              <SelectContent>
                {focusOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This gets first claim on your training time and recovery.
            </p>
          </div>

          {remainingOptions.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="space-y-2 rounded-lg border border-border p-3">
                <legend className="px-1 text-sm font-medium">Build alongside it</legend>
                <p className="text-xs text-muted-foreground">Choose up to two supporting goals.</p>
                {remainingOptions.map((option) => {
                  const checked = draft.secondaryFocusIds.includes(option.id);
                  return (
                    <label key={option.id} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        disabled={!checked && draft.secondaryFocusIds.length >= 2}
                        onCheckedChange={(value) => toggleSecondary(option.id, value === true)}
                        aria-label={`Build ${option.label}`}
                      />
                      <span>
                        <span className="block font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <fieldset className="space-y-2 rounded-lg border border-border p-3">
                <legend className="px-1 text-sm font-medium">Maintain</legend>
                <p className="text-xs text-muted-foreground">
                  Keep these present without pushing them.
                </p>
                {remainingOptions.map((option) => (
                  <label key={option.id} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={draft.maintenanceFocusIds.includes(option.id)}
                      onCheckedChange={(value) => toggleMaintenance(option.id, value === true)}
                      aria-label={`Maintain ${option.label}`}
                    />
                    <span>
                      <span className="block font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              Add an active goal or mobility practice to make it a supporting or maintenance focus.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="training-days">
                Training days
              </label>
              <Select
                value={String(draft.weeklyTrainingDays)}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    weeklyTrainingDays: Number(value),
                    maxDemandingDays: Math.min(current.maxDemandingDays, Number(value)),
                  }))
                }
              >
                <SelectTrigger id="training-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {days} per week
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="weekly-minutes">
                Minutes available
              </label>
              <Input
                id="weekly-minutes"
                type="number"
                min={30}
                max={1680}
                step={30}
                value={draft.weeklyMinutes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, weeklyMinutes: Number(event.target.value) }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="demanding-days">
                Demanding days max
              </label>
              <Select
                value={String(draft.maxDemandingDays)}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, maxDemandingDays: Number(value) }))
                }
              >
                <SelectTrigger id="demanding-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: draft.weeklyTrainingDays }, (_, index) => index + 1).map(
                    (days) => (
                      <SelectItem key={days} value={String(days)}>
                        {days} per week
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The minute limit is saved now. Exact time comparisons will switch on once every session
            has a dependable duration estimate.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save coach setup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
