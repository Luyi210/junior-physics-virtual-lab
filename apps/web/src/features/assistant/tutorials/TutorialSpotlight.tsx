import { type TutorialTarget } from "../tutorialBridge";
import { type GuidedTutorialTarget } from "../opticsTutorials";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";

interface SpotlightRect { top: number; left: number; width: number; height: number }

export type SpotlightTarget = TutorialTarget | GuidedTutorialTarget;

const genericSpotlightSelectors: Record<GuidedTutorialTarget, string[]> = {
  module: [".explore-module-content .open-module-intro", ".science-module-experience .science-lab > header", ".explore-module-content .open-experience"],
  visual: [
    ".science-module-experience > .science-lab > [class*='-sim']",
    ".science-module-experience > .science-lab > [class*='-apparatus']",
    ".science-module-experience > .science-lab > [class*='-stage']",
    ".science-module-experience > .science-lab > [class*='-rig']",
    ".science-module-experience > .science-lab",
    ".explore-module-content .concept-sim",
    ".explore-module-content .sound-sim",
    ".explore-module-content .lever-sim",
    ".explore-module-content .circuit-sim",
    ".explore-module-content .thermal-sim",
    ".explore-module-content .density-sim",
    ".explore-module-content .balance-lab-sim",
    ".explore-module-content .ray-law-lab",
    ".explore-module-content .camera-lab",
    ".explore-module-content .eye-lab",
    ".explore-module-content .color-mix-lab",
    ".explore-module-content .correction-lab",
    ".explore-module-content .instrument-lab",
    ".explore-module-content .celestial-lab",
    ".explore-module-content .curved-mirror-lab",
    ".explore-module-content .invisible-light-lab",
    ".explore-module-content .vision-optical-stage",
    ".explore-module-content .vision-3d-stage",
    ".explore-module-content .lens-system-3d-lab",
    ".explore-module-content .experience-canvas",
    ".explore-module-content .open-experience"
  ],
  controls: [
    ".science-module-experience .science-lab [class*='-operation-dock']",
    ".science-module-experience .science-lab > [class*='-controls']:not(.science-controls)",
    ".science-module-experience .science-lab .noise-control-console",
    ".science-module-experience .science-lab .campus-scene-selector",
    ".science-module-experience .science-lab .science-controls",
    ".science-module-experience .science-lab .science-range",
    ".science-module-experience .science-lab .science-lab-header-actions",
    ".explore-module-content .science-controls",
    ".explore-module-content .balance-operation-dock",
    ".explore-module-content .open-control-deck",
    ".explore-module-content .rgb-controls",
    ".explore-module-content .medium-tabs",
    ".explore-module-content .correction-lens-deck",
    ".explore-module-content .instrument-switch",
    ".explore-module-content .vision-prescription-console",
    ".explore-module-content .invisible-application-picker",
    ".explore-module-content .open-experience"
  ],
  explanation: [".science-module-experience .science-experiment-guide", ".explore-module-content .science-module-guide", ".explore-module-content .dispersion-guide", ".explore-module-content .physics-law-plate", ".explore-module-content .open-module-intro"],
  application: [
    ".science-module-experience .science-life-application",
    ".explore-module-content .science-life-application",
    ".explore-module-content .rainbow-life-section",
    ".explore-module-content .micro-display-workbench",
    ".explore-module-content .mirror-life-workbench",
    ".explore-module-content .invisible-application-picker",
    ".explore-module-content .open-experience > section:last-of-type",
    ".explore-module-content .open-experience"
  ]
};

export function TutorialSpotlight({ target, label }: { target: SpotlightTarget; label: string }) {
  const [rect, setRect] = useState<SpotlightRect>();

  useEffect(() => {
    setRect(undefined);
    let alignedToTarget = false;
    let frame = 0;
    const update = () => {
      const preferred = [...document.querySelectorAll(`[data-tutorial-spotlight="${target}"]`)];
      const fallback = [...document.querySelectorAll(`[data-tutorial-target="${target}"]`)];
      const generic = target in genericSpotlightSelectors
        ? genericSpotlightSelectors[target as GuidedTutorialTarget]
          .map((selector) => document.querySelector(selector))
          .filter((node): node is Element => Boolean(node))
        : [];
      const candidates = preferred.length ? preferred : fallback.length ? fallback : generic;
      const visibleCandidates = candidates.filter((node) => {
        const item = node.getBoundingClientRect();
        return item.width > 0 && item.height > 0 && item.bottom > 0 && item.top < window.innerHeight;
      });
      if (candidates[0] && !alignedToTarget) {
        alignedToTarget = true;
        candidates[0].scrollIntoView({ behavior: "smooth", block: "center" });
      }
      const selected = target in genericSpotlightSelectors && visibleCandidates.length ? [visibleCandidates[0]] : visibleCandidates;
      const bounds = selected
        .map((node) => node.getBoundingClientRect())
        .filter((item) => item.width > 0 && item.height > 0 && item.bottom > 0 && item.top < window.innerHeight);
      if (!bounds.length) return;
      const padding = target === "experiment" ? 8 : 13;
      const left = Math.max(7, Math.min(...bounds.map((item) => item.left)) - padding);
      const top = Math.max(7, Math.min(...bounds.map((item) => item.top)) - padding);
      const right = Math.min(window.innerWidth - 7, Math.max(...bounds.map((item) => item.right)) + padding);
      const bottom = Math.min(window.innerHeight - 7, Math.max(...bounds.map((item) => item.bottom)) + padding);
      const next = { top, left, width: right - left, height: bottom - top };
      setRect((current) => current && Math.abs(current.top - next.top) < .5 && Math.abs(current.left - next.left) < .5 && Math.abs(current.width - next.width) < .5 && Math.abs(current.height - next.height) < .5 ? current : next);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    const interval = window.setInterval(scheduleUpdate, 400);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [label, target]);

  if (!rect) return null;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  return createPortal(<div className="tutorial-spotlight" aria-hidden="true">
    <i className="tutorial-spotlight-shade shade-top" style={{ top: 0, left: 0, width: viewportWidth, height: rect.top }} />
    <i className="tutorial-spotlight-shade shade-left" style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }} />
    <i className="tutorial-spotlight-shade shade-right" style={{ top: rect.top, left: rect.left + rect.width, width: Math.max(0, viewportWidth - rect.left - rect.width), height: rect.height }} />
    <i className="tutorial-spotlight-shade shade-bottom" style={{ top: rect.top + rect.height, left: 0, width: viewportWidth, height: Math.max(0, viewportHeight - rect.top - rect.height) }} />
    <i className="tutorial-spotlight-frame" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
    <span className="tutorial-spotlight-label" style={{ top: Math.max(8, rect.top - 34), left: Math.min(rect.left + 5, viewportWidth - 190) }}><Sparkles size={13} />光光正在讲这里 · {label.split("·")[0]}</span>
  </div>, document.body);
}
