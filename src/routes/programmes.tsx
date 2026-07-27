import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarRange,
  Dumbbell,
  Gauge,
  Layers3,
  Loader2,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Textarea } from "@/components/ui/textarea";
import { listLibraryClient } from "@/lib/supabase-library.browser";
import { listManagedPeopleClient, type PersonRecord } from "@/lib/supabase-people.browser";
import { getProgrammeMethodSetup } from "@/lib/programme-methods";
import {
  createProgrammeAssignmentClient,
  listProgrammeAssignmentsClient,
  listProgrammeTemplatesClient,
  setProgrammeAssignmentStatusClient,
  type ProgrammeAssignment,
  type ProgrammeAssignmentInput,
  type ProgrammeTemplate,
  type ProgrammeTemplateEntry,
  type ProgrammeTemplateWorkout,
} from "@/lib/supabase-programmes.browser";
import { SettingsBackLink } from "@/components/settings-back-link";

export const Route = createFileRoute("/programmes")({
  head: () => ({
    meta: [
      { title: "Programme templates · Training Tracker" },
      {
        name: "description",
        content: "Review reusable percentage-based strength programme templates.",
      },
    ],
  }),
  component: ProgrammeTemplatesPage,
});

function titleCase(value: string | null) {
  if (!value) return "Programme";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRange(
  minimum: number | null,
  maximum: number | null,
  fallback: string | null,
  singular: string,
  plural: string,
) {
  if (minimum != null && maximum != null) {
    if (minimum === maximum) return `${minimum} ${minimum === 1 ? singular : plural}`;
    return `${minimum}–${maximum} ${plural}`;
  }
  if (minimum != null) return `${minimum}+ ${plural}`;
  if (maximum != null) return `Up to ${maximum} ${plural}`;
  return fallback?.trim() || null;
}

function entryPrescription(entry: ProgrammeTemplateEntry) {
  const sets = formatRange(entry.minSets, entry.maxSets, entry.sets, "set", "sets");
  const reps = formatRange(entry.minReps, entry.maxReps, entry.reps, "rep", "reps");
  const parts = [sets, reps].filter(Boolean);

  if (entry.intensityPercent != null) {
    parts.push(
      `${entry.intensityPercent}% ${entry.percentBase === "training_max" ? "training max" : titleCase(entry.percentBase).toLowerCase()}`,
    );
  } else if (entry.weight) {
    parts.push(entry.weight);
  }
  if (entry.duration) parts.push(entry.duration);
  if (entry.rpe) parts.push(`RPE ${entry.rpe}`);
  if (entry.rest) parts.push(`${entry.rest} rest`);

  return parts.join(" · ") || "Prescription details to be confirmed";
}

function weekGroups(template: ProgrammeTemplate) {
  const grouped = new Map<number, ProgrammeTemplateWorkout[]>();
  for (const workout of template.workouts) {
    const week = workout.weekNumber ?? 0;
    const list = grouped.get(week) ?? [];
    list.push(workout);
    grouped.set(week, list);
  }
  return Array.from(grouped, ([week, workouts]) => ({ week, workouts })).sort(
    (left, right) => left.week - right.week,
  );
}

function weekIntensity(workouts: ProgrammeTemplateWorkout[]) {
  const values = Array.from(
    new Set(
      workouts.flatMap((workout) =>
        workout.entries
          .map((entry) => entry.intensityPercent)
          .filter((value): value is number => value != null),
      ),
    ),
  ).sort((left, right) => left - right);
  if (!values.length) return null;
  return values.map((value) => `${value}%`).join(" / ");
}

function ProgrammeTemplatesPage() {
  const queryClient = useQueryClient();
  const templates = useQuery({
    queryKey: ["programme-templates"],
    queryFn: listProgrammeTemplatesClient,
  });
  const assignments = useQuery({
    queryKey: ["programme-assignments"],
    queryFn: listProgrammeAssignmentsClient,
  });
  const people = useQuery({
    queryKey: ["managed-people"],
    queryFn: listManagedPeopleClient,
  });
  const [selectedId, setSelectedId] = useState("");
  const [setupTemplate, setSetupTemplate] = useState<ProgrammeTemplate | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" | "archived" }) =>
      setProgrammeAssignmentStatusClient(id, status),
    onSuccess: (_, variables) => {
      toast.success(
        variables.status === "archived"
          ? "Programme archived"
          : variables.status === "paused"
            ? "Programme paused"
            : "Programme resumed",
      );
      void queryClient.invalidateQueries({ queryKey: ["programme-assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["programme-workout-offers"] });
      void queryClient.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (selectedId && templates.data?.some((template) => template.id === selectedId)) return;
    const operator = templates.data?.find((template) =>
      template.name.toLowerCase().includes("operator"),
    );
    setSelectedId((operator ?? templates.data?.[0])?.id ?? "");
  }, [selectedId, templates.data]);

  const selected = templates.data?.find((template) => template.id === selectedId) ?? null;
  const weeks = useMemo(() => (selected ? weekGroups(selected) : []), [selected]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SettingsBackLink />
      <header className="border-b border-border pb-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-fuchsia-300">
          <Layers3 className="h-4 w-4" /> Training setup
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Programme templates</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Review reusable training blocks, map their movement slots to a person’s Library, and start
          or pause an assignment without changing the protected template.
        </p>
      </header>

      <AssignmentList
        assignments={assignments.data ?? []}
        templates={templates.data ?? []}
        people={people.data ?? []}
        loading={assignments.isLoading}
        error={assignments.error instanceof Error ? assignments.error : null}
        changing={statusMutation.isPending}
        onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
      />

      {templates.isLoading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading programme templates…
        </div>
      ) : templates.error ? (
        <Card className="border-destructive/35 p-5 text-sm text-destructive">
          The programme templates could not be loaded.
        </Card>
      ) : !templates.data?.length ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No reusable programme templates are available yet.
        </Card>
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="choose-template-heading">
            <div>
              <h2 id="choose-template-heading" className="text-lg font-semibold">
                Choose a template to review
              </h2>
              <p className="text-sm text-muted-foreground">
                Compare the weekly cadence before opening the full prescription.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {templates.data.map((template) => {
                const active = template.id === selectedId;
                return (
                  <button
                    key={template.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedId(template.id)}
                    className="group rounded-xl text-left focus:outline-none"
                  >
                    <Card
                      className={`h-full p-4 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring ${
                        active
                          ? "border-fuchsia-400/40 bg-fuchsia-400/[0.07]"
                          : "group-hover:border-foreground/25 group-hover:bg-accent/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                            active
                              ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300"
                              : "border-border bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <Dumbbell className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{template.name}</h3>
                            {active ? <Badge>Selected</Badge> : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {template.description ?? "Reusable percentage-based strength block."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{template.durationWeeks ?? "—"} weeks</span>
                            <span>·</span>
                            <span>{template.sessionsPerWeek ?? "—"} sessions/week</span>
                            <span>·</span>
                            <span>{template.workouts.length} sessions</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          </section>

          {selected ? (
            <section className="space-y-4" aria-labelledby="selected-template-heading">
              <Card className="overflow-hidden border-fuchsia-400/25">
                <div className="border-b border-border bg-fuchsia-400/[0.05] p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 id="selected-template-heading" className="text-xl font-semibold">
                          {selected.name}
                        </h2>
                        <Badge variant="outline">Read only</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {selected.description ?? "Reusable percentage-based strength block."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{titleCase(selected.methodType)}</Badge>
                      <Button
                        size="sm"
                        onClick={() => setSetupTemplate(selected)}
                        disabled={!getProgrammeMethodSetup(selected.methodType)}
                      >
                        <Plus className="mr-1.5 h-4 w-4" /> Set up programme
                      </Button>
                    </div>
                  </div>
                </div>
                <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                  <TemplateStat
                    icon={<CalendarRange className="h-4 w-4" />}
                    label="Duration"
                    value={`${selected.durationWeeks ?? "—"} weeks`}
                  />
                  <TemplateStat
                    icon={<Target className="h-4 w-4" />}
                    label="Cadence"
                    value={`${selected.sessionsPerWeek ?? "—"} sessions/week`}
                  />
                  <TemplateStat
                    icon={<Gauge className="h-4 w-4" />}
                    label="Load basis"
                    value={titleCase(selected.percentBase)}
                  />
                  <TemplateStat
                    icon={<Dumbbell className="h-4 w-4" />}
                    label="Rounding"
                    value={
                      selected.roundingIncrement != null
                        ? `Nearest ${selected.roundingIncrement} kg`
                        : "No default"
                    }
                  />
                </CardContent>
              </Card>

              <Card className="border-sky-400/25 bg-sky-400/[0.05]">
                <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  <p>
                    Templates remain protected and read only. A programme assignment stores the
                    person, start date, movement mappings, and training maxes. It does not add
                    sessions to Today or Plan, or advance the programme yet.
                  </p>
                </CardContent>
              </Card>

              <Card className="px-5">
                <Accordion
                  type="single"
                  collapsible
                  defaultValue={weeks[0] ? `week-${weeks[0].week}` : undefined}
                >
                  {weeks.map(({ week, workouts }) => {
                    const intensity = weekIntensity(workouts);
                    return (
                      <AccordionItem key={week} value={`week-${week}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <span className="flex flex-1 flex-wrap items-center gap-2 pr-3">
                            <span className="font-semibold">
                              {week > 0 ? `Week ${week}` : "Programme sessions"}
                            </span>
                            <Badge variant="outline">
                              {workouts.length} {workouts.length === 1 ? "session" : "sessions"}
                            </Badge>
                            {intensity ? <Badge variant="secondary">{intensity}</Badge> : null}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                            {workouts.map((workout) => (
                              <WorkoutCard key={workout.id} workout={workout} />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </Card>
            </section>
          ) : null}
        </>
      )}

      {setupTemplate ? (
        <ProgrammeSetupDialog
          template={setupTemplate}
          onClose={() => setSetupTemplate(null)}
          onCreated={() => {
            setSetupTemplate(null);
            void queryClient.invalidateQueries({ queryKey: ["programme-assignments"] });
          }}
        />
      ) : null}
    </div>
  );
}

function AssignmentList({
  assignments,
  templates,
  people,
  loading,
  error,
  changing,
  onStatusChange,
}: {
  assignments: ProgrammeAssignment[];
  templates: ProgrammeTemplate[];
  people: PersonRecord[];
  loading: boolean;
  error: Error | null;
  changing: boolean;
  onStatusChange: (id: string, status: "active" | "paused" | "archived") => void;
}) {
  if (loading) return null;
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const personById = new Map(people.map((person) => [person.id, person]));

  return (
    <section className="space-y-3" aria-labelledby="assigned-programmes-heading">
      <div>
        <h2 id="assigned-programmes-heading" className="text-lg font-semibold">
          Assigned programmes
        </h2>
        <p className="text-sm text-muted-foreground">
          Active and paused blocks. Archived assignments leave this working list.
        </p>
      </div>
      {error ? (
        <Card className="border-destructive/35 p-5 text-sm text-destructive">
          Assigned programmes could not be loaded: {error.message}
        </Card>
      ) : !assignments.length ? (
        <Card className="border-dashed p-5 text-sm text-muted-foreground">
          No programme is assigned yet. Choose a template below to set up the first one.
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {assignments.map((assignment) => {
            const template = templateById.get(assignment.programId);
            return (
              <Card key={assignment.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{template?.name ?? "Programme"}</h3>
                      <Badge variant={assignment.status === "active" ? "default" : "secondary"}>
                        {titleCase(assignment.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {personById.get(assignment.personId)?.display_name ?? "Managed person"} ·
                      Started {assignment.startedOn ?? "not set"} · Next session{" "}
                      {assignment.currentWorkoutIndex + 1}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title={
                        assignment.status === "active" ? "Pause programme" : "Resume programme"
                      }
                      aria-label={
                        assignment.status === "active" ? "Pause programme" : "Resume programme"
                      }
                      disabled={changing}
                      onClick={() =>
                        onStatusChange(
                          assignment.id,
                          assignment.status === "active" ? "paused" : "active",
                        )
                      }
                    >
                      {assignment.status === "active" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Archive programme"
                      aria-label="Archive programme"
                      disabled={changing}
                      onClick={() => onStatusChange(assignment.id, "archived")}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {assignment.exercises.map((exercise) => (
                    <div key={exercise.id} className="rounded-md border border-border px-3 py-2">
                      <p className="text-xs text-muted-foreground">{titleCase(exercise.slotKey)}</p>
                      <p className="text-sm font-medium">{exercise.exerciseName}</p>
                      <p className="text-xs text-muted-foreground">
                        {exercise.trainingMax != null
                          ? `${exercise.trainingMax} kg training max`
                          : "No training max"}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

type SlotSetup = { exerciseId: string; trainingMax: string };
type ProgrammeSlot = { key: string; label: string; isOptional: boolean };

function programmeSlots(template: ProgrammeTemplate) {
  const slots = new Map<string, ProgrammeSlot>();
  for (const workout of template.workouts) {
    for (const entry of workout.entries) {
      if (!entry.slotKey) continue;
      const existing = slots.get(entry.slotKey);
      slots.set(entry.slotKey, {
        key: entry.slotKey,
        label: existing?.label ?? entry.name,
        isOptional: (existing?.isOptional ?? true) && entry.isOptional,
      });
    }
  }
  return Array.from(slots.values());
}

function ProgrammeSetupDialog({
  template,
  onClose,
  onCreated,
}: {
  template: ProgrammeTemplate;
  onClose: () => void;
  onCreated: () => void;
}) {
  const slots = useMemo(() => programmeSlots(template), [template]);
  const methodSetup = getProgrammeMethodSetup(template.methodType);
  const [personId, setPersonId] = useState("");
  const [startedOn, setStartedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"active" | "paused">("active");
  const [notes, setNotes] = useState("");
  const [slotSetup, setSlotSetup] = useState<Record<string, SlotSetup>>({});
  const library = useQuery({
    queryKey: ["programme-assignment-library", personId || "current"],
    queryFn: () => listLibraryClient(personId || undefined),
  });

  useEffect(() => {
    if (!personId && library.data?.selectedPersonId) setPersonId(library.data.selectedPersonId);
  }, [library.data?.selectedPersonId, personId]);

  const enabledExercises = useMemo(
    () =>
      (library.data?.items ?? []).filter(
        (item) =>
          item.active && item.enabled && item.workoutType.trim().toLowerCase() === "strength",
      ),
    [library.data?.items],
  );
  const selectedIds = slots.map((slot) => slotSetup[slot.key]?.exerciseId).filter(Boolean);
  const duplicateExercise = new Set(selectedIds).size !== selectedIds.length;
  const isComplete =
    Boolean(personId && startedOn) &&
    slots.length > 0 &&
    slots.every((slot) => {
      const setup = slotSetup[slot.key];
      if (!setup?.exerciseId) return slot.isOptional;
      if (!methodSetup?.trainingMax?.required) return true;
      return Number(setup.trainingMax) >= methodSetup.trainingMax.minimum;
    }) &&
    !duplicateExercise;

  const createMutation = useMutation({
    mutationFn: (input: ProgrammeAssignmentInput) => createProgrammeAssignmentClient(input),
    onSuccess: () => {
      toast.success(`${template.name} assigned`);
      onCreated();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function updateSlot(slotKey: string, patch: Partial<SlotSetup>) {
    setSlotSetup((current) => {
      const existing = current[slotKey];
      return {
        ...current,
        [slotKey]: {
          exerciseId: patch.exerciseId ?? existing?.exerciseId ?? "",
          trainingMax: patch.trainingMax ?? existing?.trainingMax ?? "",
        },
      };
    });
  }

  function submit() {
    if (!isComplete) return;
    createMutation.mutate({
      programId: template.id,
      personId,
      status,
      startedOn,
      notes,
      exercises: slots.flatMap((slot) => {
        const setup = slotSetup[slot.key];
        if (!setup?.exerciseId) return [];
        const exercise = enabledExercises.find((item) => item.id === setup.exerciseId);
        return [
          {
            slotKey: slot.key,
            exerciseId: setup.exerciseId,
            exerciseName: exercise?.name ?? slot.label,
            trainingMax: methodSetup?.trainingMax ? Number(setup.trainingMax) : null,
          },
        ];
      }),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Set up {template.name}</DialogTitle>
          <DialogDescription>
            Choose who is training and map the first lift. Additional lifts are optional.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="programme-person">Person</Label>
            <Select
              value={personId}
              onValueChange={(value) => {
                setPersonId(value);
                setSlotSetup({});
              }}
            >
              <SelectTrigger id="programme-person">
                <SelectValue placeholder="Choose person" />
              </SelectTrigger>
              <SelectContent>
                {(library.data?.people ?? []).map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="programme-start-date">Start date</Label>
            <Input
              id="programme-start-date"
              type="date"
              value={startedOn}
              onChange={(event) => setStartedOn(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="programme-status">Initial status</Label>
            <Select value={status} onValueChange={(value: "active" | "paused") => setStatus(value)}>
              <SelectTrigger id="programme-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Movement mappings</h3>
            <p className="text-xs text-muted-foreground">
              {methodSetup?.trainingMax
                ? `Choose enabled Strength movements. Each selected lift needs a ${methodSetup.trainingMax.label.toLowerCase()} in ${methodSetup.trainingMax.unit}.`
                : "Choose enabled Strength movements. Only the first lift is required."}
            </p>
          </div>
          {library.isLoading ? (
            <div className="flex items-center py-5 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Library…
            </div>
          ) : !enabledExercises.length ? (
            <Card className="border-dashed p-4 text-sm text-muted-foreground">
              This person has no enabled Strength movements. Enable Strength movements in Library
              first.
            </Card>
          ) : (
            slots.map((slot) => (
              <div
                key={slot.key}
                className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_150px]"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`slot-${slot.key}`}>{slot.label}</Label>
                    <Badge variant={slot.isOptional ? "secondary" : "outline"}>
                      {slot.isOptional ? "Optional" : "Required"}
                    </Badge>
                  </div>
                  <Select
                    value={slotSetup[slot.key]?.exerciseId ?? ""}
                    onValueChange={(value) =>
                      updateSlot(
                        slot.key,
                        value === "not_included"
                          ? { exerciseId: "", trainingMax: "" }
                          : { exerciseId: value },
                      )
                    }
                  >
                    <SelectTrigger id={`slot-${slot.key}`}>
                      <SelectValue placeholder="Choose Library movement" />
                    </SelectTrigger>
                    <SelectContent>
                      {slot.isOptional ? (
                        <SelectItem value="not_included">Not included</SelectItem>
                      ) : null}
                      {enabledExercises.map((exercise) => (
                        <SelectItem key={exercise.id} value={exercise.id}>
                          {exercise.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {methodSetup?.trainingMax ? (
                  <div className="space-y-2">
                    <Label htmlFor={`training-max-${slot.key}`}>
                      {methodSetup.trainingMax.label} ({methodSetup.trainingMax.unit})
                    </Label>
                    <Input
                      id={`training-max-${slot.key}`}
                      type="number"
                      min={methodSetup.trainingMax.minimum}
                      step={methodSetup.trainingMax.step}
                      inputMode="decimal"
                      value={slotSetup[slot.key]?.trainingMax ?? ""}
                      disabled={!slotSetup[slot.key]?.exerciseId}
                      onChange={(event) =>
                        updateSlot(slot.key, { trainingMax: event.target.value })
                      }
                      placeholder="e.g. 100"
                    />
                  </div>
                ) : null}
              </div>
            ))
          )}
          {duplicateExercise ? (
            <p className="text-xs text-destructive">Choose a different movement for each slot.</p>
          ) : null}
        </div>

        <div className="space-y-2 pt-2">
          <Label htmlFor="programme-notes">Notes (optional)</Label>
          <Textarea
            id="programme-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Context for this block…"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!isComplete || createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/35 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function WorkoutCard({ workout }: { workout: ProgrammeTemplateWorkout }) {
  return (
    <div className="rounded-lg border border-border bg-background/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          {workout.sessionNumber ? `Session ${workout.sessionNumber}` : workout.name}
        </h3>
        <Badge variant="outline">{workout.entries.length} movements</Badge>
      </div>
      {workout.description ? (
        <p className="mt-1 text-xs text-muted-foreground">{workout.description}</p>
      ) : null}
      <div className="mt-3 space-y-3">
        {workout.entries.map((entry) => (
          <div key={entry.id} className="border-l-2 border-fuchsia-400/25 pl-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{entry.name}</p>
              {entry.isOptional ? <Badge variant="secondary">Optional</Badge> : null}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {entryPrescription(entry)}
            </p>
            {entry.notes ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">{entry.notes}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
