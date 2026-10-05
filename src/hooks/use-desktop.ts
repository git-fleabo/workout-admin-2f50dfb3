import { useEffect, useState } from "react";

/** Desktop workspace layouts kick in at wide viewports with a fine pointer-capable window. */
const DESKTOP_QUERY = "(min-width: 1280px)";

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
