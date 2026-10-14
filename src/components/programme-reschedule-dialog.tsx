import { useMemo, useState } from "react";
import { useDialogReturnFocus } from "@/hooks/use-dialog-return-focus";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUKDate, todayISO } from "@/lib/date";
import {
  buildProgrammeReschedulePreview,
  programmeSessionScheduledDate,
  reverseProgrammeReschedule,
  type ProgrammeReschedulePreview,
} from "@/lib/programme-reschedule";
import {
  applyProgrammeRescheduleClient,
  getProgrammeRescheduleClashesClient,
} from "@/lib/supabase-programme-reschedule.browser";
import type { ProgrammeAssignment, ProgrammeTemplate } from "@/lib/supabase-programmes.browser";

export function ProgrammeRescheduleDialog({
  assignment,
  template,
  lockedWorkoutIds,
  hasDraft,
}: {
  assignment: ProgrammeAssignment;
  template: ProgrammeTemplate;
  lockedWorkoutIds: string[];
  hasDraft: boolean;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const closeAutoFocus = useDialogReturnFocus(open);
  const [newDate, setNewDate] = useState("");
  const [undo, setUndo] = useState(false);
  const [undoPreview, setUndoPreview] = useState<ProgrammeReschedulePreview | null>(null);
  const current = template.workouts[assignment.currentWorkoutIndex];
  const computed = useMemo(() => {
    if (!open) return { preview: null, error: "" };
    if (undo && undoPreview) return { preview: undoPreview, error: "" };
    try {
      return {
        preview: buildProgrammeReschedulePreview({
          assignment,
          template,
          lockedWorkoutIds,
          newDate,
          today: todayISO(),
        }),
        error: "",
      };
    } catch (error) {
      return {
        preview: null,
        error: error instanceof Error ? error.message : "The dates could not be previewed.",
      };
    }
  }, [open, undo, undoPreview, assignment, template, lockedWorkoutIds, newDate]);
  const preview = computed.preview;
  const clashes = useQuery({
    queryKey: ["programme-reschedule-clashes", JSON.stringify(preview)],
    queryFn: () => getProgrammeRescheduleClashesClient(preview!),
    enabled: Boolean(preview && open),
    retry: false,
  });
  const save = useMutation({
    mutationFn: async ({
      reviewed,
      reversing,
    }: {
      reviewed: ProgrammeReschedulePreview;
      reversing: boolean;
    }) => {
      if (!clashes.isSuccess || clashes.isFetching)
        throw new Error("Wait for the clash check before applying dates.");
      const count = await applyProgrammeRescheduleClient(reviewed, clashes.data, reversing);
      if (count !== reviewed.sessions.filter((session) => !session.locked).length)
        throw new Error(
          "The save could not be confirmed. Refresh the programme before trying again.",
        );
      return { reviewed, reversing };
    },
    onSuccess: async ({ reviewed, reversing }) => {
      setUndoPreview(reversing ? null : reverseProgrammeReschedule(reviewed));
      setOpen(false);
      await client.invalidateQueries();
      toast.success(reversing ? "Previous programme dates restored" : "Programme dates updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      void client.invalidateQueries({ queryKey: ["my-programme-overview"] });
      void client.invalidateQueries({ queryKey: ["programme-workout-offers"] });
    },
  });
  const blocked = hasDraft || !current || lockedWorkoutIds.includes(current.id);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocked}
          onClick={() => {
            setUndo(false);
            const date = programmeSessionScheduledDate(assignment, current!);
            const nextDay = date ? new Date(`${date}T00:00:00Z`) : new Date();
            nextDay.setUTCDate(nextDay.getUTCDate() + 1);
            setNewDate([todayISO(), nextDay.toISOString().slice(0, 10)].sort().at(-1)!);
            save.reset();
            setOpen(true);
          }}
        >
          Plans changed
        </Button>
        {undoPreview ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={hasDraft}
            onClick={() => {
              setUndo(true);
              save.reset();
              setOpen(true);
            }}
          >
            Undo date change
          </Button>
        ) : null}
      </div>
      {blocked ? (
        <p className="text-xs text-muted-foreground">
          Finish or cancel your current workout before moving programme dates.
        </p>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!save.isPending) setOpen(value);
        }}
      >
        <DialogContent
          onCloseAutoFocus={closeAutoFocus}
          className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>{undo ? "Restore the previous dates" : "I missed a session"}</DialogTitle>
            <DialogDescription>
              {undo
                ? "Review the dates to restore. Sessions that have since started cannot be moved."
                : "Move your next session and apply the same delay to every later unstarted session. Review the dates and other planned training before saving."}
            </DialogDescription>
          </DialogHeader>
          {!undo ? (
            <label className="space-y-2 text-sm font-medium" htmlFor="programme-new-date">
              New date for the next session
              <Input
                id="programme-new-date"
                type="date"
                className="mt-2"
                value={newDate}
                min={todayISO()}
                disabled={save.isPending}
                onChange={(event) => {
                  setNewDate(event.target.value);
                  save.reset();
                }}
              />
            </label>
          ) : null}
          {computed.error ? (
            <p role="alert" className="text-sm text-destructive">
              {computed.error}
            </p>
          ) : null}
          {preview ? (
            <>
              <p className="text-sm">
                {preview.sessions.filter((session) => !session.locked).length} sessions ·{" "}
                {Math.abs(preview.days)} {Math.abs(preview.days) === 1 ? "day" : "days"}{" "}
                {preview.days > 0 ? "later" : "earlier"}
              </p>
              <div className="min-w-0 rounded-lg border border-border">
                <table className="w-full table-fixed text-left text-xs">
                  <thead className="border-b border-border bg-secondary/30">
                    <tr>
                      <th className="w-2/5 p-3">Session</th>
                      <th className="p-3">Current date</th>
                      <th className="p-3">New date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sessions.map((session) => (
                      <tr key={session.workoutId} className="border-b border-border last:border-0">
                        <th className="break-words p-3 font-medium" scope="row">
                          {session.name}
                          {session.locked ? (
                            <span className="mt-1 block font-normal text-muted-foreground">
                              Fixed · already started
                            </span>
                          ) : null}
                        </th>
                        <td className="p-3">{formatUKDate(session.date!)}</td>
                        <td className="p-3">{formatUKDate(session.newDate!)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <section aria-label="Other planned training" className="space-y-2">
                <h3 className="text-sm font-semibold">Other planned training</h3>
                {clashes.isFetching || clashes.isPending ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Checking for clashes…
                  </p>
                ) : clashes.error ? (
                  <div role="alert" className="space-y-2 text-sm text-destructive">
                    <p>{clashes.error.message}</p>
                    <Button type="button" variant="outline" onClick={() => void clashes.refetch()}>
                      Retry clash check
                    </Button>
                  </div>
                ) : clashes.data?.length ? (
                  <ul className="space-y-1 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm">
                    {clashes.data.map((clash) => (
                      <li key={`${clash.workoutId}:${clash.id}`}>
                        {formatUKDate(clash.date)} · {clash.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No clashes with other planned training on these dates.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Your prescriptions and programme order are retained. Supporting sessions keep
                  their existing dates.
                </p>
              </section>
            </>
          ) : null}
          {hasDraft ? (
            <p role="alert" className="text-sm text-destructive">
              Finish or cancel your current workout first.
            </p>
          ) : null}
          {save.error ? (
            <p role="alert" className="text-sm text-destructive">
              {save.error.message} Close and reopen this preview to load the latest dates.
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !preview ||
                !clashes.isSuccess ||
                clashes.isFetching ||
                save.isPending ||
                Boolean(save.error) ||
                hasDraft
              }
              onClick={() => preview && save.mutate({ reviewed: preview, reversing: undo })}
            >
              {save.isPending
                ? "Saving dates…"
                : undo
                  ? "Restore reviewed dates"
                  : "Apply reviewed dates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
