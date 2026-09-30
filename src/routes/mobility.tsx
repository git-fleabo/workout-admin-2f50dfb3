import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { launchMobilityPractice } from "@/lib/mobility-launch.browser";
import { todayISO } from "@/lib/date";
import {
  currentMobilityRun,
  MOBILITY_SKILLS,
  mobilityNextAction,
  type MobilityAssessment,
  type MobilityRun,
  type MobilitySkill,
} from "@/lib/mobility-practice";
import { getLibraryClient } from "@/lib/supabase-log.browser";
import {
  deleteMobilityAssessmentClient,
  deleteMobilityDrillClient,
  listMobilityDataClient,
  saveMobilityAssessmentClient,
  saveMobilityDrillClient,
  setMobilityRunStatusClient,
  startMobilityRunClient,
  updateMobilityRunClient,
} from "@/lib/supabase-mobility.browser";

export const Route = createFileRoute("/mobility")({
  head: () => ({ meta: [{ title: "Mobility Practice · Train & Track" }] }),
  component: MobilityPage,
});

type MobilityData = Awaited<ReturnType<typeof listMobilityDataClient>>;
const emptyAssessment = () => ({
  id: "",
  testKey: "",
  side: "none" as MobilityAssessment["side"],
  measuredOn: todayISO(),
  value: "",
  unit: "deg" as MobilityAssessment["unit"],
  setupNote: "",
});
const emptyDrill = () => ({
  id: "",
  exerciseId: "",
  name: "",
  lessonUrl: "",
  targetSets: "1",
  targetReps: "",
  targetWeightKg: "",
  targetHoldSeconds: "",
  targetDetail: "",
  isActive: true,
});

function MobilityPage() {
  const data = useQuery({ queryKey: ["mobility-practice"], queryFn: listMobilityDataClient });
  const library = useQuery({
    queryKey: ["library"],
    queryFn: getLibraryClient,
    staleTime: 300_000,
  });
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold">Mobility practice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Pike and Bridge plans sit alongside your main training programme. Enter only your own
          results and the drills you choose from the toolkit.
        </p>
      </header>
      {data.isLoading ? (
        <p>Loading practice…</p>
      ) : data.error ? (
        <p className="text-destructive">
          Mobility practice could not be loaded: {(data.error as Error).message}
        </p>
      ) : (
        (["pike", "bridge"] as MobilitySkill[]).map((skill) => (
          <SkillPanel key={skill} skill={skill} data={data.data!} library={library.data} />
        ))
      )}
      <Button asChild variant="ghost">
        <Link to="/plan">Back to Plan</Link>
      </Button>
    </div>
  );
}

function SkillPanel({
  skill,
  data,
  library,
}: {
  skill: MobilitySkill;
  data: MobilityData;
  library?: Awaited<ReturnType<typeof getLibraryClient>>;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const run = currentMobilityRun(data.runs, skill);
  const history = data.runs.filter((item) => item.skill === skill && item.status === "archived");
  const assessments = data.assessments.filter((item) => item.runId === run?.id);
  const drills = data.drills.filter((item) => item.runId === run?.id);
  const sessions = data.sessions.filter((item) => item.runId === run?.id);
  const sevenDayStart = new Date(`${todayISO()}T00:00:00`);
  sevenDayStart.setDate(sevenDayStart.getDate() - 6);
  const sevenDayStartISO = `${sevenDayStart.getFullYear()}-${String(sevenDayStart.getMonth() + 1).padStart(2, "0")}-${String(sevenDayStart.getDate()).padStart(2, "0")}`;
  const sessionsLast7Days = sessions.filter((session) => session.date >= sevenDayStartISO).length;
  const toolkitExercises =
    library?.exercises.filter((exercise) => exercise.toolkitSection === skill) ?? [];
  const toolkitExerciseIds = new Set(toolkitExercises.map((exercise) => exercise.id));
  const action = mobilityNextAction({
    run,
    assessmentCount: assessments.length,
    activeDrillCount: drills.filter((item) => item.isActive).length,
    mappedDrillCount: drills.filter(
      (item) => item.isActive && item.exerciseId && toolkitExerciseIds.has(item.exerciseId),
    ).length,
    today: todayISO(),
  });
  const [assessment, setAssessment] = useState(emptyAssessment);
  const [drill, setDrill] = useState(emptyDrill);
  const [readiness, setReadiness] = useState<"unchecked" | "ready" | "shoulders_first">(
    "unchecked",
  );
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [notes, setNotes] = useState<string | null>(null);
  const [reviewOn, setReviewOn] = useState<string | null>(null);
  const [phase, setPhase] = useState<MobilityRun["phase"] | null>(null);
  const mutation = useMutation({
    mutationFn: async (operation: () => Promise<unknown>) => operation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mobility-practice"] });
      toast.success("Mobility practice saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const save = (operation: () => Promise<unknown>) => mutation.mutate(operation);
  const source = MOBILITY_SKILLS[skill];
  const canLog =
    run?.status === "active" &&
    (skill === "pike" || run.readiness === "ready") &&
    drills.some((item) => item.isActive);
  const allActiveDrillsMapped = drills.every(
    (item) => !item.isActive || Boolean(item.exerciseId && toolkitExerciseIds.has(item.exerciseId)),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{source.label}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {run
                ? `${run.status} · ${run.phase.replace("_", " ")} · started ${run.startedOn}`
                : "Not started"}
            </p>
          </div>
          {run ? (
            <Button
              size="sm"
              disabled={!canLog || !allActiveDrillsMapped || !library || mutation.isPending}
              onClick={() => library && launchMobilityPractice(run, drills, library, navigate)}
            >
              Log practice
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={mutation.isPending}
              onClick={() => save(() => startMobilityRunClient(skill))}
            >
              Start practice
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm">
          Next: <strong>{action.label}</strong>
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {source.readinessUrl && (
            <a
              href={source.readinessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Readiness check ↗
            </a>
          )}
          <a
            href={source.assessmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Assessment lesson ↗
          </a>
          <a
            href={source.builderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Personal program builder ↗
          </a>
          {source.warmupUrl && (
            <a
              href={source.warmupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Warm up ↗
            </a>
          )}
          {source.cooldownUrl && (
            <a
              href={source.cooldownUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Cooldown ↗
            </a>
          )}
        </div>
        {run && (
          <>
            {skill === "bridge" && (
              <section className="space-y-2 border-t border-border pt-4">
                <h3 className="font-semibold">Bridge readiness</h3>
                <p className="text-xs text-muted-foreground">
                  Record the result given by the toolkit. The app does not make a recommendation
                  from the angles.
                </p>
                <p className="text-sm">
                  Current: {run.readiness.replace("_", " ")}
                  {run.readinessCheckedOn ? ` · checked ${run.readinessCheckedOn}` : ""}
                </p>
                <div className="grid gap-2 sm:grid-cols-4">
                  <label className="text-xs">
                    Toolkit result
                    <select
                      className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                      value={readiness}
                      onChange={(event) => setReadiness(event.target.value as typeof readiness)}
                    >
                      <option value="unchecked">Choose toolkit result</option>
                      <option value="ready">Ready for Bridge</option>
                      <option value="shoulders_first">Shoulder work first</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    Left shoulder angle °
                    <Input
                      type="number"
                      min="0"
                      max="360"
                      value={left}
                      onChange={(event) => setLeft(event.target.value)}
                    />
                  </label>
                  <label className="text-xs">
                    Right shoulder angle °
                    <Input
                      type="number"
                      min="0"
                      max="360"
                      value={right}
                      onChange={(event) => setRight(event.target.value)}
                    />
                  </label>
                  <Button
                    className="self-end"
                    variant="outline"
                    disabled={mutation.isPending || readiness === "unchecked"}
                    onClick={() =>
                      save(() =>
                        updateMobilityRunClient(run.id, {
                          readiness,
                          readinessCheckedOn: todayISO(),
                          readinessLeftDeg: left ? Number(left) : null,
                          readinessRightDeg: right ? Number(right) : null,
                        }),
                      )
                    }
                  >
                    Save result
                  </Button>
                </div>
              </section>
            )}
            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="font-semibold">Assessments</h3>
              <p className="text-xs text-muted-foreground">
                Use the toolkit lesson for the test setup. Results stay with this practice run.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs">
                  Test
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={assessment.testKey}
                    onChange={(event) =>
                      setAssessment({ ...assessment, testKey: event.target.value })
                    }
                  >
                    <option value="">Choose test</option>
                    {source.tests.map((test) => (
                      <option key={test.key} value={test.key}>
                        {test.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Date
                  <Input
                    type="date"
                    value={assessment.measuredOn}
                    onChange={(event) =>
                      setAssessment({ ...assessment, measuredOn: event.target.value })
                    }
                  />
                </label>
                <label className="text-xs">
                  Side
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={assessment.side}
                    onChange={(event) =>
                      setAssessment({
                        ...assessment,
                        side: event.target.value as MobilityAssessment["side"],
                      })
                    }
                  >
                    <option value="none">No side</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label className="text-xs">
                  Result
                  <Input
                    type={assessment.unit === "text" ? "text" : "number"}
                    step="any"
                    value={assessment.value}
                    onChange={(event) =>
                      setAssessment({ ...assessment, value: event.target.value })
                    }
                  />
                </label>
                <label className="text-xs">
                  Unit
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={assessment.unit}
                    onChange={(event) =>
                      setAssessment({
                        ...assessment,
                        unit: event.target.value as MobilityAssessment["unit"],
                        value: "",
                      })
                    }
                  >
                    <option value="deg">degrees</option>
                    <option value="cm">cm</option>
                    <option value="text">short text</option>
                  </select>
                </label>
                <label className="text-xs">
                  Setup note
                  <Input
                    value={assessment.setupNote}
                    onChange={(event) =>
                      setAssessment({ ...assessment, setupNote: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={mutation.isPending || !assessment.testKey || !assessment.value.trim()}
                  onClick={() =>
                    save(async () => {
                      await saveMobilityAssessmentClient({
                        id: assessment.id || undefined,
                        runId: run.id,
                        skill,
                        testKey: assessment.testKey,
                        side: assessment.side,
                        measuredOn: assessment.measuredOn,
                        valueNumeric: assessment.unit === "text" ? null : Number(assessment.value),
                        valueText: assessment.unit === "text" ? assessment.value : "",
                        unit: assessment.unit,
                        setupNote: assessment.setupNote,
                      });
                      setAssessment(emptyAssessment());
                    })
                  }
                >
                  {assessment.id ? "Save correction" : "Add result"}
                </Button>
                {assessment.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAssessment(emptyAssessment())}
                  >
                    Cancel
                  </Button>
                )}
              </div>
              {assessments.length > 0 && (
                <div className="space-y-1 text-sm">
                  {source.tests
                    .flatMap((test) =>
                      (["none", "left", "right"] as const).map((side) => {
                        const matching = assessments
                          .filter((item) => item.testKey === test.key && item.side === side)
                          .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
                        if (!matching.length) return null;
                        const first = matching[0];
                        const last = matching[matching.length - 1];
                        const render = (item: MobilityAssessment) =>
                          `${item.valueNumeric ?? item.valueText} ${item.unit === "text" ? "" : item.unit}`;
                        const change =
                          first.valueNumeric != null &&
                          last.valueNumeric != null &&
                          first.unit === last.unit &&
                          first.id !== last.id
                            ? last.valueNumeric - first.valueNumeric
                            : null;
                        return (
                          <div
                            key={`${test.key}-${side}`}
                            className="rounded-md border border-border p-2"
                          >
                            <strong>
                              {test.label}
                              {side !== "none" && ` · ${side}`}
                            </strong>{" "}
                            · baseline {render(first)} ({first.measuredOn}) · latest {render(last)}{" "}
                            ({last.measuredOn})
                            {change != null &&
                              ` · change ${change > 0 ? "+" : ""}${change} ${last.unit}`}
                            {matching.map((item) => (
                              <div
                                key={item.id}
                                className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                              >
                                <span>
                                  {item.measuredOn} · {item.side} · {render(item)}
                                  {item.setupNote && ` · ${item.setupNote}`}
                                </span>
                                <button
                                  className="underline"
                                  onClick={() =>
                                    setAssessment({
                                      id: item.id,
                                      testKey: item.testKey,
                                      side: item.side,
                                      measuredOn: item.measuredOn,
                                      value: String(item.valueNumeric ?? item.valueText),
                                      unit: item.unit,
                                      setupNote: item.setupNote,
                                    })
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  className="underline"
                                  onClick={() => {
                                    if (window.confirm("Remove this assessment result?"))
                                      save(() => deleteMobilityAssessmentClient(item.id, run.id));
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      }),
                    )
                    .filter(Boolean)}
                </div>
              )}
            </section>
            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="font-semibold">My drill plan</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={run.planReceived}
                  onChange={(event) =>
                    save(() =>
                      updateMobilityRunClient(run.id, { planReceived: event.target.checked }),
                    )
                  }
                />{" "}
                I received my personal programme
              </label>
              <p className="text-xs text-muted-foreground">
                Enter the drill order and targets from your own programme. Choose a {source.label}
                toolkit exercise to load it into Log.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs">
                  Drill name
                  <Input
                    value={drill.name}
                    onChange={(event) => setDrill({ ...drill, name: event.target.value })}
                  />
                </label>
                <label className="text-xs">
                  Library exercise
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={drill.exerciseId}
                    onChange={(event) => {
                      const exercise = toolkitExercises.find(
                        (item) => item.id === event.target.value,
                      );
                      setDrill({
                        ...drill,
                        exerciseId: event.target.value,
                        name: drill.name.trim() || exercise?.name || "",
                        lessonUrl: drill.lessonUrl.trim() || exercise?.toolkitLessonUrl || "",
                      });
                    }}
                  >
                    <option value="">Choose toolkit exercise</option>
                    {toolkitExercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Toolkit lesson link
                  <Input
                    type="url"
                    value={drill.lessonUrl}
                    onChange={(event) => setDrill({ ...drill, lessonUrl: event.target.value })}
                  />
                </label>
                <label className="text-xs">
                  Sets
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={drill.targetSets}
                    onChange={(event) => setDrill({ ...drill, targetSets: event.target.value })}
                  />
                </label>
                <label className="text-xs">
                  Reps or rep guidance
                  <Input
                    value={drill.targetReps}
                    onChange={(event) => setDrill({ ...drill, targetReps: event.target.value })}
                  />
                </label>
                <label className="text-xs">
                  Weight kg
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={drill.targetWeightKg}
                    onChange={(event) => setDrill({ ...drill, targetWeightKg: event.target.value })}
                  />
                </label>
                <label className="text-xs">
                  Hold seconds
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    value={drill.targetHoldSeconds}
                    onChange={(event) =>
                      setDrill({ ...drill, targetHoldSeconds: event.target.value })
                    }
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  Other target details
                  <Input
                    value={drill.targetDetail}
                    onChange={(event) => setDrill({ ...drill, targetDetail: event.target.value })}
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={mutation.isPending || !drill.name.trim()}
                  onClick={() =>
                    save(async () => {
                      await saveMobilityDrillClient({
                        id: drill.id || undefined,
                        runId: run.id,
                        exerciseId: drill.exerciseId || null,
                        name: drill.name,
                        lessonUrl: drill.lessonUrl,
                        sortOrder: drill.id
                          ? (drills.find((item) => item.id === drill.id)?.sortOrder ?? 0)
                          : drills.length,
                        targetSets: drill.targetSets ? Number(drill.targetSets) : null,
                        targetReps: drill.targetReps,
                        targetWeightKg: drill.targetWeightKg ? Number(drill.targetWeightKg) : null,
                        targetHoldSeconds: drill.targetHoldSeconds
                          ? Number(drill.targetHoldSeconds)
                          : null,
                        targetDetail: drill.targetDetail,
                        isActive: drill.isActive,
                      });
                      setDrill(emptyDrill());
                    })
                  }
                >
                  {drill.id ? "Save drill" : "Add drill"}
                </Button>
                {drill.id && (
                  <Button size="sm" variant="ghost" onClick={() => setDrill(emptyDrill())}>
                    Cancel
                  </Button>
                )}
              </div>
              <ol className="space-y-1 text-sm">
                {drills.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2"
                  >
                    <span className="min-w-0 flex-1">
                      {item.sortOrder + 1}. {item.name}
                      {!item.isActive && " · inactive"}
                      {item.targetSets && ` · ${item.targetSets} sets`}
                      {item.targetReps && ` · ${item.targetReps} reps`}
                      {item.targetHoldSeconds && ` · ${item.targetHoldSeconds}s`}
                    </span>
                    {item.lessonUrl && (
                      <a
                        href={item.lessonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Lesson ↗
                      </a>
                    )}
                    <button
                      className="text-xs underline"
                      onClick={() =>
                        setDrill({
                          id: item.id,
                          exerciseId: item.exerciseId ?? "",
                          name: item.name,
                          lessonUrl: item.lessonUrl,
                          targetSets: String(item.targetSets ?? ""),
                          targetReps: item.targetReps,
                          targetWeightKg: String(item.targetWeightKg ?? ""),
                          targetHoldSeconds: String(item.targetHoldSeconds ?? ""),
                          targetDetail: item.targetDetail,
                          isActive: item.isActive,
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs underline"
                      onClick={() => {
                        if (window.confirm("Remove this drill?"))
                          save(() => deleteMobilityDrillClient(item.id, run.id));
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            </section>
            <section className="space-y-2 border-t border-border pt-4">
              <h3 className="font-semibold">Practice history</h3>
              <p className="text-sm text-muted-foreground">
                {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
                {sessions[0] && ` · last ${sessions[0].date}`}
                {` · ${sessionsLast7Days} in the past 7 days`}
              </p>
              {sessions.slice(0, 5).map((item) => (
                <p key={item.id} className="text-sm">
                  {item.date} · {item.title}
                </p>
              ))}
            </section>
            <details className="border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Phase and practice controls
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="text-xs">
                    Phase
                    <select
                      className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                      value={phase ?? run.phase}
                      onChange={(event) => setPhase(event.target.value as MobilityRun["phase"])}
                    >
                      <option value="setup">Setup</option>
                      <option value="phase_1">Phase 1</option>
                      <option value="phase_2">Phase 2</option>
                      <option value="phase_3">Phase 3</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    Review date
                    <Input
                      type="date"
                      value={reviewOn ?? run.reviewOn ?? ""}
                      onChange={(event) => setReviewOn(event.target.value)}
                    />
                  </label>
                  <label className="text-xs">
                    Notes
                    <Input
                      value={notes ?? run.notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </label>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    save(() =>
                      updateMobilityRunClient(run.id, {
                        phase: phase ?? run.phase,
                        reviewOn: reviewOn ?? run.reviewOn,
                        notes: notes ?? run.notes,
                      }),
                    )
                  }
                >
                  Save controls
                </Button>
                <div className="flex gap-2">
                  {run.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => save(() => setMobilityRunStatusClient(run.id, "paused"))}
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => save(() => setMobilityRunStatusClient(run.id, "active"))}
                    >
                      Resume
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (
                        window.confirm(
                          `End ${source.label} practice? Its assessments and completed sessions will remain in history.`,
                        )
                      )
                        save(() => setMobilityRunStatusClient(run.id, "archived"));
                    }}
                  >
                    End practice
                  </Button>
                </div>
              </div>
            </details>
          </>
        )}
        {history.length > 0 && (
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer text-sm">
              Previous {source.label} runs ({history.length})
            </summary>
            <div className="mt-2 space-y-2 text-sm">
              {history.map((item) => (
                <div key={item.id} className="rounded-md border border-border p-2">
                  <strong>
                    {item.startedOn}–{item.endedOn ?? ""}
                  </strong>
                  {data.assessments
                    .filter((result) => result.runId === item.id)
                    .map((result) => (
                      <p key={result.id} className="text-xs text-muted-foreground">
                        {result.measuredOn} ·{" "}
                        {source.tests.find((test) => test.key === result.testKey)?.label ??
                          result.testKey}{" "}
                        · {result.side} · {result.valueNumeric ?? result.valueText}{" "}
                        {result.unit === "text" ? "" : result.unit}
                      </p>
                    ))}
                  {data.sessions
                    .filter((session) => session.runId === item.id)
                    .map((session) => (
                      <p key={session.id} className="text-xs text-muted-foreground">
                        {session.date} · {session.title}
                      </p>
                    ))}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
