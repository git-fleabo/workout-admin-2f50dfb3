import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarRange,
  Dumbbell,
  Gauge,
  Layers3,
  Loader2,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  listProgrammeTemplatesClient,
  type ProgrammeTemplate,
  type ProgrammeTemplateEntry,
  type ProgrammeTemplateWorkout,
} from "@/lib/supabase-programmes.browser";

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
  const templates = useQuery({
    queryKey: ["programme-templates"],
    queryFn: listProgrammeTemplatesClient,
  });
  const [selectedId, setSelectedId] = useState("");

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
      <header className="border-b border-border pb-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-fuchsia-300">
          <Layers3 className="h-4 w-4" /> Training setup
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Programme templates</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Review the reusable strength blocks stored in the training database. Templates define the
          sequence and prescription; choosing exercises and starting a block will come in the next
          iteration.
        </p>
      </header>

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
                    <Badge variant="secondary">{titleCase(selected.methodType)}</Badge>
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
                    This view reads protected system templates only. It does not create an active
                    programme, change your current Plan, or calculate working weights yet.
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
    </div>
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
