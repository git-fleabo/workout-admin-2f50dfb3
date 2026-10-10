import {
  validateWeeklyCoachDraftSelection,
  type WeeklyCoachDraft,
  type WeeklyCoachDraftAddition,
} from "./weekly-coach-draft.ts";

export class StaleWeeklyCoachDraftError extends Error {
  constructor() {
    super(
      "Your saved week or coaching evidence changed while this draft was open. Review the refreshed draft before applying it.",
    );
  }
}

// Use only freshly rebuilt evidence and prescriptions; retain the user's date
// edits. Compensate partial saves without hiding failures to restore the week.
export async function saveReviewedWeeklyCoachDraft({
  reviewed,
  fresh,
  selected,
  save,
  archive,
}: {
  reviewed: WeeklyCoachDraft;
  fresh: WeeklyCoachDraft;
  selected: WeeklyCoachDraftAddition[];
  save: (addition: WeeklyCoachDraftAddition) => Promise<{ suggestedWorkoutId: string }>;
  archive: (id: string) => Promise<unknown>;
}) {
  if (fresh.sourceFingerprint !== reviewed.sourceFingerprint)
    throw new StaleWeeklyCoachDraftError();
  const additions = selected.map((selection) => {
    const current = fresh.additions.find((item) => item.focusId === selection.focusId);
    if (!current)
      throw new Error(`${selection.title} is no longer available in the refreshed draft.`);
    return { ...current, date: selection.date };
  });
  const error = validateWeeklyCoachDraftSelection(fresh, additions);
  if (error) throw new Error(error);
  const inserted: string[] = [];
  try {
    for (const addition of additions) inserted.push((await save(addition)).suggestedWorkoutId);
    return { count: inserted.length };
  } catch (error) {
    const rollback = await Promise.allSettled(inserted.map(archive));
    if (rollback.some((result) => result.status === "rejected")) {
      throw new Error(
        "The draft could not be fully undone. Some sessions remain saved. Refresh your week and remove them before retrying.",
        { cause: error },
      );
    }
    throw error;
  }
}
