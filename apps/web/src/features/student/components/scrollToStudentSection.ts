import type { MouseEvent } from "react";

/** A document fragment must not replace the application route in HashRouter. */
export function scrollToStudentSection(event: Pick<MouseEvent, "preventDefault">, id: string) {
  event.preventDefault();
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
}
