import { useLayoutEffect, useRef, type RefObject } from "react";

// Controlled dialogs have no Radix Trigger ref. Capture the initiating control
// before autofocus; async checks may briefly disable it, so accept a fallback.
export function useDialogReturnFocus(open: boolean, fallback?: RefObject<HTMLElement | null>) {
  const returnFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) {
      const active = document.activeElement;
      returnFocus.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : (fallback?.current ?? null);
    }
  }, [open, fallback]);
  return (event: Event) => {
    if (returnFocus.current?.isConnected) {
      event.preventDefault();
      returnFocus.current.focus();
    }
  };
}
