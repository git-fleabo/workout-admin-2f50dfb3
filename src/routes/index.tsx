import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Award, Dumbbell, Mountain, Sparkles, Trophy } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { PasswordGate } from "@/components/password-gate";
import { WorkoutForm } from "./-workout-form";
import { SkillForm } from "./-skill-form";
import { ClimbingForm } from "./-climbing-form";
import { OneRMForm } from "./-onerm-form";
import { PRsView } from "./-prs-view";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Training Log" },
      {
        name: "description",
        content: "Mobile-first logger for workouts, calisthenics, and climbing sessions, synced to your training spreadsheet.",
      },
    ],
  }),
  component: Index,
});

type Mode = "workout" | "skill" | "climb" | "onerm" | "prs";

function Index() {
  const [mode, setMode] = useState<Mode>("workout");

  return (
    <PasswordGate>
      <div className="min-h-screen bg-background text-foreground">
        <Toaster richColors position="top-center" />
        <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-4">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              <Dumbbell className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold leading-none">Training Log</h1>
              <p className="text-xs text-muted-foreground">Streaming to your sheet</p>
            </div>
          </div>
          <div className="mx-auto max-w-xl px-4 pb-3">
            <ModeSwitch mode={mode} onChange={setMode} />
          </div>
        </header>

        <main className="mx-auto max-w-xl px-4 pb-24 pt-6">
          {mode === "workout" && <WorkoutForm />}
          {mode === "skill" && <SkillForm />}
          {mode === "climb" && <ClimbingForm />}
          {mode === "onerm" && <OneRMForm />}
          {mode === "prs" && <PRsView />}
        </main>
      </div>
    </PasswordGate>
  );
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: "workout", label: "Workout", icon: <Dumbbell className="h-4 w-4" /> },
    { id: "skill", label: "Skills", icon: <Sparkles className="h-4 w-4" /> },
    { id: "climb", label: "Climb", icon: <Mountain className="h-4 w-4" /> },
    { id: "onerm", label: "1RM", icon: <Trophy className="h-4 w-4" /> },
    { id: "prs", label: "PRs", icon: <Award className="h-4 w-4" /> },
  ];
  return (
    <div className="grid grid-cols-5 gap-1 rounded-xl border border-border bg-secondary/40 p-1">
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
                ? { boxShadow: "0 0 0 1px var(--color-border)" }
                : undefined
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
