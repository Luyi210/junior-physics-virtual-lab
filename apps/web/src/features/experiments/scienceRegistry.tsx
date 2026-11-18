import { lazy, Suspense } from "react";
import { Info, Play, Eye } from "lucide-react";
import { type FieldKey, type ScienceModuleMeta } from "./catalog/scienceCatalog";
import { SoundLab } from "./sound/SoundFeaturesLab";
import { SoundConceptLab } from "./sound/SoundPropagationLabs";
import { CampusNoiseChallenge } from "./sound/CampusNoiseChallenge";
import { AuditoriumAcousticsLab } from "./sound/AuditoriumAcousticsLab";
import { LiveMicrophoneLab } from "./sound/LiveMicrophoneLab";
import { SpeedLab } from "./mechanics/SpeedLab";
import { FrictionLab } from "./mechanics/FrictionLab";
import { LeverLab } from "./mechanics/LeverLab";
import { PressureLab } from "./mechanics/PressureLab";
import { BuoyancyLab } from "./mechanics/BuoyancyLab";
import { CircuitLab } from "./circuit/CircuitLab";
import { OhmLawLab } from "./circuit/OhmLawLab";
import { ElectricPowerLab } from "./circuit/ElectricPowerLab";
import { ElectromagnetLab } from "./circuit/ElectromagnetLab";
import { ThermometerLab } from "./thermal/ThermometerLab";
import { ThermalLab } from "./thermal/BoilingLab";
import { MeltingLab } from "./thermal/MeltingLab";
import { EvaporationLab } from "./thermal/EvaporationLab";
import { BalanceMeasurementLab } from "./measurement/BalanceMeasurementLab";
import { ScienceModuleLoading } from "./shared/ScienceModuleLoading";
import { DensityLab } from "./measurement/DensityLab";
import { LiquidDensityLab } from "./measurement/LiquidDensityLab";

const MassVolumeInvestigationLab = lazy(async () => {
  const module = await import("./measurement/MassVolumeInvestigationLab");
  return { default: module.MassVolumeInvestigationLab };
});

export function ScienceModuleExperience({ field, module }: { field: FieldKey; module: ScienceModuleMeta }) {
  const core = renderScienceLab(module);
  return <div className="science-module-experience" key={module.key}>{core}<ScienceModuleReading module={module} /></div>;
}

function renderScienceLab(module: ScienceModuleMeta): React.ReactNode {
  switch (module.key) {
    case "sound-features": return <SoundLab />;
    case "sound-medium": case "sound-noise": case "sound-echo": return <SoundConceptLab module={module} />;
    case "sound-campus": return <CampusNoiseChallenge />;
    case "sound-auditorium": return <AuditoriumAcousticsLab />;
    case "sound-microphone": return <LiveMicrophoneLab />;
    case "mechanics-speed": return <SpeedLab />;
    case "mechanics-friction": return <FrictionLab />;
    case "mechanics-lever": return <LeverLab />;
    case "mechanics-pressure": return <PressureLab />;
    case "mechanics-buoyancy": return <BuoyancyLab />;
    case "circuit-basic": return <CircuitLab />;
    case "circuit-ohm": return <OhmLawLab />;
    case "circuit-power": return <ElectricPowerLab />;
    case "circuit-magnet": return <ElectromagnetLab />;
    case "thermal-thermometer": return <ThermometerLab />;
    case "thermal-boiling": return <ThermalLab />;
    case "thermal-melting": return <MeltingLab />;
    case "thermal-evaporation": return <EvaporationLab />;
    case "measurement-balance": return <BalanceMeasurementLab />;
    case "measurement-mass-volume": return <Suspense fallback={<ScienceModuleLoading title="质量—体积探究装置" />}><MassVolumeInvestigationLab /></Suspense>;
    case "measurement-density": return <DensityLab />;
    case "measurement-liquid-density": return <LiquidDensityLab />;
    default: return assertNeverScienceLab(module.key);
  }
}

function assertNeverScienceLab(key: never): never {
  throw new Error(`未配置独立实验台：${String(key)}`);
}

function ScienceModuleReading({ module }: { module: ScienceModuleMeta }) {
  const ModuleIcon = module.icon;
  return <>
    <section className="science-experiment-guide" data-tutorial-spotlight="explanation" aria-label={`${module.title}实验说明`}>
      <header><span>EXPERIMENT GUIDE / 实验说明</span><h2>这个实验研究什么？应该怎样比较？</h2><p>{module.chapter} · {module.note}。实验不会要求按固定任务闯关，可以自由改变参数，但比较规律时建议一次只改变一个条件。</p></header>
      <div>
        <article><i><Info size={19} /></i><span><small>01 · 这是什么</small><strong>确定实验对象</strong><p>{module.guide[0]}</p></span></article>
        <article><i><Play size={19} /></i><span><small>02 · 怎么操作</small><strong>主动改变条件</strong><p>{module.guide[1]}</p></span></article>
        <article><i><Eye size={19} /></i><span><small>03 · 观察什么</small><strong>从现象寻找关系</strong><p>{module.guide[2]}</p></span></article>
      </div>
      <footer><b>开放问题：</b>{module.question}</footer>
    </section>
    <section className="science-life-application" data-tutorial-spotlight="application" aria-label={`${module.title}生活应用`}>
      <header><div><span>PHYSICS IN LIFE / 生活中的物理</span><h2>课本规律离开实验台以后，仍在真实世界里工作。</h2></div><ModuleIcon size={34} /></header>
      <div>{module.life.map((item, index) => <article key={item.title}><b>{String(index + 1).padStart(2, "0")}</b><i><ModuleIcon size={20} /></i><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </section>
  </>;
}
