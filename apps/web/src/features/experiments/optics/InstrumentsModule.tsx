import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { Telescope, Microscope, Moon, Dna } from "lucide-react";
import { type LensViewMode, LensDimensionSwitch, LensSystem3DView, LensReadingStrip, LensModuleGuide } from "./shared/LensControls";
import { ModuleIntro, MotionButton, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";

export function InstrumentsModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [instrument, setInstrument] = useState<"telescope" | "microscope">("telescope");
  const [objectiveF, setObjectiveF] = useState(60);
  const [eyepieceF, setEyepieceF] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("2d");
  const interact = () => setInteracted(true);
  const changeInstrument = (next: "telescope" | "microscope") => { setPlaying(false); setInstrument(next); setObjectiveF(next === "telescope" ? 60 : 16); setEyepieceF(next === "telescope" ? 10 : 8); interact(); recordHarness("configuration.changed", { experiment: "instruments", control: "光学仪器", value: next }); };
  const magnification = instrument === "telescope" ? objectiveF / eyepieceF : (160 / Math.max(8, objectiveF)) * (250 / eyepieceF);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = 0;
    const animate = (now: number) => {
      if (now - last > 55) {
        if (instrument === "telescope") {
          setObjectiveF(65 + Math.sin(now / 1100) * 25);
          setEyepieceF(11 + Math.cos(now / 1450) * 4);
        } else {
          setObjectiveF(17 + Math.sin(now / 1250) * 7);
          setEyepieceF(10 + Math.cos(now / 1500) * 4);
        }
        last = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [instrument, playing]);
  return <div className="open-experience">
    <ModuleIntro eyebrow="TWO-LENS SYSTEM / 组合实验" title="把两块透镜组合，视野会延伸到哪里？" text="初始视野与放大读数保持关闭。选择仪器并改变两块透镜的焦距，结果才随操作显现。" action={<MotionButton running={playing} onClick={() => setPlaying((value) => !value)} label="自动比较焦距" onInteract={interact} />} />
    <div className="instrument-switch"><button className={instrument === "telescope" ? "active" : ""} onClick={() => changeInstrument("telescope")}><Telescope size={23} /><span>望远镜</span></button><button className={instrument === "microscope" ? "active" : ""} onClick={() => changeInstrument("microscope")}><Microscope size={23} /><span>显微镜</span></button></div>
    <LensDimensionSwitch mode={viewMode} apparatus="instruments" onChange={(next) => { setViewMode(next); interact(); }} />
    {viewMode === "3d" ? <LensSystem3DView onUse2D={() => setViewMode("2d")} apparatus={instrument} objectDistance={instrument === "telescope" ? 1200 : 28} focalLength={objectiveF} imageDistance={objectiveF * 1.25} magnification={-Math.min(2.2, magnification / 8)} real nature={instrument === "telescope" ? "物镜先成中间像，目镜放大视角" : "物镜先成放大实像，目镜再次放大"} interacted={interacted} secondFocalLength={eyepieceF} onInteract={interact} /> : <div className={`instrument-lab ${instrument}`}><div className="instrument-object">{instrument === "telescope" ? <Moon aria-hidden="true" /> : <Dna aria-hidden="true" />}<span>{instrument === "telescope" ? "遥远的月球" : "微小的细胞"}</span></div><div className={`double-lens moving-beams ${interacted ? "" : "paused-beams"}`}><i /><b /><i /><b /><span className="instrument-photon first" /><span className="instrument-photon second" /></div><div className={`instrument-view ${interacted ? "" : "awaiting-reading"}`}>{instrument === "telescope" ? <Moon aria-label="目镜中的月球像" style={{ transform: `scale(${interacted ? Math.min(2.4, .65 + magnification / 10) : .7})`, filter: interacted ? "none" : "blur(7px)" }} /> : <Dna aria-label="目镜中的细胞结构示意" style={{ transform: `scale(${interacted ? Math.min(2.4, .65 + magnification / 10) : .7})`, filter: interacted ? "none" : "blur(7px)" }} />}</div><div className={`magnification-readout ${interacted ? "" : "awaiting-reading"}`}><small>{interacted ? playing ? "正在动态比较" : "本次简化读数" : "等待透镜调节"}</small><strong>{interacted ? `${magnification.toFixed(1)}×` : "— —"}</strong></div>{!interacted && <OpticsInteractionCue text="选择仪器或改变任一焦距" />}</div>}
    <LensReadingStrip active={interacted} entries={[{ label: "当前仪器", value: instrument === "telescope" ? "望远镜" : "显微镜", note: instrument === "telescope" ? "观察遥远目标" : "观察微小近物" }, { label: "物镜焦距", value: `${objectiveF.toFixed(1)} mm`, note: "物镜首先形成中间像" }, { label: "目镜焦距", value: `${eyepieceF.toFixed(1)} mm`, note: "目镜继续放大观察视角" }, { label: "简化放大率", value: `${magnification.toFixed(1)}×`, note: playing ? "正在连续比较焦距组合" : "调节两块透镜继续比较", tone: "accent" }]} />
    <div className="open-control-deck"><RangeControl label="物镜焦距" value={objectiveF} min={instrument === "telescope" ? 30 : 8} max={instrument === "telescope" ? 100 : 30} step={1} unit="mm" onChange={(value) => { setPlaying(false); setObjectiveF(value); }} onInteract={interact} /><RangeControl label="目镜焦距" value={eyepieceF} min={5} max={20} step={1} unit="mm" onChange={(value) => { setPlaying(false); setEyepieceF(value); }} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "自由比较 · 来自你的操作" : "还没有比较记录"}</span><strong>{interacted ? "继续改变两块透镜焦距" : "先选择并调节一套组合"}</strong><p>{interacted ? "哪种组合能得到更大的视角？" : "结果不会在操作之前显示。"}</p></div></div>
    <LensModuleGuide apparatus="instruments" />
  </div>;
}
