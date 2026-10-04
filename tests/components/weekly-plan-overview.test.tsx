import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import type { ProgrammeScheduleSession } from "@/lib/supabase-programmes.browser";
import type { SavedWorkoutPlan } from "@/lib/supabase-plans.browser";
import type { WeeklyPlan } from "@/lib/weekly-plan";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { WeeklyPlanOverview } from "@/components/weekly-plan-overview";

const plan: WeeklyPlan = {
  startDate: "2026-09-28",
  endDate: "2026-10-04",
  days: [
    {
      date: "2026-09-28",
      expected: [],
      completed: [],
      inferredItems: ["gym"],
      completedItems: [],
    },
  ],
  locations: {
    home: {
      location: "home",
      frequency: 0,
      confidence: "none",
      sourceDays: 0,
      expectedDates: [],
      suggestion: null,
      progressionExercises: [],
      fatigueExercises: [],
    },
    gym: {
      location: "gym",
      frequency: 0,
      confidence: "none",
      sourceDays: 0,
      expectedDates: [],
      suggestion: null,
      progressionExercises: [],
      fatigueExercises: [],
    },
  },
  loadPatterns: [],
};

const currentSession: ProgrammeScheduleSession = {
  assignmentId: "assignment-1",
  programWorkoutId: "workout-1",
  programmeName: "Base Strength",
  workoutName: "Session A",
  date: "2026-09-28",
  scheduledDate: "2026-09-26",
  isCatchUp: true,
  weekNumber: 1,
  sessionNumber: 1,
  workoutNumber: 1,
  movementNames: ["Bench Press"],
  movements: [],
  selectionNotes: [],
  status: "current",
};

it("puts the next session first and keeps the calendar optional", async () => {
  render(
    <WeeklyPlanOverview
      plan={plan}
      programmeSessions={[currentSession]}
      adjustments={{}}
      onAdjustDay={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: /Next programme session/ })).toHaveTextContent(
    "Base Strength · Session A",
  );
  const disclosure = screen.getByText("Show suggested dates and other training").closest("details");
  expect(disclosure).not.toHaveAttribute("open");

  await userEvent.click(screen.getByText("Show suggested dates and other training"));
  expect(disclosure).toHaveAttribute("open");
  expect(screen.getByText("Bench Press")).toBeVisible();
});

it("shows programme rest once without repeating it as guidance", async () => {
  render(
    <WeeklyPlanOverview
      plan={plan}
      programmeSessions={[
        {
          ...currentSession,
          movementNames: ["Dumbbell Bench Press"],
          movements: [
            {
              exercise: "Dumbbell Bench Press",
              workoutType: "Strength",
              trackingMode: "weight_reps",
              targets: {
                durationMinutes: "",
                distance: "",
                distanceUnit: "",
                rounds: "",
                height: "",
                detail: "",
              },
              sourceDate: "",
              reason: "Rest 60–90 seconds between sets.",
              restTime: "60–90 seconds",
              setRows: [
                {
                  reps: "",
                  weight: "",
                  durationSeconds: "",
                  rpe: "",
                  completed: true,
                },
              ],
            },
          ],
        },
      ]}
      adjustments={{}}
      onAdjustDay={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /Next programme session/ }));

  expect(screen.getByText("Rest 60–90 seconds")).toBeVisible();
  expect(screen.queryByText("Rest 60–90 seconds between sets.")).not.toBeInTheDocument();
});

it("shows a dated saved session and can launch it from the week", async () => {
  const start = vi.fn();
  const scheduledPlan = {
    version: 1,
    suggestedWorkoutId: "saved-1",
    title: "Yoga practice",
    locationKind: "home",
    basis: "Planned from the week",
    status: "pending",
    readiness: "normal",
    createdAt: "2026-09-27T12:00:00Z",
    programAssignmentId: null,
    programWorkoutId: null,
    suggestedFor: "2026-09-28",
    planKind: "yoga",
    movements: [
      {
        exercise: "Yoga Flow",
        workoutType: "Yoga",
        trackingMode: "duration",
        targets: {
          durationMinutes: "30",
          distance: "",
          distanceUnit: "",
          rounds: "",
          height: "",
          detail: "",
        },
        sourceDate: "",
        reason: "Scheduled",
        setRows: [{ reps: "", weight: "", durationSeconds: "", rpe: "", completed: true }],
      },
    ],
  } as SavedWorkoutPlan;

  render(
    <WeeklyPlanOverview
      plan={plan}
      programmeSessions={[]}
      adjustments={{}}
      scheduledPlans={[scheduledPlan]}
      onAdjustDay={vi.fn()}
      onStartScheduledPlan={start}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /yoga\s*yoga practice/i }));
  await userEvent.click(screen.getByRole("button", { name: "Start session" }));
  expect(start).toHaveBeenCalledWith(scheduledPlan);
});

it("adds a yoga session to the selected day with an executable prescription", async () => {
  const scheduleYoga = vi.fn();
  render(
    <WeeklyPlanOverview
      plan={plan}
      programmeSessions={[]}
      adjustments={{}}
      onAdjustDay={vi.fn()}
      onScheduleYoga={scheduleYoga}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Adjust day" }));
  await userEvent.click(screen.getByRole("button", { name: "Plan yoga" }));

  expect(scheduleYoga).toHaveBeenCalledWith("2026-09-28", "home", 30);
});
