import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Dumbbell, Mountain, Trophy } from "lucide-react";

import { ClimbForm, FullWorkoutForm } from "@/components/workout-logger/full-workout-form";
import { OneRMForm } from "@/components/workout-logger/onerm-form";
import { readWorkoutPlanDraft, WORKOUT_PLAN_DRAFT_KEY } from "@/lib/workout-plan";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "Log Training · Train & Track" },
      {
        name: "description",
        content: "Log workouts, calisthenics, grip, climbing and strength tests.",
      },
    ],
  }),
  component: LogPage,
});

type Mode = "log" | "climb" | "onerm";

function initialMode(): Mode {
  if (typeof window === "undefined") return "log";
  const plan = readWorkoutPlanDraft(window.localStorage.getItem(WORKOUT_PLAN_DRAFT_KEY));
  return plan?.movements.length === 1 && plan.movements[0]?.trackingMode === "climbing"
    ? "climb"
    : "log";
}

function LogPage() {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 pb-1">
        <h1 className="page-title">Log Training</h1>
      </header>

      <ModeSwitch mode={mode} onChange={setMode} />

      <div className="mx-auto max-w-3xl space-y-4">
        {mode === "log" && <FullWorkoutForm key="log-session" />}
        {mode === "climb" && <ClimbForm />}
        {mode === "onerm" && <OneRMForm />}
      </div>
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    {
      id: "log",
      label: "Workout",
      icon: <Dumbbell className="h-4 w-4" />,
    },
    {
      id: "climb",
      label: "Climb",
      icon: <Mountain className="h-4 w-4" />,
    },
    {
      id: "onerm",
      label: "1RM",
      icon: <Trophy className="h-4 w-4" />,
    },
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
            className={`flex items-center justify-center gap-1.5 min-h-11 rounded-lg px-2 py-2 text-sm font-medium transition ${
              active
                ? "bg-card text-primary shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
