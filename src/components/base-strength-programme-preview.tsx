import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Dumbbell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaseStrengthSetup } from "./base-strength-setup";
import {
  BASE_STRENGTH_CATALOGUE,
  BASE_STRENGTH_LIFTS,
  BASE_STRENGTH_SOURCE_URL,
  DEFAULT_VOLUME_INTENSITY_OPTIONS,
  baseStrengthSessions,
  buildBaseStrengthWeeks,
  bullmastiffNextLoad,
  roundedPreviewLoad,
  type BaseStrengthMovement,
  type BaseStrengthPhase,
  type BaseStrengthProgrammeId,
} from "@/lib/base-strength-preview";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const numberValue = (value: string) =>
  value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const phaseKey = (phase: BaseStrengthPhase, name: string) => `${phase}:${name}`;

function prescriptionLabel(movement: BaseStrengthMovement) {
  if (movement.sets == null) return "Choose sets and reps";
  const reps = movement.reps == null ? "AMRAP" : `${movement.reps} reps`;
  return `${movement.sets} ${movement.sets === 1 ? "set" : "sets"} × ${reps}${movement.plusLastSet && movement.reps != null ? ` · final set ${movement.reps}+` : ""}`;
}

export function BaseStrengthProgrammePreview() {
  const [selected, setSelected] = useState<BaseStrengthProgrammeId | null>(null);
  const [setup, setSetup] = useState(false);
  const [weekIndex, setWeekIndex] = useState(0);
  const [options, setOptions] = useState(DEFAULT_VOLUME_INTENSITY_OPTIONS);
  const [maxes, setMaxes] = useState<Record<string, string>>({});
  const [increment, setIncrement] = useState("2.5");
  const [exampleLift, setExampleLift] = useState<keyof typeof BASE_STRENGTH_LIFTS>("squat");
  const [workingLoad, setWorkingLoad] = useState("");
  const [plusReps, setPlusReps] = useState("");
  const [allCompleted, setAllCompleted] = useState(false);
  const weeks = useMemo(
    () => (selected ? buildBaseStrengthWeeks(selected, options) : []),
    [selected, options],
  );
  const week = weeks[Math.min(weekIndex, weeks.length - 1)];
  const programme = BASE_STRENGTH_CATALOGUE.find((item) => item.id === selected);
  const sessions = useMemo(
    () => (selected && week ? baseStrengthSessions(selected, week) : []),
    [selected, week],
  );
  const maxFor = (name: string) => numberValue(maxes[phaseKey(week.phase, name)] ?? "");
  const clearExample = () => {
    setWorkingLoad("");
    setPlusReps("");
    setAllCompleted(false);
  };
  const chooseWeek = (index: number) => {
    setWeekIndex(index);
    clearExample();
  };
  const decision =
    selected === "bullmastiff" && week
      ? bullmastiffNextLoad({
          week,
          nextWeek: weeks[weekIndex + 1] ?? null,
          referenceMax: maxFor(exampleLift),
          nextPhaseMax: numberValue(maxes[phaseKey("peak", exampleLift)] ?? ""),
          currentLoad: numberValue(workingLoad),
          lastSetReps: numberValue(plusReps),
          allSetsCompleted: allCompleted,
          increment: Number(increment),
        })
      : null;

  function updateMax(name: string, value: string) {
    setMaxes((previous) => ({ ...previous, [phaseKey(week.phase, name)]: value }));
  }

  return (
    <section className="space-y-4" aria-labelledby="base-strength-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="base-strength-heading" className="text-lg font-semibold">
          Explore Base Strength
        </h2>
        <Badge variant="outline">Programme previews</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Two approaches from Alex Bromley. Compare their workouts and try the progression before
        personal setup.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {BASE_STRENGTH_CATALOGUE.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected === item.id}
            aria-label={`Preview ${item.name}`}
            onClick={() => {
              setSetup(false);
              setSelected(item.id);
              chooseWeek(0);
            }}
            className={`rounded-2xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === item.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-semibold">
                <Dumbbell className="h-4 w-4 text-primary" />
                {item.name}
              </span>
              <Badge variant="secondary">{item.days} days/week</Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            <div className="mt-4 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{item.emphasis}</span>
              <span className="flex shrink-0 items-center gap-1 font-medium text-primary">
                {selected === item.id ? "Selected" : "Preview"}
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </button>
        ))}
      </div>
      {programme && week && selected ? (
        <Card className="overflow-hidden rounded-2xl border-primary/30">
          <div className="border-b border-border bg-primary/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">{programme.name} preview</h3>
              <span className="text-sm text-muted-foreground">
                {weeks.length} weeks · {weeks.length * programme.days} sessions
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Base work builds capacity; the peak shifts towards heavier, more specific work. Deload
              weeks can be added during personal setup.
            </p>
          </div>
          <CardContent className="space-y-6 p-5">
            {selected === "volume_intensity" ? (
              <details className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Wave choices · adjustable preview defaults
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">
                  The book allows repeated waves. This preview starts with two initial waves, one
                  heavier base wave, three peak waves and a 3% increase between repeats. The
                  heavier-base repeat count is an app choice.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(
                    [
                      ["initialWaves", "Initial base waves", [2, 3]],
                      ["buildWaves", "Heavier base waves", [1, 2, 3]],
                      ["peakWaves", "Peak waves", [3, 4]],
                      ["waveIncreasePercent", "Increase between repeats", [2, 3, 4]],
                    ] as const
                  ).map(([key, label, values]) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={`bs-${key}`}>{label}</Label>
                      <select
                        id={`bs-${key}`}
                        className={selectClass}
                        value={options[key]}
                        onChange={(event) => {
                          setOptions((previous) => ({
                            ...previous,
                            [key]: Number(event.target.value),
                          }));
                          chooseWeek(0);
                        }}
                      >
                        {values.map((value) => (
                          <option key={value} value={value}>
                            {value}
                            {key === "waveIncreasePercent" ? "% of estimated 1RM" : " waves"}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </details>
            ) : (
              <p className="text-sm text-muted-foreground">
                This preview follows the nine-week base and nine-week peak tables. Some accessory
                targets remain personal choices and are marked for review.
              </p>
            )}

            <Button onClick={() => setSetup(true)}>Make my version</Button>
            {setup && selected ? (
              <BaseStrengthSetup
                key={selected}
                programme={selected}
                options={options}
                onClose={() => setSetup(false)}
              />
            ) : null}
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_180px]">
              <div className="space-y-1.5">
                <Label htmlFor="bs-week">Explore a week</Label>
                <select
                  id="bs-week"
                  className={selectClass}
                  value={weekIndex}
                  onChange={(event) => chooseWeek(Number(event.target.value))}
                >
                  {weeks.map((item, index) => (
                    <option key={item.number} value={index}>
                      Week {item.number} · {item.phaseLabel} · wave {item.wave}, week{" "}
                      {item.waveWeek}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bs-rounding">Load increment</Label>
                <select
                  id="bs-rounding"
                  className={selectClass}
                  value={increment}
                  onChange={(event) => setIncrement(event.target.value)}
                >
                  {[0.5, 1, 1.25, 2.5, 5].map((value) => (
                    <option key={value} value={value}>
                      {value} kg
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <h4 className="text-sm font-semibold">
                Estimated one-rep maxes · {week.phaseLabel.toLowerCase()}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Optional for previewing weights. Use a tested or estimated 1RM, rather than a
                discounted training max. Estimates are separate for each phase; reassess at the
                transition. Loads round to the nearest chosen increment.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Object.entries(BASE_STRENGTH_LIFTS).map(([key, name]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`bs-max-${key}`}>{name} (kg)</Label>
                    <Input
                      id={`bs-max-${key}`}
                      type="number"
                      min="0.5"
                      step="0.5"
                      placeholder="Estimated 1RM"
                      value={maxes[phaseKey(week.phase, key)] ?? ""}
                      onChange={(event) => updateMax(key, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3" aria-label={`Week ${week.number} sessions`}>
              {sessions.map((session, index) => (
                <details
                  key={`${selected}-${week.number}-${session.name}`}
                  open={index === 0}
                  className="rounded-xl border border-border p-4"
                >
                  <summary className="cursor-pointer text-sm font-semibold">
                    {session.name}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {session.movements.length} movements
                    </span>
                  </summary>
                  <div className="mt-3 divide-y divide-border">
                    {session.movements.map((item) => {
                      const key = item.reference === "variation" ? item.name : item.reference;
                      const max = key ? maxFor(key) : null;
                      const load = roundedPreviewLoad(max, item.percent, Number(increment));
                      return (
                        <div key={item.name} className="space-y-2 py-3 first:pt-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">{item.name}</span>
                            <Badge variant="outline">
                              {item.role === "variation"
                                ? "Source variation · editable"
                                : item.role}
                            </Badge>
                          </div>
                          <p className="text-sm">
                            {prescriptionLabel(item)}
                            {item.percent != null ? ` · ${item.percent}% estimated 1RM` : ""}
                            {item.rpeTarget != null ? ` · RPE ${item.rpeTarget}` : ""}
                            {load != null ? (
                              <strong className="ml-2 text-primary">{load} kg</strong>
                            ) : null}
                          </p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {item.guidance}
                          </p>
                          {item.reference === "variation" ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Label htmlFor={`bs-variation-${index}`}>
                                {item.name} estimated 1RM (kg)
                              </Label>
                              <Input
                                id={`bs-variation-${index}`}
                                className="h-8 w-28"
                                type="number"
                                min="0.5"
                                step="0.5"
                                placeholder="Optional"
                                value={maxes[phaseKey(week.phase, item.name)] ?? ""}
                                onChange={(event) => updateMax(item.name, event.target.value)}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>

            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <h4 className="font-semibold">How progression works</h4>
              {selected === "volume_intensity" ? (
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    Within a base wave, volume sets increase while reps fall. The intensity exposure
                    is an AMRAP with 1–2 reps in reserve. Repeated waves add{" "}
                    {options.waveIncreasePercent}% of the phase’s estimated max to percentage
                    prescriptions.
                  </p>
                  <p>
                    Reassess your estimated max before the heavier base wave. In the peak, volume
                    falls across each wave; top sets stay at RPE 7. Choose those top-set loads by
                    effort rather than converting RPE into a fixed percentage.
                  </p>
                  <p>
                    Repeat the peak for at least three waves. If you choose to test a true max
                    afterwards, the source calls for a full deload week first.
                  </p>
                </div>
              ) : (
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    Only the final main-lift set is a plus set. Within a wave, each extra rep adds
                    1% of that lift’s estimated 1RM to the next working load. This is calculated
                    from the reference max, not from the working weight.
                  </p>
                  <p>
                    At the next wave, reset to its starting percentage and rep target. Variations
                    use their own estimated maxes and their own set progression. Accessory choices
                    follow a separate rule.
                  </p>
                </div>
              )}
            </div>

            {decision ? (
              <details className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Try the Bullmastiff plus-set rule
                </summary>
                <p className="mt-3 text-xs text-muted-foreground">
                  An example calculation for the selected week. These entries are not workout logs.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bs-example-lift">Main lift</Label>
                    <select
                      id="bs-example-lift"
                      className={selectClass}
                      value={exampleLift}
                      onChange={(event) => {
                        setExampleLift(event.target.value as typeof exampleLift);
                        clearExample();
                      }}
                    >
                      {Object.entries(BASE_STRENGTH_LIFTS).map(([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bs-working-load">Working load (kg)</Label>
                    <Input
                      id="bs-working-load"
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={workingLoad}
                      onChange={(event) => setWorkingLoad(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bs-plus-reps">Final-set reps</Label>
                    <Input
                      id="bs-plus-reps"
                      type="number"
                      min="0"
                      max="1000"
                      step="1"
                      value={plusReps}
                      onChange={(event) => setPlusReps(event.target.value)}
                    />
                  </div>
                </div>
                {week.phase === "base" && weeks[weekIndex + 1]?.phase === "peak" ? (
                  <div className="mt-3 max-w-sm space-y-1.5">
                    <Label htmlFor="bs-next-phase-max">
                      Reassessed peak-phase estimated 1RM (kg)
                    </Label>
                    <Input
                      id="bs-next-phase-max"
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={maxes[phaseKey("peak", exampleLift)] ?? ""}
                      onChange={(event) =>
                        setMaxes((previous) => ({
                          ...previous,
                          [phaseKey("peak", exampleLift)]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ) : null}
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allCompleted}
                    onChange={(event) => setAllCompleted(event.target.checked)}
                  />
                  All prescribed working sets completed
                </label>
                <div className="mt-3 rounded-lg bg-muted/40 p-3" role="status">
                  <p className="text-sm font-semibold">
                    {decision.load != null
                      ? `Next working load: ${decision.load} kg`
                      : decision.kind === "finish"
                        ? "Run complete"
                        : "Review needed"}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {decision.detail}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    setWeekIndex(0);
                    setExampleLift("squat");
                    setIncrement("2.5");
                    setMaxes((previous) => ({ ...previous, "base:squat": "100" }));
                    setWorkingLoad("70");
                    setPlusReps("11");
                    setAllCompleted(true);
                  }}
                >
                  Try a 100 kg example
                </Button>
              </details>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
              <p>Preview only · personal setup and activation follow a final review.</p>
              <a
                href={BASE_STRENGTH_SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 underline underline-offset-4"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Base Strength · Alex Bromley · pp. {programme.pages}
              </a>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
