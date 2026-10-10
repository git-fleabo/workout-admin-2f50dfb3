import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BaseStrengthSetup } from "@/components/base-strength-setup";
import { BaseStrengthProgression } from "@/components/base-strength-progression";
import { DEFAULT_VOLUME_INTENSITY_OPTIONS } from "@/lib/base-strength-preview";
import { buildBaseStrengthPersonalSessions } from "@/lib/base-strength-personal";
import { strengthChoices, strengthTemplate, strengthId } from "../helpers/base-strength-fixtures";

const { rpc, library, templates } = vi.hoisted(() => ({
  rpc: vi.fn(),
  library: vi.fn(),
  templates: vi.fn(),
}));
vi.mock("@/lib/supabase-public", () => ({ supabasePublicRpc: rpc }));
vi.mock("@/lib/supabase-library.browser", () => ({ listLibraryClient: library }));
vi.mock("@/lib/supabase-programmes.browser", () => ({ listProgrammeTemplatesClient: templates }));
const client = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={client()}>{ui}</QueryClientProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  const choices = strengthChoices("volume_intensity");
  library.mockResolvedValue({
    selectedPersonId: strengthId(1),
    items: [
      ...Object.values(choices).map((c) => ({
        id: c.exerciseId,
        name: c.exerciseName,
        metric: c.trackingMode === "weight_reps" ? "Weight & Reps" : "Reps",
        workoutType: "Strength",
        active: true,
        enabled: true,
      })),
      {
        id: strengthId(70),
        name: "Kettlebell Swing",
        metric: "weight_reps",
        workoutType: "Conditioning",
        active: true,
        enabled: true,
      },
      {
        id: strengthId(71),
        name: "Disabled swing",
        metric: "weight_reps",
        workoutType: "Conditioning",
        active: true,
        enabled: false,
      },
      {
        id: strengthId(72),
        name: "Inactive swing",
        metric: "weight_reps",
        workoutType: "Conditioning",
        active: false,
        enabled: true,
      },
      {
        id: strengthId(73),
        name: "Run",
        metric: "distance_time",
        workoutType: "Cardio",
        active: true,
        enabled: true,
      },
    ],
  });
  templates.mockResolvedValue([strengthTemplate("volume_intensity")]);
  rpc.mockResolvedValue(strengthId(9));
});

describe("Base Strength personal setup and progression", () => {
  it("saves a complete personal version paused through the existing create RPC, without activating it", async () => {
    const user = userEvent.setup();
    wrap(
      <BaseStrengthSetup
        programme="volume_intensity"
        options={DEFAULT_VOLUME_INTENSITY_OPTIONS}
        onClose={vi.fn()}
      />,
    );
    await screen.findByRole("button", { name: "Save for review" });
    for (const lift of ["Squat", "Bench press", "Deadlift", "Overhead press"])
      await user.type(screen.getByLabelText(`${lift} base estimated max (kg)`), "100");
    await user.click(screen.getByText("Supporting exercises and personal targets"));
    for (const name of ["Row", "Chin-ups"]) {
      await user.type(screen.getByLabelText(`${name} sets`), "3");
      await user.type(screen.getByLabelText(`${name} reps`), "8");
      if (name === "Row") await user.type(screen.getByLabelText(`${name} load`), "20");
    }
    const accessory = screen.getByRole("combobox", { name: "Row" });
    expect(screen.queryByRole("option", { name: "Disabled swing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Inactive swing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Run" })).not.toBeInTheDocument();
    await user.selectOptions(accessory, strengthId(70));
    await user.click(screen.getByRole("button", { name: "Save for review" }));
    await screen.findByText("Saved for review");
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, input] = rpc.mock.calls[0];
    expect(name).toBe("create_personal_programme");
    expect(input.p_sessions).toHaveLength(54);
    expect(input.p_sessions[0].plan.movements[0].setRows[0].weight).toBe("55");
    expect(input.p_sessions[0].plan.movements[2]).toMatchObject({
      exerciseId: strengthId(70),
      exercise: "Kettlebell Swing",
      workoutType: "Strength",
      trackingMode: "weight_reps",
    });
    expect(input.p_sessions[0].plan.movements[2].setRows[0]).toMatchObject({
      weight: "20",
      reps: "8",
    });
    expect(input.p_sessions[27].plan.movements[0].baseStrength.referenceMax).toBeNull();
    expect(
      screen.queryByRole("button", { name: /activate|start programme/i }),
    ).not.toBeInTheDocument();
  });
  it("keeps a setup failure visible and never reports it saved", async () => {
    templates.mockResolvedValue([]);
    const user = userEvent.setup();
    wrap(
      <BaseStrengthSetup
        programme="volume_intensity"
        options={DEFAULT_VOLUME_INTENSITY_OPTIONS}
        onClose={vi.fn()}
      />,
    );
    await screen.findByRole("button", { name: "Save for review" });
    await user.click(screen.getByRole("button", { name: "Save for review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("waiting for the database update");
    expect(rpc).not.toHaveBeenCalled();
    expect(screen.queryByText("Saved for review")).not.toBeInTheDocument();
  });
  it("shows linked evidence first and applies the displayed fingerprint only after a separate click", async () => {
    const template = strengthTemplate("bullmastiff");
    const sessions = buildBaseStrengthPersonalSessions({
      programme: "bullmastiff",
      options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
      template,
      choices: strengthChoices("bullmastiff"),
      startedOn: "2026-10-12",
      increment: 2.5,
      locationKind: "gym",
    });
    const session = { ...sessions[4], revision: 1 };
    const proposal = {
      kind: "increase",
      load: 75,
      detail: "5 extra reps × 1% of 100 kg.",
      fingerprint: "a".repeat(32),
      revision: 1,
      previousReps: 11,
      previousLoad: 70,
    };
    rpc.mockImplementation(async (name) =>
      name === "review_base_strength_progression" ? proposal : 2,
    );
    const user = userEvent.setup();
    wrap(<BaseStrengthProgression assignmentId={strengthId(2)} session={session} />);
    expect(rpc).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Review completed plus set" }));
    await screen.findByText("Next working load: 75 kg");
    expect(screen.getByText(/final set 11 reps at 70 kg/)).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Apply to this session" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        "apply_base_strength_progression",
        expect.objectContaining({
          p_revision: 1,
          p_fingerprint: proposal.fingerprint,
          p_workout_id: session.workoutId,
        }),
      ),
    );
    expect(await screen.findByText("Load applied to this future session.")).toBeInTheDocument();
  });
});
