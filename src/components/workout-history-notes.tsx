export function WorkoutHistoryNotes({
  notes,
  summaryLog = false,
}: {
  notes: string;
  summaryLog?: boolean;
}) {
  const marker = "Prescribed workout (reference only)";
  const referenceStart = summaryLog ? notes.indexOf(`\n${marker}\n`) : -1;
  const actualNotes = referenceStart >= 0 ? notes.slice(0, referenceStart) : notes;
  const reference = referenceStart >= 0 ? notes.slice(referenceStart + marker.length + 2) : "";
  return (
    <>
      {actualNotes ? (
        <div className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          {actualNotes}
        </div>
      ) : null}
      {reference ? (
        <details className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium">
            Prescribed workout (reference only)
          </summary>
          <p className="mt-3 whitespace-pre-wrap break-words">{reference}</p>
        </details>
      ) : null}
    </>
  );
}
