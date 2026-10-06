import { useEffect, useState } from "react";

/** Use workspace layouts only when there is desktop-sized space and precise pointer input. */
export const DESKTOP_WORKSPACE_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_WORKSPACE_QUERY);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
