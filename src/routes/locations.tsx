import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Dumbbell,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import {
  addTrainingLocationClient,
  listManagedTrainingLocationsClient,
  setTrainingLocationActiveClient,
  updateTrainingLocationClient,
  type ManagedTrainingLocation,
  type TrainingLocationFields,
  type TrainingLocationKind,
} from "@/lib/supabase-training-locations.browser";

export const Route = createFileRoute("/locations")({
  head: () => ({
    meta: [
      { title: "Training locations · Training Tracker" },
      {
        name: "description",
        content: "Manage the locations available when planning and logging training.",
      },
    ],
  }),
  component: TrainingLocationsPage,
});

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; location: ManagedTrainingLocation };

const BLANK: TrainingLocationFields = { name: "", kind: "other" };

const KIND_DETAILS: Record<
  TrainingLocationKind,
  { label: string; description: string; icon: typeof Home; className: string }
> = {
  home: {
    label: "Home",
    description: "Uses your Home exercise availability and planning history.",
    icon: Home,
    className: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  },
  gym: {
    label: "Gym",
    description: "Uses your Gym exercise availability and planning history.",
    icon: Dumbbell,
    className: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  },
  other: {
    label: "Other",
    description: "Available in the logger without Home or Gym exercise filtering.",
    icon: Warehouse,
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  },
};

function TrainingLocationsPage() {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["training-locations", "manage"],
    queryFn: listManagedTrainingLocationsClient,
  });
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["training-locations"] });

  const addMutation = useMutation({
    mutationFn: addTrainingLocationClient,
    onSuccess: () => {
      toast.success("Training location added");
      setEditor({ mode: "closed" });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: TrainingLocationFields }) =>
      updateTrainingLocationClient(id, fields),
    onSuccess: () => {
      toast.success("Training location updated");
      setEditor({ mode: "closed" });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setTrainingLocationActiveClient(id, isActive),
    onSuccess: (_row, variables) => {
      toast.success(
        variables.isActive ? "Training location restored" : "Training location archived",
      );
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeCoreCounts = (list.data?.items ?? []).reduce(
    (counts, location) => {
      if (location.isActive && location.kind !== "other") counts[location.kind] += 1;
      return counts;
    },
    { home: 0, gym: 0 },
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
            <MapPin className="h-4 w-4" /> Training setup
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Training locations</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Control the places available in the workout logger and how Home or Gym history is
            interpreted.
          </p>
        </div>
        <Button onClick={() => setEditor({ mode: "create" })}>
          <Plus className="mr-2 h-4 w-4" /> Add location
        </Button>
      </header>

      <Card className="border-emerald-400/25 bg-emerald-400/[0.05]">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <p>
            Home and Gym are core planning contexts. You can rename them, but the last active
            location of either kind stays protected so Today, Plan and Log continue to work. Archive
            hides a location from new workouts without changing its historical sessions.
          </p>
        </CardContent>
      </Card>

      {list.isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading locations…
        </div>
      ) : list.error ? (
        <Card className="border-destructive/35 p-5 text-sm text-destructive">
          The training locations could not be loaded.
        </Card>
      ) : list.data?.needsProfileClaim ? (
        <Card className="p-5 text-sm text-muted-foreground">
          Connect your training profile before managing locations.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(list.data?.items ?? []).map((location) => {
            const details = KIND_DETAILS[location.kind];
            const Icon = details.icon;
            const lastCoreLocation =
              location.isActive &&
              location.kind !== "other" &&
              activeCoreCounts[location.kind] <= 1;

            return (
              <Card
                key={location.id}
                className={!location.isActive ? "border-dashed opacity-65" : ""}
              >
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${details.className}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{location.name}</h2>
                        <Badge variant="outline">{details.label}</Badge>
                        {!location.isActive ? <Badge variant="secondary">Archived</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {details.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditor({ mode: "edit", location })}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={activeMutation.isPending || lastCoreLocation}
                      title={
                        lastCoreLocation
                          ? `Add another active ${details.label} location before archiving this one.`
                          : undefined
                      }
                      onClick={() =>
                        activeMutation.mutate({ id: location.id, isActive: !location.isActive })
                      }
                    >
                      {location.isActive ? (
                        <Archive className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {location.isActive ? "Archive" : "Restore"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editor.mode !== "closed" ? (
        <LocationEditor
          key={editor.mode === "edit" ? editor.location.id : "create"}
          state={editor}
          existing={list.data?.items ?? []}
          pending={addMutation.isPending || updateMutation.isPending}
          onClose={() => setEditor({ mode: "closed" })}
          onSave={(fields) => {
            if (editor.mode === "edit") {
              updateMutation.mutate({ id: editor.location.id, fields });
            } else {
              addMutation.mutate(fields);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function LocationEditor({
  state,
  existing,
  pending,
  onClose,
  onSave,
}: {
  state: Exclude<EditorState, { mode: "closed" }>;
  existing: ManagedTrainingLocation[];
  pending: boolean;
  onClose: () => void;
  onSave: (fields: TrainingLocationFields) => void;
}) {
  const [form, setForm] = useState<TrainingLocationFields>(
    state.mode === "edit" ? { name: state.location.name, kind: state.location.kind } : BLANK,
  );

  const normalizedName = form.name.trim().toLocaleLowerCase();
  const duplicate = existing.some(
    (location) =>
      location.id !== (state.mode === "edit" ? state.location.id : null) &&
      location.name.trim().toLocaleLowerCase() === normalizedName,
  );
  const lockedCoreKind = state.mode === "edit" && state.location.kind !== "other";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.mode === "edit" ? "Edit location" : "Add location"}</DialogTitle>
          <DialogDescription>
            Names appear in Log and History. The context controls exercise filtering and planning
            history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="location-name">Location name</Label>
            <Input
              id="location-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Climbing centre"
              autoFocus
            />
            {duplicate ? (
              <p className="text-xs text-destructive">Use a unique location name.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="location-kind">Training context</Label>
            <Select
              value={form.kind}
              disabled={lockedCoreKind}
              onValueChange={(kind: TrainingLocationKind) =>
                setForm((current) => ({ ...current, kind }))
              }
            >
              <SelectTrigger id="location-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="gym">Gym</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {lockedCoreKind
                ? "Core Home and Gym locations keep their context when renamed."
                : KIND_DETAILS[form.kind].description}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave({ name: form.name.trim(), kind: form.kind })}
            disabled={pending || !form.name.trim() || duplicate}
          >
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
