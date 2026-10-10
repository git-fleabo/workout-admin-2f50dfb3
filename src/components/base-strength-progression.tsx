import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabasePublicRpc } from "@/lib/supabase-public";
import type { BaseStrengthProgressionReview } from "@/lib/base-strength-personal";
import type { PersonalProgrammeSession } from "@/lib/personal-programme";

export function BaseStrengthProgressionResult({
  review,
  saving,
  onApply,
}: {
  review: BaseStrengthProgressionReview;
  saving: boolean;
  onApply: () => void;
}) {
  return (
    <div className="space-y-2" role="status">
      <p className="text-sm font-medium">
        {review.load != null && review.kind !== "review"
          ? `Next working load: ${review.load} kg`
          : "Review needed"}
      </p>
      {review.previousReps != null ? (
        <p className="text-xs text-muted-foreground">
          Completed programme workout: final set {review.previousReps} reps at {review.previousLoad}{" "}
          kg.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">{review.detail}</p>
      {review.kind !== "review" && review.load != null ? (
        <Button size="sm" disabled={saving} onClick={onApply}>
          {saving ? "Applying…" : "Apply to this session"}
        </Button>
      ) : null}
    </div>
  );
}
function MovementProgression({
  assignmentId,
  session,
  programmeKey,
  exercise,
}: {
  assignmentId: string;
  session: PersonalProgrammeSession;
  programmeKey: string;
  exercise: string;
}) {
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [applied, setApplied] = useState(false);
  const review = useQuery({
    queryKey: [
      "base-strength-progression",
      assignmentId,
      session.workoutId,
      session.revision,
      programmeKey,
    ],
    enabled: opened,
    queryFn: () =>
      supabasePublicRpc<BaseStrengthProgressionReview>("review_base_strength_progression", {
        p_assignment_id: assignmentId,
        p_workout_id: session.workoutId,
        p_programme_key: programmeKey,
      }),
    // An approval uses precisely the snapshot shown; fresh evidence is checked again by the server.
    refetchOnWindowFocus: false,
  });
  const apply = useMutation({
    mutationFn: () =>
      supabasePublicRpc<number>("apply_base_strength_progression", {
        p_assignment_id: assignmentId,
        p_workout_id: session.workoutId,
        p_programme_key: programmeKey,
        p_revision: review.data?.revision,
        p_fingerprint: review.data?.fingerprint,
      }),
    onSuccess: async () => {
      setApplied(true);
      await Promise.all(
        [
          "my-programme-overview",
          "programme-assignments",
          "programme-schedule",
          "programme-workout-offers",
          "programme-exercise-rule",
          "base-strength-progression",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{exercise} · Bullmastiff progression</p>
        <Button
          size="sm"
          variant="outline"
          disabled={apply.isPending || review.isFetching}
          onClick={() => {
            setOpened(true);
            setApplied(false);
            apply.reset();
            if (opened) void review.refetch();
          }}
        >
          Review completed plus set
        </Button>
      </div>
      {review.isFetching ? (
        <p role="status" className="text-sm">
          Checking the linked workout…
        </p>
      ) : null}
      {applied ? (
        <p role="status" className="text-sm">
          Load applied to this future session.
        </p>
      ) : review.data && opened ? (
        <BaseStrengthProgressionResult
          review={review.data}
          saving={apply.isPending}
          onApply={() => apply.mutate()}
        />
      ) : null}
      {review.error || apply.error ? (
        <p role="alert" className="text-sm text-destructive">
          {(apply.error ?? review.error)?.message}
        </p>
      ) : null}
    </div>
  );
}
export function BaseStrengthProgression({
  assignmentId,
  session,
}: {
  assignmentId: string;
  session: PersonalProgrammeSession;
}) {
  const movements = session.plan.movements.filter(
    (m) =>
      m.baseStrength?.programme === "bullmastiff" &&
      m.baseStrength.role === "main" &&
      m.baseStrength.week > 1 &&
      m.progression.type === "source",
  );
  if (!movements.length) return null;
  return (
    <div className="space-y-3">
      {movements.map((m) => (
        <MovementProgression
          key={`${m.programmeKey}:${session.revision}`}
          assignmentId={assignmentId}
          session={session}
          programmeKey={m.programmeKey}
          exercise={m.exercise}
        />
      ))}
    </div>
  );
}
