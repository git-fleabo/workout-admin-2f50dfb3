import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  addDailyRotationItemClient,
  deleteDailyRotationItemClient,
  listDailyRotationItemsClient,
  updateDailyRotationItemClient,
  type DailyRotationItem,
  type DailyRotationItemFields,
} from "@/lib/supabase-daily-rotation.browser";
import { SettingsBackLink } from "@/components/settings-back-link";

export const Route = createFileRoute("/rotation")({
  head: () => ({
    meta: [
      { title: "Daily rotation · Training Tracker" },
      {
        name: "description",
        content: "Configure the movements that rotate onto the Today screen.",
      },
    ],
  }),
  component: DailyRotationPage,
});

const DAYS = [
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
  { value: 7, short: "S", label: "Sunday" },
];

const BLANK: DailyRotationItemFields = {
  name: "",
  target: "",
  cue: "",
  selectionWeight: 3,
  activeDays: [1, 2, 3, 4, 5, 6, 7],
  minimumDaysBetween: 1,
  isActive: true,
};

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; item: DailyRotationItem };

function itemFields(item: DailyRotationItem): DailyRotationItemFields {
  return {
    name: item.name,
    target: item.target,
    cue: item.cue,
    selectionWeight: item.selectionWeight,
    activeDays: item.activeDays,
    minimumDaysBetween: item.minimumDaysBetween,
    isActive: item.isActive,
  };
}

function daySummary(days: number[]) {
  if (days.length === 7) return "Every day";
  if (days.join(",") === "1,2,3,4,5") return "Weekdays";
  if (days.join(",") === "6,7") return "Weekends";
  return DAYS.filter((day) => days.includes(day.value))
    .map((day) => day.label.slice(0, 3))
    .join(", ");
}

function weightLabel(weight: number) {
  if (weight <= 2) return "Less often";
  if (weight >= 4) return "More often";
  return "Normal chance";
}

function DailyRotationPage() {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["daily-rotation-items"],
    queryFn: listDailyRotationItemsClient,
  });
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [pendingDelete, setPendingDelete] = useState<DailyRotationItem | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["daily-rotation-items"] });
    queryClient.invalidateQueries({ queryKey: ["daily-rotation-today"] });
  };

  const addMutation = useMutation({
    mutationFn: addDailyRotationItemClient,
    onSuccess: () => {
      toast.success("Rotation item added");
      setEditor({ mode: "closed" });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: DailyRotationItemFields }) =>
      updateDailyRotationItemClient(id, fields),
    onSuccess: () => {
      toast.success("Rotation item updated");
      setEditor({ mode: "closed" });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDailyRotationItemClient,
    onSuccess: () => {
      toast.success("Rotation item deleted");
      setPendingDelete(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleItem = (item: DailyRotationItem) => {
    updateMutation.mutate({
      id: item.id,
      fields: { ...itemFields(item), isActive: !item.isActive },
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <SettingsBackLink />
      <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-violet-300">
            <Repeat2 className="h-4 w-4" /> Daily practice
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Daily rotation</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Build a pool of small practices. Today picks one eligible item and keeps that choice
            fixed for the day.
          </p>
        </div>
        <Button onClick={() => setEditor({ mode: "create" })}>
          <Plus className="mr-2 h-4 w-4" /> Add item
        </Button>
      </header>

      <Card className="border-violet-400/25 bg-violet-400/[0.05]">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
          <p>
            Chance changes how often an item is selected relative to the others. Eligible days and
            repeat gap let you keep practices useful without seeing the same movement too often.
          </p>
        </CardContent>
      </Card>

      {list.isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading rotation…
        </div>
      ) : list.error ? (
        <Card className="border-destructive/35 p-5 text-sm text-destructive">
          The rotation could not be loaded.
        </Card>
      ) : list.data?.needsProfileClaim ? (
        <Card className="space-y-3 p-5">
          <p className="text-sm text-muted-foreground">
            Connect your training profile before creating a daily rotation.
          </p>
          <Button asChild variant="outline">
            <Link to="/goals">Connect profile</Link>
          </Button>
        </Card>
      ) : list.data?.items.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.data.items.map((item) => (
            <Card key={item.id} className={item.isActive ? "" : "opacity-65"}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{item.name}</h2>
                      <Badge variant={item.isActive ? "outline" : "secondary"}>
                        {item.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    {item.target ? (
                      <p className="mt-1 text-sm font-medium text-violet-200">{item.target}</p>
                    ) : null}
                    {item.cue ? (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {item.cue}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleItem(item)}
                      title={item.isActive ? "Pause" : "Resume"}
                      aria-label={item.isActive ? "Pause" : "Resume"}
                    >
                      {item.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditor({ mode: "edit", item })}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(item)}
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground/80">Days</p>
                    <p className="mt-0.5">{daySummary(item.activeDays)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground/80">Chance</p>
                    <p className="mt-0.5">{weightLabel(item.selectionWeight)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground/80">Repeat gap</p>
                    <p className="mt-0.5">
                      {item.minimumDaysBetween === 0
                        ? "None"
                        : `${item.minimumDaysBetween} day${item.minimumDaysBetween === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">No rotation items yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add practices such as a one-arm hang, handstand or mobility drill.
          </p>
          <Button className="mt-4" onClick={() => setEditor({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> Add your first item
          </Button>
        </Card>
      )}

      <RotationEditor
        editor={editor}
        pending={addMutation.isPending || updateMutation.isPending}
        onClose={() => setEditor({ mode: "closed" })}
        onSave={(fields) => {
          if (editor.mode === "edit") {
            updateMutation.mutate({ id: editor.item.id, fields });
          } else {
            addMutation.mutate(fields);
          }
        }}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item and its previous daily assignments. You can pause it instead if
              you may want it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep item</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
              disabled={deleteMutation.isPending}
            >
              Delete item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RotationEditor({
  editor,
  pending,
  onClose,
  onSave,
}: {
  editor: EditorState;
  pending: boolean;
  onClose: () => void;
  onSave: (fields: DailyRotationItemFields) => void;
}) {
  const [fields, setFields] = useState<DailyRotationItemFields>(BLANK);

  useEffect(() => {
    setFields(editor.mode === "edit" ? itemFields(editor.item) : BLANK);
  }, [editor]);

  const toggleDay = (day: number) => {
    setFields((current) => ({
      ...current,
      activeDays: current.activeDays.includes(day)
        ? current.activeDays.filter((value) => value !== day)
        : [...current.activeDays, day].sort((a, b) => a - b),
    }));
  };
  const valid = fields.name.trim().length > 0 && fields.activeDays.length > 0;

  return (
    <Dialog open={editor.mode !== "closed"} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editor.mode === "edit" ? "Edit rotation item" : "Add rotation item"}
          </DialogTitle>
          <DialogDescription>
            Configure when this practice can appear and how often it should be picked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="rotation-name">Movement or practice</Label>
            <Input
              id="rotation-name"
              value={fields.name}
              onChange={(event) => setFields({ ...fields, name: event.target.value })}
              placeholder="One-arm hang"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rotation-target">Daily target</Label>
            <Input
              id="rotation-target"
              value={fields.target}
              onChange={(event) => setFields({ ...fields, target: event.target.value })}
              placeholder="3 × 10 sec each side"
            />
            <p className="text-[11px] text-muted-foreground">
              Keep this practical: time, sets, attempts or a simple intention.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rotation-cue">Reminder or cue</Label>
            <Textarea
              id="rotation-cue"
              value={fields.cue}
              onChange={(event) => setFields({ ...fields, cue: event.target.value })}
              placeholder="Keep the active shoulder engaged. Stop before grip fails."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Eligible days</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((day) => {
                const active = fields.activeDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    aria-pressed={active}
                    aria-label={day.label}
                    title={day.label}
                    className={`h-9 rounded-md border text-xs font-medium transition ${
                      active
                        ? "border-violet-400/60 bg-violet-400/15 text-violet-100"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
            {!fields.activeDays.length ? (
              <p className="text-[11px] text-destructive">Choose at least one day.</p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rotation-weight">Selection chance</Label>
              <Select
                value={String(fields.selectionWeight)}
                onValueChange={(value) => setFields({ ...fields, selectionWeight: Number(value) })}
              >
                <SelectTrigger id="rotation-weight">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 · Much less often</SelectItem>
                  <SelectItem value="2">2 · Less often</SelectItem>
                  <SelectItem value="3">3 · Normal</SelectItem>
                  <SelectItem value="4">4 · More often</SelectItem>
                  <SelectItem value="5">5 · Much more often</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rotation-gap">Minimum days before repeat</Label>
              <Input
                id="rotation-gap"
                type="number"
                inputMode="numeric"
                min={0}
                max={30}
                value={fields.minimumDaysBetween}
                onChange={(event) =>
                  setFields({
                    ...fields,
                    minimumDaysBetween: Math.max(0, Math.min(30, Number(event.target.value))),
                  })
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="rotation-active">Active in rotation</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Paused items stay saved but will not be picked.
              </p>
            </div>
            <Switch
              id="rotation-active"
              checked={fields.isActive}
              onCheckedChange={(isActive) => setFields({ ...fields, isActive })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => valid && onSave(fields)} disabled={!valid || pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editor.mode === "edit" ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
