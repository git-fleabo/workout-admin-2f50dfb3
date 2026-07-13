import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Clock3,
  Copy,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
  addTrainingMethodClient,
  deleteTrainingMethodClient,
  duplicateTrainingMethodClient,
  listTrainingMethodsClient,
  setTrainingMethodEnabledClient,
  updateTrainingMethodClient,
  type TrainingMethod,
  type TrainingMethodConfig,
  type TrainingMethodFamily,
  type TrainingMethodFields,
} from "@/lib/supabase-training-methods.browser";

export const Route = createFileRoute("/methods")({
  head: () => ({
    meta: [
      { title: "Training Methods · Training Admin" },
      {
        name: "description",
        content: "Manage system and custom advanced training methods.",
      },
    ],
  }),
  component: MethodsPage,
});

const FAMILIES: Array<{
  value: TrainingMethodFamily;
  label: string;
  detail: string;
  icon: typeof Boxes;
}> = [
  {
    value: "exercise_group",
    label: "Exercise groups",
    detail: "Supersets, tri-sets, giant sets and circuits",
    icon: Boxes,
  },
  {
    value: "set_method",
    label: "Set methods",
    detail: "Drop sets, clusters, rest-pause and partials",
    icon: Layers3,
  },
  {
    value: "timed_density",
    label: "Timed & density",
    detail: "EDT, Tabata and fixed-duration work",
    icon: Clock3,
  },
];

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; method: TrainingMethod };

const defaultsFor = (family: TrainingMethodFamily): TrainingMethodConfig => {
  if (family === "exercise_group") {
    return {
      movement_count: 2,
      rounds: 3,
      rest_between_movements_seconds: 0,
      rest_between_rounds_seconds: 90,
    };
  }
  if (family === "set_method") {
    return { segments: 3, percentage_drop: 15, rest_between_segments_seconds: 15 };
  }
  return { rounds: 8, block_minutes: 4, work_seconds: 20, rest_seconds: 10 };
};

function editorFields(state: EditorState): TrainingMethodFields {
  return state.mode === "edit"
    ? {
        name: state.method.name,
        family: state.method.family,
        description: state.method.description,
        defaultConfig: state.method.defaultConfig,
      }
    : {
        name: "",
        family: "exercise_group",
        description: "",
        defaultConfig: defaultsFor("exercise_group"),
      };
}

function familyLabel(family: TrainingMethodFamily) {
  return FAMILIES.find((item) => item.value === family)?.label ?? family;
}

function configSummary(method: TrainingMethod) {
  const config = method.defaultConfig;
  if (method.family === "exercise_group") {
    return [
      config.movement_count && `${config.movement_count} movements`,
      config.rounds && `${config.rounds} rounds`,
      config.rest_between_rounds_seconds != null &&
        `${config.rest_between_rounds_seconds}s between rounds`,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (method.family === "set_method") {
    return [
      config.segments && `${config.segments} segments`,
      config.percentage_drop && `${config.percentage_drop}% drop`,
      config.target_reps && `${config.target_reps} target reps`,
      config.rest_between_segments_seconds != null &&
        `${config.rest_between_segments_seconds}s short rest`,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [
    config.block_minutes && `${config.block_minutes} min block`,
    config.rounds && `${config.rounds} rounds`,
    config.work_seconds && `${config.work_seconds}s work`,
    config.rest_seconds != null && `${config.rest_seconds}s rest`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function MethodsPage() {
  const queryClient = useQueryClient();
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [family, setFamily] = useState<"all" | TrainingMethodFamily>("all");
  const [showHidden, setShowHidden] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [pendingDelete, setPendingDelete] = useState<TrainingMethod | null>(null);
  const list = useQuery({
    queryKey: ["training-methods", selectedPersonId],
    queryFn: () => listTrainingMethodsClient(selectedPersonId || undefined),
  });
  const effectivePersonId = list.data?.selectedPersonId ?? selectedPersonId;
  const filtered = useMemo(
    () =>
      (list.data?.items ?? []).filter(
        (method) =>
          (family === "all" || method.family === family) &&
          (showHidden || (method.isActive && method.isEnabled)),
      ),
    [family, list.data?.items, showHidden],
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["training-methods"] });

  const addMutation = useMutation({
    mutationFn: (fields: TrainingMethodFields) =>
      addTrainingMethodClient(fields, effectivePersonId || undefined),
    onSuccess: () => {
      toast.success("Training method added");
      setEditor({ mode: "closed" });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: TrainingMethodFields }) =>
      updateTrainingMethodClient(id, fields),
    onSuccess: () => {
      toast.success("Training method updated");
      setEditor({ mode: "closed" });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const duplicateMutation = useMutation({
    mutationFn: (method: TrainingMethod) =>
      duplicateTrainingMethodClient(method, effectivePersonId || undefined),
    onSuccess: () => {
      toast.success("Editable copy created");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const enabledMutation = useMutation({
    mutationFn: ({ method, enabled }: { method: TrainingMethod; enabled: boolean }) =>
      setTrainingMethodEnabledClient(method, enabled, effectivePersonId || undefined),
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTrainingMethodClient(id),
    onSuccess: () => {
      toast.success("Custom method deleted");
      setPendingDelete(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Settings2 className="h-6 w-6" /> Training methods
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Control the methods available when planning and logging. System definitions keep stable
            identities; duplicate one when you want your own defaults.
          </p>
        </div>
        <Button onClick={() => setEditor({ mode: "create" })}>
          <Plus className="mr-1 h-4 w-4" /> New custom method
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[180px] flex-col gap-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Family</Label>
          <Select value={family} onValueChange={(value) => setFamily(value as typeof family)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {FAMILIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(list.data?.people.length ?? 0) > 1 ? (
          <div className="flex min-w-[160px] flex-col gap-1">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Person</Label>
            <Select value={effectivePersonId} onValueChange={setSelectedPersonId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {list.data?.people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3">
          <Switch
            checked={showHidden}
            onCheckedChange={setShowHidden}
            aria-label="Show hidden methods"
          />
          <span className="text-xs text-muted-foreground">Show hidden</span>
        </div>
      </div>

      {list.isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading methods…
        </div>
      ) : list.error ? (
        <Card className="p-5 text-sm text-destructive">{(list.error as Error).message}</Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((method) => {
            const familyInfo = FAMILIES.find((item) => item.value === method.family)!;
            const Icon = familyInfo.icon;
            return (
              <Card key={method.id} className="flex flex-col gap-4 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{method.name}</h2>
                      <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {method.isSystem ? "System" : "Custom"}
                      </span>
                      {!method.isEnabled || !method.isActive ? (
                        <span className="rounded-full border border-amber-400/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {familyLabel(method.family)}
                    </p>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground/80">
                    {configSummary(method) || "No default values set"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3">
                  <div className="mr-auto flex items-center gap-2">
                    <Switch
                      checked={method.isEnabled && method.isActive}
                      onCheckedChange={(enabled) => enabledMutation.mutate({ method, enabled })}
                      disabled={enabledMutation.isPending}
                      aria-label={`${method.isEnabled ? "Hide" : "Show"} ${method.name}`}
                    />
                    <span className="text-xs text-muted-foreground">Available</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => duplicateMutation.mutate(method)}
                    disabled={duplicateMutation.isPending}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                  </Button>
                  {!method.isSystem ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditor({ mode: "edit", method })}
                        aria-label={`Edit ${method.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPendingDelete(method)}
                        aria-label={`Delete ${method.name}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <MethodEditor
        state={editor}
        onClose={() => setEditor({ mode: "closed" })}
        pending={addMutation.isPending || updateMutation.isPending}
        onSubmit={(fields) => {
          if (editor.mode === "edit") updateMutation.mutate({ id: editor.method.id, fields });
          else addMutation.mutate(fields);
        }}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this custom method?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} will be permanently removed. Methods already used in workout
              history are protected; deactivate them instead. System methods cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MethodEditor({
  state,
  onClose,
  onSubmit,
  pending,
}: {
  state: EditorState;
  onClose: () => void;
  onSubmit: (fields: TrainingMethodFields) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState(() => editorFields(state));
  useEffect(() => setForm(editorFields(state)), [state]);
  const updateNumber = (key: string, value: string) =>
    setForm((current) => ({
      ...current,
      defaultConfig: {
        ...current.defaultConfig,
        [key]: value === "" ? 0 : Number(value),
      },
    }));
  const fields =
    form.family === "exercise_group"
      ? [
          ["movement_count", "Movements"],
          ["rounds", "Rounds"],
          ["rest_between_movements_seconds", "Rest between movements (sec)"],
          ["rest_between_rounds_seconds", "Rest between rounds (sec)"],
        ]
      : form.family === "set_method"
        ? [
            ["segments", "Segments / clusters"],
            ["percentage_drop", "Load drop (%)"],
            ["target_reps", "Target total reps"],
            ["rest_between_segments_seconds", "Short rest (sec)"],
          ]
        : [
            ["rounds", "Rounds"],
            ["block_minutes", "Block duration (min)"],
            ["work_seconds", "Work interval (sec)"],
            ["rest_seconds", "Rest interval (sec)"],
          ];
  return (
    <Dialog open={state.mode !== "closed"} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "edit" ? "Edit custom method" : "New custom method"}
          </DialogTitle>
          <DialogDescription>
            Defaults are starting values only; every planned or logged use remains editable.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim()) return toast.error("Name is required");
            onSubmit(form);
          }}
        >
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Family</Label>
            <Select
              value={form.family}
              onValueChange={(value) => {
                const nextFamily = value as TrainingMethodFamily;
                setForm((current) => ({
                  ...current,
                  family: nextFamily,
                  defaultConfig: defaultsFor(nextFamily),
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAMILIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>
          <div>
            <Label>Defaults</Label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {fields.map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={String(form.defaultConfig[key] ?? "")}
                    onChange={(event) => updateNumber(key, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !form.name.trim()}>
              {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save method
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
