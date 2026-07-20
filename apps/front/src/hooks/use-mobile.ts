import * as React from "react";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(
    () => window.matchMedia("(max-width: 768px)").matches
  );

  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
