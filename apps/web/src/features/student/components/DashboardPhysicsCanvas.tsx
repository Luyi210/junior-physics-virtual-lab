import { useEffect, useRef, useState } from "react";
import { useElementActivity } from "../../../shared/hooks/useElementActivity";
import { scenes, drawers, type DashboardPhysicsScene } from "./dashboardPhysicsScenes";

export type { DashboardPhysicsScene } from "./dashboardPhysicsScenes";

interface DashboardPhysicsCanvasProps {
  sceneKey?: DashboardPhysicsScene;
  compact?: boolean;
}

export function DashboardPhysicsCanvas({ sceneKey, compact = false }: DashboardPhysicsCanvasProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = useElementActivity(canvasRef, compact ? "120px" : "240px");
  const [paused, setPaused] = useState(false);
  const fixedSceneIndex = sceneKey ? scenes.findIndex((scene) => scene.key === sceneKey) : -1;
  const [sceneIndex, setSceneIndex] = useState(fixedSceneIndex >= 0 ? fixedSceneIndex : 0);

  useEffect(() => {
    if (fixedSceneIndex >= 0) setSceneIndex(fixedSceneIndex);
  }, [fixedSceneIndex]);

  useEffect(() => {
    if (paused || !active || fixedSceneIndex >= 0) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const update = () => {
      window.clearInterval(timer);
      timer = undefined;
      if (!reducedMotion.matches) timer = window.setInterval(() => setSceneIndex((value) => (value + 1) % scenes.length), 5200);
    };
    update();
    reducedMotion.addEventListener("change", update);
    return () => { window.clearInterval(timer); reducedMotion.removeEventListener("change", update); };
  }, [active, fixedSceneIndex, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = 0;
    const transitionStart = performance.now();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(compact ? 1.25 : 1.5, window.devicePixelRatio || 1);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (time: number) => {
      const motionScale = reducedMotion.matches ? .35 : 1;
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalAlpha = paused || !active || reducedMotion.matches ? 1 : Math.min(1, (time - transitionStart) / 620);
      drawers[sceneIndex](context, width, height, time / 1000 * motionScale);
      context.restore();
    };
    const animate = (time: number) => {
      if (time - lastTime >= 1000 / (compact ? 18 : 30)) {
        draw(time);
        lastTime = time;
      }
      frame = window.requestAnimationFrame(animate);
    };
    const restart = () => {
      window.cancelAnimationFrame(frame);
      if (paused || !active || reducedMotion.matches) draw(performance.now());
      else frame = window.requestAnimationFrame(animate);
    };
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => { resize(); draw(performance.now()); });
    });
    observer.observe(canvas);
    reducedMotion.addEventListener("change", restart);
    resize();
    restart();
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", restart);
      window.cancelAnimationFrame(resizeFrame);
      window.cancelAnimationFrame(frame);
    };
  }, [active, compact, paused, sceneIndex]);

  const scene = scenes[sceneIndex];
  if (compact) return <>
    <canvas ref={canvasRef} className="dashboard-physics-canvas field-preview-canvas" aria-hidden="true" />
    <span className="field-preview-live"><i />动态预览</span>
  </>;

  return <>
    <canvas ref={canvasRef} className="dashboard-physics-canvas" aria-hidden="true" />
    <div className="canvas-scene-caption" aria-live="polite"><small>{String(sceneIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")} · AUTO SCENE</small><strong>{scene.title}</strong><span>{scene.note}</span></div>
    <nav className="canvas-scene-tabs" aria-label="选择动态物理场景">{scenes.map((item, index) => <button className={sceneIndex === index ? "active" : ""} onClick={() => setSceneIndex(index)} aria-pressed={sceneIndex === index} aria-label={`切换到${item.title}`} title={item.title} key={item.key}>{String(index + 1).padStart(2, "0")}</button>)}</nav>
    <button className={`canvas-motion-toggle ${paused ? "paused" : "running"}`} onClick={() => setPaused((value) => !value)} aria-pressed={paused}><i />{paused ? "继续动画与轮播" : "暂停动画与轮播"}</button>
  </>;
}
