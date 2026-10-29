import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecoveryEditor } from "@/components/recovery-editor";
import { RecoveryLogger } from "@/components/recovery-logger";
import { blankRoutine, recoveryDraftKey, type RecoverySession } from "@/lib/recovery";
import { saveRecoverySessionClient } from "@/lib/supabase-recovery.browser";
vi.mock("@/lib/supabase-log.browser", () => ({
  getLibraryClient: vi.fn(async () => ({ exercises: [{ id: "db", name: "Dumbbell rotation" }] })),
}));
vi.mock("@/lib/supabase-recovery.browser", () => ({ saveRecoverySessionClient: vi.fn() }));
const renderWithQuery = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );
function fixture(mode: "quick" | "measured" = "quick"): RecoverySession {
  const r = blankRoutine();
  r.name = "Left shoulder";
  const t = r.templates[0];
  t.mode = mode;
  t.exercises[0].name = "Rotation";
  t.exercises[0].weight = 1.25;
  t.exercises[0].load = "per_hand";
  t.exercises[0].side = "each";
  return {
    id: "s",
    person_id: "owner",
    routine_id: "r",
    legacy_run_id: null,
    template_id: t.id,
    routine_name: r.name,
    session_date: "2026-10-28",
    status: "draft",
    snapshot: t,
    actuals: [],
    pain: null,
    notes: "",
    response: null,
    response_notes: "",
    check_enabled: false,
    version: 1,
    completed_at: null,
    suggested_workout_id: null,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
describe("recovery editor and logger", () => {
  it("creates two templates and requires explicit review/apply", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithQuery(
      <RecoveryEditor initial={blankRoutine()} saving={false} onSave={onSave} onCancel={vi.fn()} />,
    );
    await user.type(screen.getByLabelText("Routine name"), "Left shoulder");
    await user.type(screen.getByLabelText("Exercise 1"), "Easy raise");
    await user.click(screen.getByRole("button", { name: "Add session template" }));
    const names = screen.getAllByLabelText("Session name");
    await user.clear(names[1]);
    await user.type(names[1], "Strengthening");
    await user.selectOptions(screen.getAllByLabelText("Logging style")[1], "measured");
    await user.selectOptions(screen.getAllByLabelText("Exercise library (optional)")[1], "db");
    await user.click(screen.getAllByLabelText("Mon")[1]);
    await user.click(screen.getAllByLabelText("Fri")[1]);
    await user.type(screen.getAllByLabelText("Target kg")[1], "1.25");
    await user.click(screen.getByRole("button", { name: "Review routine" }));
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Apply and save routine" }));
    expect(onSave.mock.calls[0][0].templates[1]).toMatchObject({
      name: "Strengthening",
      mode: "measured",
      weekdays: [1, 5],
      exercises: [expect.objectContaining({ exerciseId: "db", weight: 1.25 })],
    });
  });
  it("quick completion submits no sets and preserves unknown symptoms without touching a lifting draft", async () => {
    const session = fixture();
    localStorage.setItem("workout-session-draft", "lifting");
    vi.mocked(saveRecoverySessionClient).mockResolvedValue({ ...session, status: "completed" });
    renderWithQuery(<RecoveryLogger session={session} history={[]} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Complete practice" }));
    expect(saveRecoverySessionClient).toHaveBeenCalledWith(
      session,
      { actuals: [], pain: null, notes: "", check_enabled: false },
      "completed",
    );
    expect(localStorage.getItem("workout-session-draft")).toBe("lifting");
    await waitFor(() => expect(localStorage.getItem(recoveryDraftKey(session))).toBeNull());
  });
  it("measured logger resumes local results, shows previous actuals, and leaves other sides unknown", async () => {
    const user = userEvent.setup();
    const session = fixture("measured");
    const e = session.snapshot.exercises[0];
    const prior = {
      ...session,
      id: "previous",
      status: "completed" as const,
      session_date: "2026-10-25",
      actuals: [
        {
          exerciseId: e.id,
          side: "left" as const,
          set: 1,
          reps: 12,
          weight: 1.25,
          hold: null,
          range: "70°",
          technique: "Controlled",
        },
      ],
    };
    const mounted = renderWithQuery(
      <RecoveryLogger session={session} history={[prior]} onSaved={vi.fn()} />,
    );
    expect(screen.getByText(/left · set 1 · 12 reps · 1.25 kg\/hand/)).toBeInTheDocument();
    const input = screen.getByRole("spinbutton", { name: "Rotation left set 1 Reps" });
    expect(input).toHaveValue(null);
    await user.type(input, "14");
    mounted.unmount();
    renderWithQuery(<RecoveryLogger session={session} history={[prior]} onSaved={vi.fn()} />);
    expect(screen.getByRole("spinbutton", { name: "Rotation left set 1 Reps" })).toHaveValue(14);
    expect(screen.getByRole("spinbutton", { name: "Rotation right set 1 Reps" })).toHaveValue(null);
    vi.mocked(saveRecoverySessionClient).mockResolvedValue({ ...session, version: 2 });
    await user.click(screen.getByRole("button", { name: "Save and close" }));
    expect(saveRecoverySessionClient).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        actuals: expect.arrayContaining([
          expect.objectContaining({ side: "left", reps: 14, weight: null }),
          expect.objectContaining({ side: "right", reps: null }),
        ]),
      }),
      "draft",
    );
  });
  it("failed saves retain input and cancellation requires an explicit discard", async () => {
    const session = fixture();
    vi.mocked(saveRecoverySessionClient).mockRejectedValue(new Error("Offline; retry"));
    renderWithQuery(<RecoveryLogger session={session} history={[]} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Complete practice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline; retry");
    expect(localStorage.getItem(recoveryDraftKey(session))).not.toBeNull();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.click(screen.getByRole("button", { name: "Cancel session" }));
    expect(saveRecoverySessionClient).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });
});
