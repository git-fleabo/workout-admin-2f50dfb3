import { useCallback, useState } from "react";

import type { MethodBlockEditorState } from "@/components/workout-logger/full-workout-form";

export function useMethodBlockEditor() {
  const [state, setState] = useState<MethodBlockEditorState>({ mode: "closed" });
  const openCreate = useCallback(() => setState({ mode: "create" }), []);
  const openEdit = useCallback((blockId: string) => setState({ mode: "edit", blockId }), []);
  const close = useCallback(() => setState({ mode: "closed" }), []);

  return { state, openCreate, openEdit, close };
}
