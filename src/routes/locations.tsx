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
  Search,
  Settings2,
  Warehouse,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addEquipmentItemClient,
  addTrainingLocationClient,
  listManagedTrainingLocationsClient,
  saveTrainingLocationEquipmentClient,
  setEquipmentItemActiveClient,
  setTrainingLocationActiveClient,
  updateEquipmentItemClient,
  updateTrainingLocationClient,
  type EquipmentCategory,
  type EquipmentCircuitGroup,
  type EquipmentItemFields,
  type ManagedEquipmentItem,
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

type EquipmentEditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; item: ManagedEquipmentItem };

const BLANK: TrainingLocationFields = { name: "", kind: "other" };
const BLANK_EQUIPMENT: EquipmentItemFields = {
  name: "",
  category: "accessory",
  circuitGroup: "specialist",
};

const EQUIPMENT_CATEGORIES: Array<{
  value: EquipmentCategory;
  label: string;
}> = [
  { value: "free_weights", label: "Free weights" },
  { value: "fixed_equipment", label: "Fixed equipment" },
  { value: "cardio", label: "Cardio" },
  { value: "functional", label: "Functional" },
  { value: "accessory", label: "Accessories" },
];

const CIRCUIT_GROUPS: Array<{
  value: EquipmentCircuitGroup;
  label: string;
}> = [
  { value: "mat", label: "Mat" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "barbell", label: "Barbell" },
  { value: "bar_rings", label: "Bar / rings" },
  { value: "cardio_machine", label: "Bike / rower" },
  { value: "cable_machine", label: "Cable machine" },
  { value: "specialist", label: "Specialist kit" },
];

function equipmentCategoryLabel(category: EquipmentCategory) {
  return EQUIPMENT_CATEGORIES.find((option) => option.value === category)?.label ?? category;
}

function circuitGroupLabel(group: EquipmentCircuitGroup) {
  return CIRCUIT_GROUPS.find((option) => option.value === group)?.label ?? group;
}

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
  const [equipmentEditor, setEquipmentEditor] = useState<EquipmentEditorState>({
    mode: "closed",
  });
  const [equipmentLocation, setEquipmentLocation] = useState<ManagedTrainingLocation | null>(null);
  const [equipmentSearch, setEquipmentSearch] = useState("");

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

  const addEquipmentMutation = useMutation({
    mutationFn: addEquipmentItemClient,
    onSuccess: () => {
      toast.success("Equipment item added");
      setEquipmentEditor({ mode: "closed" });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: EquipmentItemFields }) =>
      updateEquipmentItemClient(id, fields),
    onSuccess: () => {
      toast.success("Equipment item updated");
      setEquipmentEditor({ mode: "closed" });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeEquipmentMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setEquipmentItemActiveClient(id, isActive),
    onSuccess: (_row, variables) => {
      toast.success(variables.isActive ? "Equipment item restored" : "Equipment item archived");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignmentMutation = useMutation({
    mutationFn: ({ locationId, equipmentIds }: { locationId: string; equipmentIds: string[] }) =>
      saveTrainingLocationEquipmentClient(locationId, equipmentIds),
    onSuccess: () => {
      toast.success("Location equipment updated");
      setEquipmentLocation(null);
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
  const activeEquipment = (list.data?.equipmentItems ?? []).filter((item) => item.isActive);
  const equipmentById = new Map(activeEquipment.map((item) => [item.id, item]));
  const normalizedEquipmentSearch = equipmentSearch.trim().toLowerCase();
  const visibleEquipment = (list.data?.equipmentItems ?? []).filter(
    (item) =>
      !normalizedEquipmentSearch ||
      item.name.toLowerCase().includes(normalizedEquipmentSearch) ||
      equipmentCategoryLabel(item.category).toLowerCase().includes(normalizedEquipmentSearch),
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
            Control the places available in the workout logger, their planning context, and the
            equipment you can use at each one.
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
            hides a location from new workouts without changing its historical sessions. Bodyweight
            movements remain available everywhere; equipment is configured separately below.
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
            const assignedEquipment = location.equipmentIds.flatMap((id) => {
              const item = equipmentById.get(id);
              return item ? [item] : [];
            });

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
                  <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Equipment
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {assignedEquipment.length
                          ? `${assignedEquipment.length} available`
                          : "None configured"}
                      </span>
                    </div>
                    {assignedEquipment.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedEquipment.slice(0, 6).map((item) => (
                          <Badge key={item.id} variant="secondary">
                            {item.name}
                          </Badge>
                        ))}
                        {assignedEquipment.length > 6 ? (
                          <Badge variant="outline">+{assignedEquipment.length - 6}</Badge>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Add the kit that should be available when training here.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Manage equipment at ${location.name}`}
                      onClick={() => setEquipmentLocation(location)}
                    >
                      <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Equipment
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${location.name}`}
                      onClick={() => setEditor({ mode: "edit", location })}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`${location.isActive ? "Archive" : "Restore"} ${location.name}`}
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

      {!list.isLoading && !list.error && !list.data?.needsProfileClaim ? (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-400/10 text-amber-300">
                  <Wrench className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Equipment list</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Maintain one reusable list, then choose from it for each location.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setEquipmentEditor({ mode: "create" })}>
                <Plus className="mr-2 h-4 w-4" /> Add equipment
              </Button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={equipmentSearch}
                onChange={(event) => setEquipmentSearch(event.target.value)}
                placeholder="Search equipment or category"
                aria-label="Search equipment"
              />
            </div>

            <div className="divide-y divide-border rounded-lg border border-border">
              {visibleEquipment.length ? (
                visibleEquipment.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col gap-3 p-3 sm:flex-row sm:items-center ${
                      item.isActive ? "" : "bg-secondary/20 opacity-65"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        <Badge variant="outline">{equipmentCategoryLabel(item.category)}</Badge>
                        <Badge variant="secondary">{circuitGroupLabel(item.circuitGroup)}</Badge>
                        {!item.isActive ? <Badge variant="secondary">Archived</Badge> : null}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => setEquipmentEditor({ mode: "edit", item })}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`${item.isActive ? "Archive" : "Restore"} ${item.name}`}
                        disabled={activeEquipmentMutation.isPending}
                        onClick={() =>
                          activeEquipmentMutation.mutate({
                            id: item.id,
                            isActive: !item.isActive,
                          })
                        }
                      >
                        {item.isActive ? (
                          <Archive className="mr-1.5 h-3.5 w-3.5" />
                        ) : (
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {item.isActive ? "Archive" : "Restore"}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  No equipment matches that search.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

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

      {equipmentEditor.mode !== "closed" ? (
        <EquipmentEditor
          key={equipmentEditor.mode === "edit" ? equipmentEditor.item.id : "create-equipment"}
          state={equipmentEditor}
          existing={list.data?.equipmentItems ?? []}
          pending={addEquipmentMutation.isPending || updateEquipmentMutation.isPending}
          onClose={() => setEquipmentEditor({ mode: "closed" })}
          onSave={(fields) => {
            if (equipmentEditor.mode === "edit") {
              updateEquipmentMutation.mutate({ id: equipmentEditor.item.id, fields });
            } else {
              addEquipmentMutation.mutate(fields);
            }
          }}
        />
      ) : null}

      {equipmentLocation ? (
        <LocationEquipmentEditor
          key={equipmentLocation.id}
          location={equipmentLocation}
          equipment={activeEquipment}
          pending={assignmentMutation.isPending}
          onClose={() => setEquipmentLocation(null)}
          onSave={(equipmentIds) =>
            assignmentMutation.mutate({ locationId: equipmentLocation.id, equipmentIds })
          }
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

function EquipmentEditor({
  state,
  existing,
  pending,
  onClose,
  onSave,
}: {
  state: Exclude<EquipmentEditorState, { mode: "closed" }>;
  existing: ManagedEquipmentItem[];
  pending: boolean;
  onClose: () => void;
  onSave: (fields: EquipmentItemFields) => void;
}) {
  const [form, setForm] = useState<EquipmentItemFields>(
    state.mode === "edit"
      ? {
          name: state.item.name,
          category: state.item.category,
          circuitGroup: state.item.circuitGroup,
        }
      : BLANK_EQUIPMENT,
  );
  const normalizedName = form.name.trim().toLowerCase();
  const duplicate = existing.some(
    (item) =>
      item.id !== (state.mode === "edit" ? state.item.id : null) &&
      item.name.trim().toLowerCase() === normalizedName,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.mode === "edit" ? "Edit equipment" : "Add equipment"}</DialogTitle>
          <DialogDescription>
            Keep names specific and reusable. The circuit group links this item to matching movement
            requirements.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="equipment-name">Equipment name</Label>
            <Input
              id="equipment-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Adjustable dumbbells"
              autoFocus
            />
            {duplicate ? (
              <p className="text-xs text-destructive">Use a unique equipment name.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="equipment-category">Category</Label>
            <Select
              value={form.category}
              onValueChange={(category: EquipmentCategory) =>
                setForm((current) => ({ ...current, category }))
              }
            >
              <SelectTrigger id="equipment-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_CATEGORIES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="equipment-circuit-group">Circuit matching group</Label>
            <Select
              value={form.circuitGroup}
              onValueChange={(circuitGroup: EquipmentCircuitGroup) =>
                setForm((current) => ({ ...current, circuitGroup }))
              }
            >
              <SelectTrigger id="equipment-circuit-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CIRCUIT_GROUPS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the closest broad group. Unusual or highly specific kit belongs in Specialist
              kit.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave({ ...form, name: form.name.trim() })}
            disabled={pending || !form.name.trim() || duplicate}
          >
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save equipment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LocationEquipmentEditor({
  location,
  equipment,
  pending,
  onClose,
  onSave,
}: {
  location: ManagedTrainingLocation;
  equipment: ManagedEquipmentItem[];
  pending: boolean;
  onClose: () => void;
  onSave: (equipmentIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    location.equipmentIds.filter((id) => equipment.some((item) => item.id === id)),
  );
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const visible = equipment.filter(
    (item) =>
      !normalizedSearch ||
      item.name.toLowerCase().includes(normalizedSearch) ||
      equipmentCategoryLabel(item.category).toLowerCase().includes(normalizedSearch),
  );
  const selected = new Set(selectedIds);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Equipment at {location.name}</DialogTitle>
          <DialogDescription>
            Select everything normally available here. Bodyweight movements never need to be added.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search equipment"
                aria-label="Search available equipment"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(equipment.map((item) => item.id))}
              >
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[50vh] rounded-lg border border-border">
            <div className="space-y-4 p-3">
              {EQUIPMENT_CATEGORIES.map((category) => {
                const items = visible.filter((item) => item.category === category.value);
                if (!items.length) return null;
                return (
                  <div key={category.value} className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {category.label}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((item) => (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-secondary/30"
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={selected.has(item.id)}
                            onCheckedChange={(checked) =>
                              setSelectedIds((current) =>
                                checked
                                  ? Array.from(new Set([...current, item.id]))
                                  : current.filter((id) => id !== item.id),
                              )
                            }
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{item.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {circuitGroupLabel(item.circuitGroup)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!visible.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No equipment matches that search.
                </p>
              ) : null}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            {selectedIds.length} {selectedIds.length === 1 ? "item" : "items"} selected
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => onSave(selectedIds)} disabled={pending}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save availability
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
