import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Moon, RotateCcw } from "lucide-react";
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
import { useRestDays } from "@/hooks/use-rest-days";
import { useDialogReturnFocus } from "@/hooks/use-dialog-return-focus";
import { setTrainingRestDayClient } from "@/lib/supabase-rest-days.browser";
import { formatUKDate } from "@/lib/date";

export function RestDayControl({
  date,
  allowDateChange = false,
}: {
  date: string;
  allowDateChange?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(date);
  const restDays = useRestDays();
  const queryClient = useQueryClient();
  const closeAutoFocus = useDialogReturnFocus(open);
  const isRest = restDays.data?.some((day) => day.rest_date === selectedDate) ?? false;
  const dateIsRest = restDays.data?.some((day) => day.rest_date === date) ?? false;
  const mutation = useMutation({
    mutationFn: ({ rest, restore = true }: { rest: boolean; restore?: boolean }) =>
      setTrainingRestDayClient(selectedDate, rest, restore),
    onSuccess: async (moved, { rest, restore = true }) => {
      setOpen(false);
      toast.success(
        rest
          ? `${formatUKDate(selectedDate)} marked as rest${moved ? ` · ${moved} workout${moved === 1 ? "" : "s"} moved forward` : ""}.`
          : restore
            ? "Rest day undone. Moved workout dates restored."
            : "Rest label removed. Workout dates kept.",
      );
      await queryClient.invalidateQueries();
    },
  });
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setSelectedDate(date);
          mutation.reset();
          setOpen(true);
        }}
      >
        {dateIsRest ? (
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
        ) : (
          <Moon className="mr-1.5 h-3.5 w-3.5" />
        )}
        {dateIsRest ? "Undo rest day" : "Mark rest day"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending) setOpen(value);
        }}
      >
        <DialogContent className="sm:max-w-lg" onCloseAutoFocus={closeAutoFocus}>
          <DialogHeader>
            <DialogTitle>{isRest ? "Rest day" : "Mark a rest day"}</DialogTitle>
            <DialogDescription>
              Planned rest is separate from a completed or missed workout. You can still log
              activity if your plans change.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">
            Date
            <Input
              type="date"
              value={selectedDate}
              disabled={!allowDateChange || mutation.isPending}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                mutation.reset();
              }}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            {isRest
              ? "Undo restores the dates moved by this rest day, provided those workouts haven’t since changed or started. You can also remove just the rest label and keep the new dates."
              : "Unstarted programme sessions move to the next training date, keeping their order and spacing. Other workouts planned for this date move to the next non-rest day. Completed and started sessions stay where they are."}
          </p>
          {restDays.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Rest days couldn’t be loaded. Please try again.
            </p>
          ) : null}
          {mutation.error ? (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={mutation.isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {isRest ? (
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ rest: false, restore: false })}
              >
                Remove label only
              </Button>
            ) : null}
            <Button
              disabled={
                !selectedDate || restDays.isPending || restDays.isError || mutation.isPending
              }
              onClick={() => mutation.mutate({ rest: !isRest })}
            >
              {mutation.isPending ? "Saving…" : isRest ? "Undo rest day" : "Mark rest day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
