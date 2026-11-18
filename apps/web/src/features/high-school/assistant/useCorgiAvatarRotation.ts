import { useEffect, useRef, useState } from "react";
import { CORGI_ROTATION_INTERVAL_MS, normalizeCorgiIndex } from "./corgiAvatars";

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCorgiAvatarRotation({ open, busy }: { open: boolean; busy: boolean }) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [automaticChoice, setAutomaticChoice] = useState<boolean | null>(null);
  const [interacting, setInteractingState] = useState(false);
  const interactions = useRef({ pointer: false, focus: false });
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const mounted = useRef(false);
  const automatic = automaticChoice ?? !reducedMotion;
  const latest = useRef({ open, busy, automatic, interacting });
  latest.current = { open, busy, automatic, interacting };

  useEffect(() => {
    mounted.current = true;
    const media = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const change = () => {
      if (!mounted.current || !media) return;
      setReducedMotion(media.matches);
      if (media.matches) { latest.current.automatic = false; setAutomaticChoice(choice => choice === false ? false : null); }
    };
    change();
    media?.addEventListener("change", change);
    return () => { mounted.current = false; media?.removeEventListener("change", change); };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canAdvance = () => active && mounted.current && !document.hidden && latest.current.automatic && !latest.current.open && !latest.current.busy && !latest.current.interacting;
    const stop = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
    const schedule = () => {
      stop();
      if (canAdvance()) timer = setTimeout(() => {
        timer = undefined;
        if (!canAdvance()) return;
        // Recheck when React processes the updater, including a delayed update after cleanup.
        setIndex(value => canAdvance() ? normalizeCorgiIndex(value + 1) : value);
        schedule();
      }, CORGI_ROTATION_INTERVAL_MS);
    };
    const visibility = () => { if (!active) return; setHidden(document.hidden); schedule(); };
    document.addEventListener("visibilitychange", visibility);
    schedule();
    return () => { active = false; stop(); document.removeEventListener("visibilitychange", visibility); };
  }, [automatic, open, busy, interacting]);

  function move(direction: -1 | 1) {
    if (!mounted.current) return;
    latest.current.automatic = false;
    setAutomaticChoice(false);
    setIndex(value => mounted.current ? normalizeCorgiIndex(value + direction) : value);
  }
  function toggleAutomatic() {
    if (!mounted.current) return;
    const next = !latest.current.automatic;
    latest.current.automatic = next;
    setAutomaticChoice(next);
  }
  function setInteracting(value: boolean, source: "pointer" | "focus" = "pointer") {
    if (!mounted.current) return;
    interactions.current[source] = value;
    const paused = interactions.current.pointer || interactions.current.focus;
    latest.current.interacting = paused;
    setInteractingState(paused);
  }

  const status = !automatic ? (reducedMotion && automaticChoice === null ? "减少动态：自动轮换已关闭" : "已固定当前形象") : hidden ? "页面不可见，轮换暂停" : open ? "聊天中暂停，收起后每 15 秒轮换" : busy ? "等待回复时暂停轮换" : interacting ? "操作时暂停轮换" : "每 15 秒自动轮换";
  return { index, automatic, status, previous: () => move(-1), next: () => move(1), toggleAutomatic, setInteracting };
}
