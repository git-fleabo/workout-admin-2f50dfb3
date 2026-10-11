import type { ReactNode } from "react";
import type { WorkoutPlanMovement, WorkoutPlanMethodBlock } from "@/lib/workout-plan";
import { compactSequence, groupPreviewMovements, repLabel } from "@/lib/workout-preview";

export function WorkoutPrescriptionPreview({
  movements,
  methodBlocks,
  instructions,
  actions,
}: {
  movements: WorkoutPlanMovement[];
  methodBlocks: WorkoutPlanMethodBlock[];
  instructions: string;
  actions?: ReactNode;
}) {
  const sequence = compactSequence(movements.map((movement) => movement.exercise));
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {sequence.names.slice(0, 6).join(" → ")}
        {sequence.names.length > 6 ? " → …" : ""}
        {sequence.passes > 1 ? ` · ${sequence.passes} passes` : ""}
      </p>
      {actions}
      <details className="rounded-lg border border-border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Full workout prescription</summary>
        <div className="mt-3 space-y-3">
          <p className="whitespace-pre-wrap text-sm">{instructions}</p>
          <ol className="space-y-3">
            {groupPreviewMovements(movements).map(({ movement, positions }) => (
              <li key={positions.join(",")} className="text-sm">
                <p className="font-medium">
                  {positions.join(", ")}. {movement.exercise}
                </p>
                {[...new Set([movement.reason, movement.targets.detail].filter(Boolean))].map(
                  (note) => (
                    <p key={note} className="whitespace-pre-wrap text-muted-foreground">
                      {note}
                    </p>
                  ),
                )}
                <p>
                  {movement.setRows
                    .map(
                      (set, index) =>
                        `Set ${index + 1}: ${set.reps ? repLabel(set.reps) : `${set.durationSeconds} sec`}${set.weight ? ` · ${set.weight} kg` : ""}`,
                    )
                    .join("; ")}
                </p>
                {movement.restTime ? (
                  <p className="text-muted-foreground">Rest: {movement.restTime}</p>
                ) : null}
              </li>
            ))}
          </ol>
          {methodBlocks.map((block, index) => {
            const members = compactSequence(
              block.memberMovementIndexes.map(
                (member) => movements[member]?.exercise ?? "Unknown movement",
              ),
            );
            return (
              <p key={index} className="text-sm">
                {block.methodName}: {members.names.join(" → ")}
                {members.passes > 1 ? ` · ${members.passes} passes` : ""}
                {block.rounds ? ` · ${block.rounds} rounds` : ""}
                {block.blockDurationMinutes ? ` · ${block.blockDurationMinutes} min` : ""}
                {block.config.mode === "timed_sequence" &&
                typeof block.config.round_seconds === "number"
                  ? ` · ${block.config.round_seconds / 60} min per round`
                  : ""}
                {Number(block.restBetweenMovementsSeconds) > 0
                  ? ` · ${block.restBetweenMovementsSeconds} sec between movements`
                  : ""}
                {block.restBetweenRoundsSeconds
                  ? ` · ${block.restBetweenRoundsSeconds} sec between rounds`
                  : ""}
                {block.config.mode === "emom" && typeof block.config.interval_seconds === "number"
                  ? ` · Start every ${block.config.interval_seconds} sec`
                  : ""}
                {block.workIntervalSeconds ? ` · ${block.workIntervalSeconds} sec work` : ""}
                {block.restIntervalSeconds ? ` / ${block.restIntervalSeconds} sec rest` : ""}
              </p>
            );
          })}
        </div>
      </details>
    </div>
  );
}
