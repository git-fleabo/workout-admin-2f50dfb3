import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Award, Dumbbell, Trophy } from "lucide-react";

import { FullWorkoutForm, WorkoutForm } from "./-workout-form";
import { OneRMForm } from "./-onerm-form";
import { PRsView } from "./-prs-view";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "Log Training · Training Admin" },
      {
        name: "description",
        content: "Log workouts, calisthenics, grip, climbing and strength tests.",
      },
    ],
  }),
  component: LogPage,
});

type Mode = "log" | "onerm" | "prs";
type WorkoutMode = "single" | "session";

function LogPage() {
  const [mode, setMode] = useState<Mode>("log");
  const [workoutMode, setWorkoutMode] = useState<WorkoutMode>("single");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Log Training</h1>
          <p className="text-sm text-muted-foreground">
            Add sessions directly to your training database.
          </p>
        </div>
      </header>

      <ModeSwitch mode={mode} onChange={setMode} />

      <div className="mx-auto max-w-xl space-y-4">
        {mode === "log" && (
          <>
            <WorkoutModeSwitch mode={workoutMode} onChange={setWorkoutMode} />
            {workoutMode === "single" ? (
              <WorkoutForm key="log-single" title="New workout, climb, or skill" />
            ) : (
              <FullWorkoutForm key="log-session" />
            )}
          </>
        )}
        {mode === "onerm" && <OneRMForm />}
        {mode === "prs" && <PRsView />}
      </div>
    </div>
  );
}

function WorkoutModeSwitch({
  mode,
  onChange,
}: {
  mode: WorkoutMode;
  onChange: (m: WorkoutMode) => void;
}) {
  const tabs: { id: WorkoutMode; label: string }[] = [
    { id: "single", label: "Single movement" },
    { id: "session", label: "Full workout" },
  ];

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary/40 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm ${
            mode === tab.id
              ? "bg-card text-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: { id: Mode; label: string; icon: React.ReactNode; color: string }[] = [
    {
      id: "log",
      label: "Log",
      icon: <Dumbbell className="h-4 w-4" />,
      color: "oklch(0.72 0.14 220)",
    },
    {
      id: "onerm",
      label: "1RM",
      icon: <Trophy className="h-4 w-4" />,
      color: "oklch(0.72 0.14 25)",
    },
    { id: "prs", label: "PRs", icon: <Award className="h-4 w-4" />, color: "oklch(0.72 0.14 300)" },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-secondary/40 p-1">
      {tabs.map((t) => {
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm ${
              active
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              active
                ? { boxShadow: "0 0 0 1px var(--color-border)", color: t.color }
                : { color: t.color, opacity: 0.55 }
            }
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
