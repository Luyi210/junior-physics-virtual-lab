import { useLocation } from "react-router-dom";
import { useMemo, useEffect } from "react";
import { useHarnessStore } from "./harnessStore";
import { routeHarnessContext } from "./routing";
import { HarnessPanel } from "./AssistantPanel";

export function HarnessRuntime() {
  const location = useLocation();
  const context = useMemo(() => routeHarnessContext(location.pathname, location.search), [location.pathname, location.search]);
  const area = context?.area;
  const module = context?.module;
  const enterArea = useHarnessStore((state) => state.enterArea);
  const leaveArea = useHarnessStore((state) => state.leaveArea);
  const setPanelOpen = useHarnessStore((state) => state.setPanelOpen);

  useEffect(() => {
    if (!area || module === undefined) return;
    void enterArea(area, module);
    return () => leaveArea();
  }, [area, module, enterArea, leaveArea]);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    setPanelOpen(false);
  }, [setPanelOpen]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("harness") === "dialogue") setPanelOpen(true);
  }, [location.search, setPanelOpen]);

  if (!context) return null;
  return <HarnessPanel />;
}
