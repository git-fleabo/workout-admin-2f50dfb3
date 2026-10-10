import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  baseStrengthSlots,
  baseStrengthMethod,
  buildBaseStrengthPersonalSessions,
  type BaseStrengthChoice,
} from "@/lib/base-strength-personal";
import {
  buildBaseStrengthWeeks,
  type BaseStrengthProgrammeId,
  type BaseStrengthPhase,
  type VolumeIntensityOptions,
} from "@/lib/base-strength-preview";
import { listLibraryClient } from "@/lib/supabase-library.browser";
import { listProgrammeTemplatesClient } from "@/lib/supabase-programmes.browser";
import { supabasePublicRpc } from "@/lib/supabase-public";
import { programmeExerciseTrackingMode } from "@/lib/personal-programme";
import { todayISO } from "@/lib/date";

export type BaseStrengthSetupExercise = {
  id: string;
  name: string;
  trackingMode: "weight_reps" | "reps_only";
};
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const number = (value: string) => (value.trim() ? Number(value) : null);
type SetupInput = {
  name: string;
  startedOn: string;
  locationKind: "home" | "gym";
  increment: number;
  choices: Record<string, BaseStrengthChoice>;
};

export function BaseStrengthSetupForm({
  programme,
  options,
  exercises,
  saving,
  onSave,
  onClose,
}: {
  programme: BaseStrengthProgrammeId;
  options: VolumeIntensityOptions;
  exercises: BaseStrengthSetupExercise[];
  saving: boolean;
  onSave: (input: SetupInput) => Promise<void>;
  onClose: () => void;
}) {
  const slots = baseStrengthSlots(programme);
  const [name, setName] = useState(
    `My ${programme === "bullmastiff" ? "Bullmastiff" : programme === "dup" ? "DUP" : "Volume/Intensity"}`,
  );
  const [startedOn, setStartedOn] = useState(todayISO);
  const [locationKind, setLocationKind] = useState<"home" | "gym">("gym");
  const [increment, setIncrement] = useState("2.5");
  const [error, setError] = useState("");
  const [choices, setChoices] = useState<Record<string, BaseStrengthChoice>>(() =>
    Object.fromEntries(
      slots.map((slot) => {
        const match =
          programme === "dup" && slot.role === "accessory"
            ? undefined
            : exercises.find((e) => e.name.toLowerCase() === slot.name.toLowerCase());
        return [
          slot.key,
          {
            exerciseId: match?.id ?? "",
            exerciseName: match?.name ?? "",
            trackingMode: match?.trackingMode ?? "weight_reps",
            referenceMax: {},
            sets: null,
            reps: null,
            load: null,
          },
        ];
      }),
    ),
  );
  const patch = (key: string, change: Partial<BaseStrengthChoice>) =>
    setChoices((c) => ({ ...c, [key]: { ...c[key], ...change } }));
  const save = async () => {
    setError("");
    try {
      if (!name.trim() || name.trim().length > 200 || !/^\d{4}-\d{2}-\d{2}$/.test(startedOn))
        throw new Error("Choose a programme name and start date.");
      await onSave({ name, startedOn, locationKind, increment: Number(increment), choices });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The programme could not be saved.");
    }
  };
  return (
    <Card className="space-y-5 p-4 sm:p-6" aria-label="Personal Base Strength setup">
      <div>
        <h3 className="text-lg font-semibold">Make your version</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {buildBaseStrengthWeeks(programme, options).length} weeks. Save for review, then start
          from My Programme when you’re ready.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Programme name
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          Start date
          <Input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          Training location
          <select
            className={selectClass}
            value={locationKind}
            onChange={(e) => setLocationKind(e.target.value as "home" | "gym")}
          >
            <option value="gym">Gym</option>
            <option value="home">Home</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Load increment (kg)
          <Input
            type="number"
            min="0.1"
            max="100"
            step="any"
            value={increment}
            onChange={(e) => setIncrement(e.target.value)}
          />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        {programme === "dup"
          ? "Enter each main lift’s estimated 1RM for base work. Peak loads are chosen by RPE in My Programme, with back-off loads calculated from the top set."
          : "Use each chosen exercise’s own estimated 1RM, recorded consistently with your workout loads. Later phase maxes can stay blank until reassessment. Review those loads in My Programme before training."}
      </p>
      {(["main", "variation", "accessory"] as const)
        .filter((role) => slots.some((slot) => slot.role === role))
        .map((role) => (
          <details
            key={role}
            open={role === "main"}
            className="rounded-lg border border-border p-3"
          >
            <summary className="cursor-pointer font-medium">
              {role === "main"
                ? "Main lifts"
                : role === "variation"
                  ? "Base and peak variations"
                  : "Supporting exercises and personal targets"}
            </summary>
            <div className="mt-4 space-y-5">
              {slots
                .filter((s) => s.role === role)
                .map((slot) => {
                  const choice = choices[slot.key];
                  const phases: BaseStrengthPhase[] = slot.phase
                    ? [slot.phase]
                    : programme === "dup"
                      ? ["base"]
                      : programme === "bullmastiff"
                        ? ["base", "peak"]
                        : ["base", "build", "peak"];
                  return (
                    <div
                      key={slot.key}
                      className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <label className="block space-y-1 text-sm">
                        {slot.name}
                        {slot.phase ? ` · ${slot.phase}` : ""}
                        <select
                          className={selectClass}
                          value={choice.exerciseId}
                          onChange={(e) => {
                            const exercise = exercises.find((item) => item.id === e.target.value);
                            patch(slot.key, {
                              exerciseId: exercise?.id ?? "",
                              exerciseName: exercise?.name ?? "",
                              trackingMode: exercise?.trackingMode ?? "weight_reps",
                              referenceMax: {},
                            });
                          }}
                        >
                          <option value="">
                            {programme === "dup" && role === "accessory"
                              ? "None · optional"
                              : "Choose an exercise"}
                          </option>
                          {exercises
                            .filter((e) => role === "accessory" || e.trackingMode === "weight_reps")
                            .map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      {role !== "accessory" ? (
                        <div className="grid grid-cols-3 gap-2">
                          {phases.map((phase) => (
                            <label key={phase} className="space-y-1 text-xs capitalize">
                              {phase} max (kg)
                              <Input
                                aria-label={`${slot.name} ${phase} estimated max (kg)`}
                                type="number"
                                min="0.1"
                                max="1000"
                                step="any"
                                value={choice.referenceMax[phase] ?? ""}
                                onChange={(e) =>
                                  patch(slot.key, {
                                    referenceMax: {
                                      ...choice.referenceMax,
                                      [phase]: number(e.target.value) ?? undefined,
                                    },
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {programme === "bullmastiff"
                              ? "The first two base waves keep the source sets and reps. Choose your own targets for the third base wave and peak."
                              : programme === "dup"
                                ? "Optional on each session. Leave the exercise blank to omit it, or choose your own sets, reps and load. Keep supporting work limited."
                                : "Choose your own supporting sets and reps; the source leaves these open."}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {(["sets", "reps", "load"] as const).map((field) => (
                              <label key={field} className="space-y-1 text-xs">
                                {field === "load"
                                  ? "Load (kg)"
                                  : field === "sets"
                                    ? "Personal sets"
                                    : "Personal reps"}
                                <Input
                                  aria-label={`${slot.name} ${field}`}
                                  type="number"
                                  min={field === "load" ? "0" : "1"}
                                  max={field === "sets" ? "20" : field === "reps" ? "100" : "1000"}
                                  step={field === "load" ? "any" : "1"}
                                  disabled={field === "load" && choice.trackingMode === "reps_only"}
                                  value={choice[field] ?? ""}
                                  onChange={(e) =>
                                    patch(slot.key, { [field]: number(e.target.value) })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
            </div>
          </details>
        ))}
      <p className="text-xs text-muted-foreground">
        {programme === "bullmastiff" ? "Weeks 2 and 3 await the previous completed plus set. " : ""}
        RPE-based loads and any blank accessory loads need your review in My Programme.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save for review"}
        </Button>
        <Button variant="outline" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

export function BaseStrengthSetup({
  programme,
  options,
  onClose,
}: {
  programme: BaseStrengthProgrammeId;
  options: VolumeIntensityOptions;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const library = useQuery({
    queryKey: ["programme-assignment-library", "current"],
    queryFn: () => listLibraryClient(),
  });
  const templates = useQuery({
    queryKey: ["programme-templates"],
    queryFn: listProgrammeTemplatesClient,
  });
  const [saved, setSaved] = useState(false);
  const exercises = (library.data?.items ?? []).flatMap((item) => {
    if (!item.active || !item.enabled) return [];
    const mode = programmeExerciseTrackingMode(item);
    return mode === "weight_reps" || mode === "reps_only"
      ? [{ id: item.id, name: item.name, trackingMode: mode }]
      : [];
  });
  const save = useMutation({
    mutationFn: async (input: SetupInput) => {
      const personId = library.data?.selectedPersonId;
      if (!personId) throw new Error("Choose your training profile before saving.");
      const template = templates.data?.find(
        (t) =>
          t.methodType === baseStrengthMethod(programme) &&
          t.durationWeeks === buildBaseStrengthWeeks(programme, options).length,
      );
      if (!template)
        throw new Error(
          "Base Strength setup is waiting for the database update. Your preview remains available.",
        );
      const sessions = buildBaseStrengthPersonalSessions({
        ...input,
        programme,
        options,
        template,
      });
      return supabasePublicRpc<string>("create_personal_programme", {
        p_person_id: personId,
        p_program_id: template.id,
        p_name: input.name.trim(),
        p_started_on: input.startedOn,
        p_sessions: sessions,
        p_notes: "Personal version from Base Strength by Alex Bromley.",
      });
    },
    onSuccess: async () => {
      await Promise.all(
        [
          "programme-assignments",
          "my-programme-overview",
          "programme-workout-offers",
          "programme-schedule",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      setSaved(true);
      toast.success("Personal programme saved for review");
    },
  });
  if (saved)
    return (
      <Card className="space-y-3 p-5">
        <p className="font-semibold">Saved for review</p>
        <p className="text-sm text-muted-foreground">
          Open My Programme on Plan to review your sessions and choose when to start.
        </p>
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      </Card>
    );
  if (library.isLoading || templates.isLoading) return <p role="status">Loading your exercises…</p>;
  if (library.error || templates.error)
    return (
      <div role="alert">
        <p>Your exercises or programmes could not be loaded.</p>
        <Button
          variant="outline"
          onClick={() => {
            void library.refetch();
            void templates.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  return (
    <BaseStrengthSetupForm
      programme={programme}
      options={options}
      exercises={exercises}
      saving={save.isPending}
      onSave={async (input) => {
        await save.mutateAsync(input);
      }}
      onClose={onClose}
    />
  );
}
