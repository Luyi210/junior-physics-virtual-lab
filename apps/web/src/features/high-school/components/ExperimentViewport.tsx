import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Box, Hand, LoaderCircle, RotateCcw, ScanLine, ZoomIn, ZoomOut } from "lucide-react";
import { ExperimentDiagram2D, type ExperimentSceneProps } from "./ExperimentDiagram2D";
import type { SceneCameraView } from './sceneCamera';
import './ExperimentViewport.css';
import { isExpandedExperiment } from './expanded/expandedGeometry';
import { useMobileSceneMode } from '../../../shared/hooks/useMobileSceneMode';
import { PendulumTouchControls } from './flagship/PendulumControls';

const Scene3D = lazy(() => import("./ExperimentScene3D"));

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function ExperimentViewport(props: ExperimentSceneProps) {
  const [viewPreference, setViewPreference] = useState<"auto" | "2d" | "3d">("auto");
  const [available, setAvailable] = useState(false);
  const [camera, setCamera] = useState(0);
  const [cameraView, setCameraView] = useState<SceneCameraView>("perspective");
  const [magnified, setMagnified] = useState(false);
  const [notice, setNotice] = useState("");
  const mobileScene = useMobileSceneMode();
  // Automatic defaults follow the display; an explicit choice survives rotation
  // and resizing. No scene is mounted until the resolved mode is actually 3D.
  const mode = available && (viewPreference === "3d" || (viewPreference === "auto" && !mobileScene)) ? "3d" : "2d";
  const [touchRotation, setTouchRotation] = useState(false);
  // Re-entering a view never silently captures the user's next page swipe.
  useEffect(() => { setTouchRotation(false); }, [props.experimentId, mode, mobileScene]);
  const cameraInteractive = !mobileScene || touchRotation;
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (context) { context.getExtension("WEBGL_lose_context")?.loseContext(); setAvailable(true); }
      else setNotice("此设备使用二维视图，实验控制、计算和记录仍可使用。");
    } catch { setNotice("此设备使用二维视图，实验控制、计算和记录仍可使用。"); }
  }, []);
  const forceBoard = props.experimentId === "force-composition";
  const pendulum = props.experimentId === "pendulum";
  const capacitorBoard = props.experimentId === "capacitor-charge";
  const expandedInstrument = isExpandedExperiment(props.experimentId);
  const renderNotice = notice || (mobileScene && mode === "2d" && available ? "手机端优先使用二维装置，操作与读数保留，可按需切换三维。" : "");
  const diagram = <div className={`hs-diagram-surface${mode === "2d" && magnified ? " is-magnified" : ""}`}><ExperimentDiagram2D {...props} /></div>;
  return <section className="hs-viewport" data-mode={mode} data-camera-interactive={cameraInteractive} aria-label="实验装置"><header><div className="hs-viewport-heading"><span>装置观察舱</span><small>切换视图，保留实验进度</small></div><div className="hs-viewport-toolbar"><div className="hs-view-switch" role="group" aria-label="实验视图"><button type="button" aria-pressed={mode === "3d"} disabled={!available} onClick={() => setViewPreference("3d")}><Box size={15} />{forceBoard ? "三维矢量板" : "三维装置"}</button><button type="button" aria-pressed={mode === "2d"} onClick={() => setViewPreference("2d")}><ScanLine size={15} />{forceBoard ? "二维拖动" : "二维示意"}</button></div>{mode === "3d" ? <div className="hs-camera-tools">{mobileScene && <button type="button" className="hs-touch-rotation" aria-pressed={touchRotation} onClick={() => setTouchRotation(value => !value)}><Hand size={15} />{touchRotation ? "退出旋转" : "启用触摸旋转"}</button>}<label><span className="hs-sr-only">观察视角</span><select aria-label="观察视角" value={cameraView} onChange={event => setCameraView(event.target.value as SceneCameraView)}><option value="perspective">立体视角</option><option value="front">正面观察</option><option value="top">俯视观察</option></select></label><button className="hs-camera-reset" type="button" onClick={() => setCamera((value) => value + 1)}><RotateCcw size={13} />复位视角</button></div> : <button className="hs-diagram-zoom" type="button" aria-pressed={magnified} onClick={() => setMagnified(value => !value)}>{magnified ? <ZoomOut size={15} /> : <ZoomIn size={15} />}{magnified ? "完整示意" : "放大读尺"}</button>}</div></header><div tabIndex={mode === "2d" && magnified ? 0 : undefined} role={mode === "2d" && magnified ? "region" : undefined} aria-label={mode === "2d" && magnified ? "放大的装置示意，可横向和纵向滚动" : undefined} className={`hs-viewport-stage${mode === "2d" && magnified ? " is-magnified" : ""}${pendulum && mode === "2d" ? " hs-pendulum-viewport-stage" : ""}${forceBoard && mode === "2d" ? " hs-force-viewport-stage" : capacitorBoard && mode === "2d" ? " hs-capacitor-viewport-stage" : ""}`}>
    {mode === "3d" ? <SceneBoundary key={`${camera}:${cameraView}`} fallback={diagram} onFailure={() => { setViewPreference("2d"); setNotice("三维装置暂时无法显示，已保留可操作的二维示意。"); }}><Suspense fallback={<>{diagram}<div className="hs-scene-loading" role="status"><LoaderCircle size={16} />正在装配三维仪器…</div></>}><Scene3D {...props} cameraView={cameraView} cameraInteractive={cameraInteractive} mobileScene={mobileScene} onContextLost={() => { setViewPreference("2d"); setAvailable(false); setNotice("三维渲染已中断，实验已切换为二维视图。"); }} /></Suspense></SceneBoundary> : diagram}
    </div>{pendulum && mobileScene && mode === "3d" && <PendulumTouchControls parameters={props.parameters} simulation={props.simulation} onChange={props.onParametersChange} />}<footer><span>{mode === "2d" && magnified ? "滑动或用方向键滚动，放大只改变显示" : mode === "3d" ? mobileScene ? touchRotation ? "单指旋转 · 双指缩放/平移 · 退出旋转后滑动页面" : "可直接上下滑动页面；点“启用触摸旋转”观察装置" : "拖动旋转 · 滚轮缩放 · 双指平移" : forceBoard ? "拖动箭头端点 · 也可选择力后用方向键调整" : capacitorBoard ? "按钮或触点切换回路 · 键盘同样可操作" : pendulum ? "拖动释放点 · 方向键微调释放角" : expandedInstrument ? "图内操作支持点击和键盘 · 参数区可精确输入" : "二维视图 · 所有物理读数与三维一致"}</span><span>{pendulum ? "固定米比例 · 摆长从悬点量到球心" : forceBoard ? "固定比例尺 · 所有力作用于同一点" : capacitorBoard ? "共用电路拓扑 · 尺寸与电荷符号示意" : "场景按当前条件示意缩放"}</span></footer>{renderNotice && <p className="hs-render-notice" role="status">{renderNotice}</p>}</section>;
}
