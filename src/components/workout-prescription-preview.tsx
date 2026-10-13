import type { ReactNode } from "react";
import type { WorkoutPlanMovement, WorkoutPlanMethodBlock } from "@/lib/workout-plan";
import {
  compactSequence,
  groupPreviewMovements,
  previewSequenceRows,
  previewTarget,
  repLabel,
} from "@/lib/workout-preview";

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
  const targetSequence = previewSequenceRows(movements);
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {sequence.names.slice(0, 6).join(" → ")}
        {sequence.names.length > 6 ? " → …" : ""}
        {sequence.passes > 1 ? ` · ${movements.length} steps` : ""}
      </p>
      {actions}
      <details className="rounded-lg border border-border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Full workout prescription</summary>
        <div className="mt-3 space-y-3">
          <p className="whitespace-pre-wrap text-sm">{instructions}</p>
          {targetSequence ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Follow each row from left to right, then move to the next row. Side changes and
                timing follow the instructions and step notes.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Ordered workout targets</caption>
                  <thead>
                    <tr>
                      <th className="py-2 pr-3">Steps</th>
                      {targetSequence.names.map((name, index) => (
                        <th key={index} className="px-2 py-2 font-medium">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {targetSequence.rows.map((row) => (
                      <tr key={row.start} className="border-t border-border">
                        <th className="py-2 pr-3 font-normal whitespace-nowrap">
                          {row.start === row.end ? row.start : `${row.start}–${row.end}`}
                        </th>
                        {row.movements.map((movement, index) => (
                          <td key={index} className="px-2 py-2">
                            {previewTarget(movement)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {movements.map((movement, index) => (
                <li key={index}>
                  <span className="font-medium">{movement.exercise}</span>:{" "}
                  {previewTarget(movement)}
                </li>
              ))}
            </ol>
          )}
          <details className="rounded-md border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm">Step-by-step notes</summary>
            <ol className="mt-3 space-y-3">
              {groupPreviewMovements(movements).map(({ movement, positions }) => (
                <li key={positions.join(",")} className="text-sm">
                  <p className="font-medium">
                    {positions.join(", ")}. {movement.exercise}
                  </p>
                  {[...new Set([movement.reason, movement.targets.detail].filter(Boolean))]
                    .filter(
                      (note, _, notes) =>
                        !notes.some((other) => other !== note && other.endsWith(note)),
                    )
                    .map((note) => (
                      <p key={note} className="whitespace-pre-wrap text-muted-foreground">
                        {note}
                      </p>
                    ))}
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
          </details>
          {methodBlocks.map((block, index) => {
            const members = compactSequence(
              block.memberMovementIndexes.map(
                (member) => movements[member]?.exercise ?? "Unknown movement",
              ),
            );
            return (
              <p key={index} className="text-sm">
                {block.methodName}: {members.names.join(" → ")}
                {members.passes > 1 ? ` · ${block.memberMovementIndexes.length} steps` : ""}
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
