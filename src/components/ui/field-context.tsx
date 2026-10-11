import { createContext, useContext, useId } from "react";

export const FieldLabelContext = createContext<string | undefined>(undefined);

// A field may contain several controls. Give each its own ID, while sharing
// the visible label. Explicit names (for example hours/minutes) take priority.
export function useFieldControl(props: {
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const labelId = useContext(FieldLabelContext);
  const id = useId();
  return {
    id: props.id ?? (labelId ? id : undefined),
    "aria-labelledby": props["aria-labelledby"] ?? (props["aria-label"] ? undefined : labelId),
  };
}
