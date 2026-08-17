import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

import { workoutSessionDraftKey } from "@/lib/workout-local-state";
import type { SessionFormState } from "@/components/workout-logger/full-workout-form";

type StoredWorkoutSessionDraft = {
  version: 1;
  savedAt: string;
  form: SessionFormState;
  loadedSuggestionId: string | null;
  editingSessionId: string | null;
};

type UseWorkoutDraftOptions = {
  form: SessionFormState;
  initialFormLoaded: boolean;
  loadedSuggestionId: string | null;
  editingSessionId: string | null;
  setForm: Dispatch<SetStateAction<SessionFormState>>;
  setLoadedSuggestionId: Dispatch<SetStateAction<string | null>>;
  setEditingSessionId: Dispatch<SetStateAction<string | null>>;
  blankForm: () => SessionFormState;
  hasDraftContent: (form: SessionFormState) => boolean;
};

export function useWorkoutDraft({
  form,
  initialFormLoaded,
  loadedSuggestionId,
  editingSessionId,
  setForm,
  setLoadedSuggestionId,
  setEditingSessionId,
  blankForm,
  hasDraftContent,
}: UseWorkoutDraftOptions) {
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [discardDraftOpen, setDiscardDraftOpen] = useState(false);
  const storageKey = workoutSessionDraftKey();

  useEffect(() => {
    if (!initialFormLoaded) return;
    if (!hasDraftContent(form)) {
      window.localStorage.removeItem(storageKey);
      setDraftSavedAt(null);
      return;
    }
    const savedAt = new Date().toISOString();
    const draft: StoredWorkoutSessionDraft = {
      version: 1,
      savedAt,
      form,
      loadedSuggestionId,
      editingSessionId,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
    setDraftSavedAt(savedAt);
  }, [editingSessionId, form, hasDraftContent, initialFormLoaded, loadedSuggestionId, storageKey]);

  const discardDraft = () => {
    window.localStorage.removeItem(storageKey);
    setForm(blankForm());
    setLoadedSuggestionId(null);
    setEditingSessionId(null);
    setDraftSavedAt(null);
    setDiscardDraftOpen(false);
    toast.message("Workout draft discarded");
  };

  return {
    storageKey,
    draftSavedAt,
    setDraftSavedAt,
    discardDraftOpen,
    setDiscardDraftOpen,
    discardDraft,
  };
}
