import { useState, useEffect } from "react";

export function useClock(running: boolean, speed: number) { const [phase, setPhase] = useState(0); useEffect(() => { if (!running) return; let frame = 0; let last = performance.now(); const animate = (now: number) => { if (now - last >= 45) { setPhase((value) => (value + speed) % 1); last = now; } frame = requestAnimationFrame(animate); }; frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame); }, [running, speed]); return phase; }
