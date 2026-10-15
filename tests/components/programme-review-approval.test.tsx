import { beforeEach, expect, it, vi } from "vitest";
import {
  personalStrengthAssignment,
  personalStrengthTemplate,
  personalStrengthRecovery,
} from "../helpers/personal-strength-fixtures";
import { buildStrengthProgrammeReview } from "@/lib/strength-programme-review";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  latest: vi.fn(),
  personal: vi.fn(),
  native: vi.fn(),
}));
vi.mock("@/lib/supabase-programmes.browser", () => ({
  getActiveProgrammeRefreshContextClient: mocks.context,
}));
vi.mock("@/lib/supabase-programme-strength-review.browser", () => ({
  getLatestProgrammeStrengthWeekReviewClient: mocks.latest,
  applyPersonalStrengthWeekReviewClient: mocks.personal,
  applyProgrammeStrengthWeekReviewClient: mocks.native,
}));
import { applyReviewedProgrammeWeekClient } from "@/lib/programme-review-approval.browser";
const input = () => {
  const context = {
    assignment: structuredClone(personalStrengthAssignment),
    template: structuredClone(personalStrengthTemplate),
  };
  return {
    context,
    review: buildStrengthProgrammeReview({ ...context, recovery: personalStrengthRecovery })!,
    appliedReview: null,
    recoveryLevel: personalStrengthRecovery.level,
  };
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.latest.mockResolvedValue(null);
  mocks.personal.mockResolvedValue("approval");
  mocks.native.mockResolvedValue("approval");
});

it("routes the exact approved personal review after fresh reads", async () => {
  const approved = input();
  mocks.context.mockResolvedValue(structuredClone(approved.context));
  await applyReviewedProgrammeWeekClient(approved);
  expect(mocks.personal).toHaveBeenCalledWith(
    approved.context.assignment.id,
    approved.review,
    approved.recoveryLevel,
  );
  expect(mocks.native).not.toHaveBeenCalled();
});
it("preserves the native approval RPC payload", async () => {
  const approved = input();
  delete approved.context.assignment.personalProgramme;
  approved.review.isPersonal = false;
  mocks.context.mockResolvedValue(approved.context);
  await applyReviewedProgrammeWeekClient(approved);
  expect(mocks.native).toHaveBeenCalledWith(
    expect.objectContaining({
      assignmentId: approved.context.assignment.id,
      workoutIds: approved.review.sessions.map((item) => item.workoutId),
      adjustments: approved.review.exercises.map((item) => ({
        exerciseId: item.assignmentExerciseId,
        manualAdjustmentPercent: item.proposedManualAdjustmentPercent,
        combinedAdjustmentPercent: item.proposedCombinedAdjustmentPercent,
        setAdjustment: item.proposedSetAdjustment,
      })),
    }),
  );
  expect(mocks.personal).not.toHaveBeenCalled();
});
it.each(["programme ended", "programme advanced", "session edited", "another review applied"])(
  "refuses approval when %s after preview",
  async (change) => {
    const approved = input();
    const changed = structuredClone(approved.context);
    if (change === "programme advanced") changed.assignment.currentWorkoutIndex++;
    if (change === "session edited") changed.assignment.personalProgramme!.sessions[0].revision++;
    mocks.context.mockResolvedValue(change === "programme ended" ? null : changed);
    if (change === "another review applied") mocks.latest.mockResolvedValue({ id: "other" });
    await expect(applyReviewedProgrammeWeekClient(approved)).rejects.toThrow(
      "changed since this preview",
    );
    expect(mocks.personal).not.toHaveBeenCalled();
    expect(mocks.native).not.toHaveBeenCalled();
  },
);
it("does not fall through to a write when a fresh read fails", async () => {
  const approved = input();
  mocks.context.mockRejectedValue(new Error("Offline"));
  await expect(applyReviewedProgrammeWeekClient(approved)).rejects.toThrow("Offline");
  expect(mocks.personal).not.toHaveBeenCalled();
  expect(mocks.native).not.toHaveBeenCalled();
});
it("propagates a server-side stale or ownership rejection", async () => {
  const approved = input();
  mocks.context.mockResolvedValue(approved.context);
  mocks.personal.mockRejectedValue(new Error("Started sessions are protected"));
  await expect(applyReviewedProgrammeWeekClient(approved)).rejects.toThrow(
    "Started sessions are protected",
  );
  expect(mocks.personal).toHaveBeenCalledOnce();
  expect(mocks.native).not.toHaveBeenCalled();
});
