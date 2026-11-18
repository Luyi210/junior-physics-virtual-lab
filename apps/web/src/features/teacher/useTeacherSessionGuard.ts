import { useCallback, useEffect, useRef, useState } from "react";
import { getTeacherSessionScope, isCurrentTeacherSessionScope } from "../../data/teacherSessionScope";

/** Captures this mounted editor's identity. Call before operations and after each await.
 * Dashboard keys account content by scope revision; this also rejects pre-unmount callbacks. */
export function useTeacherSessionGuard() {
  const [scope] = useState(getTeacherSessionScope);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return useCallback((requireAccount = true) => mounted.current && isCurrentTeacherSessionScope(scope, requireAccount), [scope]);
}
