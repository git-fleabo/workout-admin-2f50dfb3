import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProgrammeSessionEditor } from "@/components/personal-programme-editor";
import { FIXED_PROGRESSION } from "@/lib/programme-progression";
import type { PersonalProgrammeSession } from "@/lib/personal-programme";
import { personalPlanSchema } from "@/lib/personal-programme";

const exerciseId = "11111111-1111-4111-8111-111111111111";
const session: PersonalProgrammeSession = {
  workoutId: exerciseId,
  revision: 3,
  name: "Session A",
  scheduledDate: "2026-10-05",
  plan: {
    version: 1,
    locationKind: "gym",
    movements: [
      {
        exerciseId,
        programmeKey: "press:0",
        exercise: "Dumbbell Press",
        workoutType: "Strength",
        trackingMode: "weight_reps",
        sourceDate: "",
        reason: "",
        restTime: "2 min",
        targets: {
          durationMinutes: "",
          distance: "",
          distanceUnit: "",
          rounds: "",
          height: "",
          detail: "",
        },
        progression: { ...FIXED_PROGRESSION },
        setRows: [{ weight: "20", reps: "8", durationSeconds: "", rpe: "", completed: true }],
      },
    ],
  },
};
const later = {
  ...structuredClone(session),
  workoutId: "22222222-2222-4222-8222-222222222222",
  name: "Session B",
  scheduledDate: "2026-10-08",
};
const exercises = [
  {
    id: exerciseId,
    name: "Dumbbell Press",
    workoutType: "Strength",
    metric: "kg",
    availableLocationIds: [],
    favourite: false,
  },
] as unknown as Parameters<typeof ProgrammeSessionEditor>[0]["exercises"];

describe("programme session editing", () => {
  it("adds a conditioning swing and replaces a movement with calisthenics using valid programme targets", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => {});
    const swingId = "33333333-3333-4333-8333-333333333333";
    const pullupId = "44444444-4444-4444-8444-444444444444";
    const options = [
      ...exercises,
      {
        ...exercises[0],
        id: swingId,
        name: "Kettlebell Swing",
        workoutType: "Conditioning",
        metric: "weight_reps",
      },
      {
        ...exercises[0],
        id: pullupId,
        name: "Pull-up",
        workoutType: "Skills/Calisthenics",
        metric: "reps_only",
      },
      {
        ...exercises[0],
        id: "55555555-5555-4555-8555-555555555555",
        name: "Run",
        workoutType: "Cardio",
        metric: "distance_time",
      },
    ];
    render(
      <ProgrammeSessionEditor
        session={session}
        laterSessions={[]}
        exercises={options}
        saving={false}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("option", { name: "Run" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Add an exercise"), "swing");
    await user.selectOptions(screen.getByLabelText("New programme exercise"), swingId);
    await user.click(screen.getByRole("button", { name: "Add", exact: true }));
    await user.type(screen.getByLabelText("Kettlebell Swing set 1 load"), "16");
    await user.type(screen.getByLabelText("Kettlebell Swing set 1 reps"), "15");
    await user.selectOptions(screen.getByLabelText("Exercise 1"), pullupId);
    await user.click(screen.getByRole("button", { name: "Save future session" }));
    expect(save).toHaveBeenCalledTimes(1);
    const [saved] = save.mock.calls[0][0] as PersonalProgrammeSession[];
    expect(() => personalPlanSchema.parse(saved.plan)).not.toThrow();
    expect(saved.plan.movements[0]).toMatchObject({
      exercise: "Pull-up",
      workoutType: "Strength",
      trackingMode: "reps_only",
    });
    expect(saved.plan.movements[1]).toMatchObject({
      exerciseId: swingId,
      exercise: "Kettlebell Swing",
      workoutType: "Strength",
      trackingMode: "weight_reps",
    });
    expect(saved.plan.movements[1].setRows[0]).toMatchObject({ weight: "16", reps: "15" });
    expect(options[1].workoutType).toBe("Conditioning");
    expect(session.plan.movements).toHaveLength(1);
  });
  it("edits original targets and explains cancellation of a temporary week", () => {
    const reviewedPlan = structuredClone(session.plan);
    reviewedPlan.movements[0].setRows[0].weight = "19";
    render(
      <ProgrammeSessionEditor
        session={{ ...session, reviewedPlan, strengthReviewId: "review" }}
        laterSessions={[]}
        exercises={exercises}
        saving={false}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Dumbbell Press set 1 load")).toHaveValue("20");
    expect(
      screen.getByText(/Saving an edit cancels this temporary strength-week review/),
    ).toBeInTheDocument();
  });
  it("saves date, set, rest and progression changes while leaving the original intact", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => {});
    render(
      <ProgrammeSessionEditor
        session={session}
        laterSessions={[]}
        exercises={exercises}
        saving={false}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    await user.clear(screen.getByLabelText("Dumbbell Press set 1 load"));
    await user.type(screen.getByLabelText("Dumbbell Press set 1 load"), "22");
    await user.clear(screen.getByLabelText("Dumbbell Press rest"));
    await user.type(screen.getByLabelText("Dumbbell Press rest"), "3 min");
    await user.selectOptions(screen.getByLabelText("Dumbbell Press progression"), "double");
    await user.click(screen.getByRole("button", { name: "Save future session" }));
    expect(save).toHaveBeenCalledTimes(1);
    const [saved] = save.mock.calls[0][0] as PersonalProgrammeSession[];
    expect(saved.revision).toBe(3);
    expect(saved.plan.movements[0].setRows[0].weight).toBe("22");
    expect(saved.plan.movements[0].restTime).toBe("3 min");
    expect(saved.plan.movements[0].progression.type).toBe("double");
    expect(session.plan.movements[0].setRows[0].weight).toBe("20");
  });
  it("makes later-session propagation explicit and shows its extent", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => {});
    render(
      <ProgrammeSessionEditor
        session={session}
        laterSessions={[later]}
        exercises={exercises}
        saving={false}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    await user.clear(screen.getByLabelText("Dumbbell Press set 1 reps"));
    await user.type(screen.getByLabelText("Dumbbell Press set 1 reps"), "10");
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByText(/1 later sessions will change: Session B/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save future session" }));
    expect(save.mock.calls[0][0]).toHaveLength(2);
    expect((save.mock.calls[0][0] as PersonalProgrammeSession[])[1].scheduledDate).toBe(
      "2026-10-08",
    );
  });
  it("keeps the editor open with a useful conflict message when saving fails", async () => {
    const user = userEvent.setup();
    render(
      <ProgrammeSessionEditor
        session={session}
        laterSessions={[]}
        exercises={exercises}
        saving={false}
        onSave={async () => {
          throw new Error("This programme changed elsewhere. Refresh before saving.");
        }}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save future session" }));
    expect(screen.getByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
