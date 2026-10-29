import { useState, useId, cloneElement, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLibraryClient } from "@/lib/supabase-log.browser";
import {
  blankExercise,
  blankTemplate,
  recoveryRoutineSchema,
  WEEKDAYS,
  type RecoveryRoutineInput,
  type RecoveryTemplate,
  type RecoveryExercise,
} from "@/lib/recovery";

const selectClass = "w-full min-w-0 rounded-md border border-input bg-background p-2 text-sm";
export function RecoveryField({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1 text-sm">
      <label htmlFor={id} className="block">
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}
export function RecoveryEditor({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: RecoveryRoutineInput;
  saving: boolean;
  onSave: (routine: RecoveryRoutineInput) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RecoveryRoutineInput>(() => structuredClone(initial));
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const library = useQuery({
    queryKey: ["library"],
    queryFn: getLibraryClient,
    staleTime: 300_000,
  });
  function template(index: number, patch: Partial<RecoveryTemplate>) {
    setDraft({
      ...draft,
      templates: draft.templates.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    });
  }
  function exercise(ti: number, ei: number, patch: Partial<RecoveryExercise>) {
    template(ti, {
      exercises: draft.templates[ti].exercises.map((e, i) => (i === ei ? { ...e, ...patch } : e)),
    });
  }
  function review() {
    const parsed = recoveryRoutineSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join(" · ")}: ${i.message}`).join("; "));
      return;
    }
    setError("");
    setPreview(true);
  }
  return (
    <section
      className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6"
      aria-label="Routine editor"
    >
      <h2 className="text-xl font-semibold">{preview ? "Review routine" : "Routine setup"}</h2>
      {preview ? (
        <>
          <p>
            <strong>{draft.name}</strong> · {draft.purpose || "No purpose label"} · {draft.status}
          </p>
          {draft.templates.map((t) => (
            <div key={t.id} className="space-y-2 rounded-lg border p-3">
              <h3 className="font-semibold">
                {t.name} · {t.mode === "quick" ? "Quick practice" : "Measured session"}
              </h3>
              <p className="text-sm">
                {t.weekdays.length
                  ? t.weekdays.map((d) => WEEKDAYS[d]).join(", ")
                  : "Manual / unscheduled"}{" "}
                · about {t.minutes} min
              </p>
              <ol className="list-inside list-decimal space-y-1 text-sm">
                {t.exercises.map((e) => (
                  <li key={e.id}>
                    {e.name} · {e.sets} sets{e.reps && ` · ${e.reps} reps`}
                    {e.weight !== null && ` · ${e.weight} kg (${e.load.replace("_", " ")})`}
                    {e.hold !== null && ` · ${e.hold}s`}
                    {e.side !== "none" && ` · ${e.side}`}
                    <p className="whitespace-pre-wrap text-muted-foreground">{e.setup}</p>
                  </li>
                ))}
              </ol>
              {t.progression && (
                <p className="whitespace-pre-wrap text-sm">
                  Progression instructions: {t.progression}
                </p>
              )}
            </div>
          ))}
          <p className="text-sm text-muted-foreground">
            These targets apply to future sessions. Completed results and unfinished session targets
            stay unchanged.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={saving} onClick={() => onSave(draft)}>
              {saving ? "Saving…" : "Apply and save routine"}
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => setPreview(false)}>
              Keep editing
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <RecoveryField label="Routine name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Left shoulder"
              />
            </RecoveryField>
            <RecoveryField label="Purpose (optional)">
              <select
                className={selectClass}
                value={draft.purpose}
                onChange={(e) =>
                  setDraft({ ...draft, purpose: e.target.value as RecoveryRoutineInput["purpose"] })
                }
              >
                {["", "Mobility", "Prehab", "Rehab"].map((p) => (
                  <option key={p} value={p}>
                    {p || "No label"}
                  </option>
                ))}
              </select>
            </RecoveryField>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Routine details and status
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <RecoveryField label="Body area (optional)">
                <Input
                  value={draft.area}
                  onChange={(e) => setDraft({ ...draft, area: e.target.value })}
                />
              </RecoveryField>
              <RecoveryField label="Routine status">
                <select
                  className={selectClass}
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as RecoveryRoutineInput["status"] })
                  }
                >
                  {["active", "maintenance", "paused", "archived"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </RecoveryField>
              <RecoveryField label="Routine notes">
                <textarea
                  className={selectClass}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </RecoveryField>
            </div>
          </details>
          {draft.templates.map((t, ti) => (
            <fieldset key={t.id} className="min-w-0 space-y-4 rounded-lg border p-3 sm:p-4">
              <legend className="px-1 font-semibold">Session {ti + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <RecoveryField label="Session name">
                  <Input value={t.name} onChange={(e) => template(ti, { name: e.target.value })} />
                </RecoveryField>
                <RecoveryField label="Logging style">
                  <select
                    className={selectClass}
                    value={t.mode}
                    onChange={(e) =>
                      template(ti, { mode: e.target.value as RecoveryTemplate["mode"] })
                    }
                  >
                    <option value="quick">Quick practice</option>
                    <option value="measured">Measured session</option>
                  </select>
                </RecoveryField>
                <RecoveryField label="Approximate minutes">
                  <Input
                    type="number"
                    min="1"
                    max="300"
                    value={t.minutes}
                    onChange={(e) => template(ti, { minutes: Number(e.target.value) })}
                  />
                </RecoveryField>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm">Schedule · leave all unchecked for manual</legend>
                <div className="flex flex-wrap gap-3">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={t.weekdays.includes(d)}
                        onChange={(e) =>
                          template(ti, {
                            weekdays: e.target.checked
                              ? [...t.weekdays, d]
                              : t.weekdays.filter((v) => v !== d),
                          })
                        }
                      />
                      {WEEKDAYS[d]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {t.exercises.map((e, ei) => (
                <div key={e.id} className="min-w-0 space-y-3 rounded-lg bg-muted/35 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <RecoveryField label={`Exercise ${ei + 1}`}>
                      <Input
                        value={e.name}
                        onChange={(ev) => exercise(ti, ei, { name: ev.target.value })}
                        placeholder="Name a movement or choose from the library"
                      />
                    </RecoveryField>
                    <RecoveryField label="Exercise library (optional)">
                      <select
                        className={selectClass}
                        value={e.exerciseId ?? ""}
                        onChange={(ev) => {
                          const found = library.data?.exercises.find(
                            (x) => x.id === ev.target.value,
                          );
                          exercise(ti, ei, {
                            exerciseId: found?.id ?? null,
                            ...(found ? { name: found.name } : {}),
                          });
                        }}
                      >
                        <option value="">Custom movement</option>
                        {library.data?.exercises.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                    </RecoveryField>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <RecoveryField label="Target sets">
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={e.sets}
                        onChange={(ev) => exercise(ti, ei, { sets: Number(ev.target.value) })}
                      />
                    </RecoveryField>
                    <RecoveryField label="Target reps / guidance">
                      <Input
                        value={e.reps}
                        onChange={(ev) => exercise(ti, ei, { reps: ev.target.value })}
                      />
                    </RecoveryField>
                    <RecoveryField label="Target kg">
                      <Input
                        type="number"
                        min="0"
                        step="1.25"
                        value={e.weight ?? ""}
                        onChange={(ev) =>
                          exercise(ti, ei, {
                            weight: ev.target.value === "" ? null : Number(ev.target.value),
                          })
                        }
                      />
                    </RecoveryField>
                    <RecoveryField label="Target hold seconds">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={e.hold ?? ""}
                        onChange={(ev) =>
                          exercise(ti, ei, {
                            hold: ev.target.value === "" ? null : Number(ev.target.value),
                          })
                        }
                      />
                    </RecoveryField>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Side, load meaning, setup and source
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <RecoveryField label="Side">
                        <select
                          className={selectClass}
                          value={e.side}
                          onChange={(ev) =>
                            exercise(ti, ei, { side: ev.target.value as RecoveryExercise["side"] })
                          }
                        >
                          {[
                            ["none", "Not side-specific"],
                            ["left", "Left"],
                            ["right", "Right"],
                            ["each", "Each side separately"],
                          ].map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </RecoveryField>
                      <RecoveryField label="Weight means">
                        <select
                          className={selectClass}
                          value={e.load}
                          onChange={(ev) =>
                            exercise(ti, ei, { load: ev.target.value as RecoveryExercise["load"] })
                          }
                        >
                          {[
                            ["total", "Total load"],
                            ["per_hand", "Weight per hand"],
                            ["bodyweight", "Bodyweight / added load"],
                            ["unloaded", "Unloaded"],
                          ].map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </RecoveryField>
                      <RecoveryField label="Range, tempo, rest and setup targets">
                        <textarea
                          className={selectClass}
                          value={e.setup}
                          onChange={(ev) => exercise(ti, ei, { setup: ev.target.value })}
                        />
                      </RecoveryField>
                      <RecoveryField label="Source link (optional)">
                        <Input
                          type="url"
                          value={e.source}
                          onChange={(ev) => exercise(ti, ei, { source: ev.target.value })}
                        />
                      </RecoveryField>
                    </div>
                  </details>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={ei === 0}
                      aria-label={`Move ${e.name || "exercise"} up`}
                      onClick={() => {
                        const ordered = [...t.exercises];
                        [ordered[ei - 1], ordered[ei]] = [ordered[ei], ordered[ei - 1]];
                        template(ti, { exercises: ordered });
                      }}
                    >
                      Move up
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={t.exercises.length === 1}
                      onClick={() =>
                        template(ti, { exercises: t.exercises.filter((_, i) => i !== ei) })
                      }
                    >
                      Remove exercise
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                disabled={t.exercises.length >= 40}
                onClick={() => template(ti, { exercises: [...t.exercises, blankExercise()] })}
              >
                Add exercise
              </Button>
              <details>
                <summary className="cursor-pointer text-sm">
                  Notes, progression and next-morning check
                </summary>
                <div className="mt-3 space-y-3">
                  <RecoveryField label="Session notes">
                    <textarea
                      className={selectClass}
                      value={t.notes}
                      onChange={(e) => template(ti, { notes: e.target.value })}
                    />
                  </RecoveryField>
                  <RecoveryField label="Editable progression instructions">
                    <textarea
                      className={selectClass}
                      value={t.progression}
                      onChange={(e) => template(ti, { progression: e.target.value })}
                      placeholder="Your own criteria; targets change only when you edit and apply them."
                    />
                  </RecoveryField>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={t.nextMorning}
                      onChange={(e) => template(ti, { nextMorning: e.target.checked })}
                    />
                    Offer a next-morning check here
                  </label>
                </div>
              </details>
              {draft.templates.length > 1 && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    setDraft({ ...draft, templates: draft.templates.filter((_, i) => i !== ti) })
                  }
                >
                  Remove this template
                </Button>
              )}
            </fieldset>
          ))}
          {library.error && (
            <p className="text-sm text-muted-foreground">
              The library could not be loaded. You can still enter custom movements.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={review}>Review routine</Button>
            <Button
              variant="outline"
              disabled={draft.templates.length >= 12}
              onClick={() =>
                setDraft({ ...draft, templates: [...draft.templates, blankTemplate()] })
              }
            >
              Add session template
            </Button>
          </div>
        </>
      )}
      <Button variant="ghost" disabled={saving} onClick={onCancel}>
        Cancel editing
      </Button>
    </section>
  );
}
