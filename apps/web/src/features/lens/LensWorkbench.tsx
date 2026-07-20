import { useMemo, useState } from "react";
import { calculateLens } from "@physics-lab/physics";
import type { ExperimentProject } from "@physics-lab/contracts";
import { ArrowLeft, Check, Download, FlaskConical, Home, Redo2, RotateCcw, Save, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { ExperimentFullscreenButton } from "../../components/ExperimentFullscreenButton";
import { localProjectRepository } from "../../services/projectRepository";
import { LensCanvas } from "./LensCanvas";
import { LensInspector } from "./LensInspector";
import { useLensStore } from "./lensStore";
import type { LensSceneState } from "./lensStore";

interface LensRecord {
  id: string;
  u: number;
  v: number;
  m: number;
  nature: string;
}

export function LensWorkbench() {
  const scene = useLensStore((state) => state.scene);
  const past = useLensStore((state) => state.past);
  const future = useLensStore((state) => state.future);
  const undo = useLensStore((state) => state.undo);
  const redo = useLensStore((state) => state.redo);
  const reset = useLensStore((state) => state.reset);
  const update = useLensStore((state) => state.update);
  const [records, setRecords] = useState<LensRecord[]>([]);
  const [saved, setSaved] = useState(false);
  const [activated, setActivated] = useState(false);
  const result = useMemo(() => calculateLens(scene), [scene]);

  const focusScreen = () => {
    if (result.real && result.finite) {
      update({ screenX: Math.max(4, Math.min(95, result.imageX)) });
      setActivated(true);
    }
  };

  const addRecord = () => setRecords((rows) => [...rows, {
    id: crypto.randomUUID(),
    u: result.objectDistance,
    v: result.imageDistance,
    m: result.magnification,
    nature: result.nature
  }]);

  const saveProject = async () => {
    const now = new Date().toISOString();
    const project: ExperimentProject<LensSceneState> = {
      id: "lens-default-project",
      title: "凸透镜成像实验",
      kind: "lens",
      schemaVersion: 1,
      state: scene,
      createdAt: now,
      updatedAt: now
    };
    await localProjectRepository.save(project);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const exportCsv = () => {
    const lines = [
      ["序号", "物距u/cm", "像距v/cm", "放大率m", "成像性质"],
      ...records.map((row, index) => [index + 1, row.u.toFixed(1), Number.isFinite(row.v) ? row.v.toFixed(1) : "∞", Number.isFinite(row.m) ? row.m.toFixed(2) : "∞", row.nature])
    ];
    const csv = lines.map((line) => line.map((cell) => `"${cell}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "凸透镜成像实验-V2.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="workbench-page">
      <header className="workbench-header">
        <div className="workbench-brand"><Link to="/" aria-label="返回平台总入口"><BrandMark compact /></Link><span /><div><small>ADVANCED TOOL / 独立高级工具</small><strong>凸透镜精密实验工作台</strong></div></div>
        <div className="workbench-actions">
          <button title="撤销" disabled={!past.length} onClick={undo}><Undo2 size={17} /><span>撤销</span></button>
          <button title="重做" disabled={!future.length} onClick={redo}><Redo2 size={17} /><span>重做</span></button>
          <button title="复位" onClick={() => { reset(); setActivated(false); }}><RotateCcw size={17} /><span>复位</span></button>
          <i />
          <button className={saved ? "saved" : ""} onClick={saveProject}>{saved ? <Check size={17} /> : <Save size={17} />}<span>{saved ? "已保存" : "保存"}</span></button>
          <ExperimentFullscreenButton targetSelector=".workbench-page" experiment="lens-professional-workbench" className="workbench-fullscreen-button" label="全屏" hint="保留全部仪器" />
          <Link className="exit-button" to="/student/explore/light?mode=bench"><Home size={17} /><span>返回光现象</span></Link>
        </div>
      </header>

      <main className="workbench-layout">
        <aside className="component-rail">
          <div className="rail-title"><span>器材</span><small>3 ITEMS</small></div>
          <button className="rail-item active"><span className="candle-glyph">↑</span><b>发光物</b><small>可拖动</small></button>
          <button className="rail-item"><span className="lens-glyph">)(</span><b>凸透镜</b><small>固定光心</small></button>
          <button className="rail-item active"><span className="screen-glyph" /><b>光屏</b><small>可拖动</small></button>
          <div className="rail-note"><FlaskConical size={17} /><span>V2 元件模型<br />属性与视图分离</span></div>
        </aside>

        <section className="experiment-stage">
          <div className="stage-heading">
            <div><span className="live-dot" />实时光路演算</div>
            <p>拖动发光物和光屏，观察成像变化</p>
            <button onClick={focusScreen} disabled={!result.real}><span>自动对焦</span><ArrowLeft size={15} /></button>
          </div>
          <LensCanvas scene={scene} result={result} onInteract={() => setActivated(true)} revealResult={activated} />
          {!activated && <div className="interaction-cue workbench-cue"><FlaskConical size={18} /><span><small>实验台尚未开始测量</small><strong>拖动物体、光屏，或调节右侧参数</strong></span></div>}
        </section>

        <LensInspector scene={scene} result={result} revealed={activated} onInteract={() => setActivated(true)} />
      </main>

      <section className="data-dock">
        <div className="dock-summary">
          <span>实验数据 / DATA LOG</span>
          <strong>{records.length.toString().padStart(2, "0")}</strong>
          <small>组已记录</small>
        </div>
        <div className="dock-table">
          {records.length === 0 ? (
            <div className="empty-log">移动元件，找到一种成像状态，然后记录本组数据。</div>
          ) : (
            <table>
              <thead><tr><th>#</th><th>物距 u</th><th>像距 v</th><th>放大率 m</th><th>成像性质</th></tr></thead>
              <tbody>{records.slice(-4).map((row, index) => <tr key={row.id}><td>{records.length - Math.min(4, records.length) + index + 1}</td><td>{row.u.toFixed(1)} cm</td><td>{Number.isFinite(row.v) ? `${row.v.toFixed(1)} cm` : "∞"}</td><td>{Number.isFinite(row.m) ? row.m.toFixed(2) : "∞"}</td><td>{row.nature}</td></tr>)}</tbody>
            </table>
          )}
        </div>
        <div className="dock-actions">
          <button className="button-record" onClick={addRecord} disabled={!activated}>记录本组数据</button>
          <button onClick={exportCsv} disabled={!records.length}><Download size={16} />导出 CSV</button>
        </div>
      </section>
    </div>
  );
}
