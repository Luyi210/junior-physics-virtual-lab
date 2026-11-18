import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useMemo } from "react";
import { RotateCcw, ThermometerSun, ScanLine, ShieldCheck } from "lucide-react";
import { ModuleIntro, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";

type InvisibleSpectrum = "infrared" | "ultraviolet";

type InvisibleApplication = "remote" | "thermal" | "night" | "banknote" | "surface" | "protection";

const invisibleApplications: Record<InvisibleSpectrum, Array<{ key: InvisibleApplication; title: string; note: string; result: string }>> = {
  infrared: [
    { key: "remote", title: "电视遥控", note: "遥控器发出编码红外信号，接收器把它转换成控制指令。", result: "红外接收器收到控制信号" },
    { key: "thermal", title: "热成像", note: "温度不同的物体向外辐射红外线，探测器据此形成温度分布图。", result: "热成像仪识别出温度差异" },
    { key: "night", title: "夜间感应", note: "人体与环境的红外辐射存在差异，感应器可用它发现夜间活动。", result: "感应器发现移动的热目标" }
  ],
  ultraviolet: [
    { key: "banknote", title: "紫外验钞", note: "特定材料吸收紫外线后会发出可见荧光，可帮助识别防伪标记。", result: "防伪图案发出可见荧光" },
    { key: "surface", title: "表面处理", note: "适量紫外线可用于特定环境的表面处理，但效果取决于波段、强度和时间。", result: "到达目标表面的紫外强度增加" },
    { key: "protection", title: "防晒防护", note: "遮阳材料和防晒用品可以吸收或反射部分紫外线，降低到达皮肤的强度。", result: "防护层削弱了到达目标的紫外线" }
  ]
};

type InfraredBarrier = "none" | "paper" | "glass" | "wood";

type ThermalPalette = "iron" | "gray" | "rainbow";

type FluorescentSample = "banknote" | "fabric" | "mineral";

type UvShield = "none" | "glass" | "sunglasses" | "cloth";

const infraredBarrierTransmission: Record<InfraredBarrier, number> = { none: 1, paper: .52, glass: .68, wood: .04 };

const fluorescentResponse: Record<FluorescentSample, number> = { banknote: .95, fabric: .62, mineral: .78 };

const uvShieldTransmission: Record<UvShield, number> = { none: 1, glass: .64, sunglasses: .24, cloth: .08 };

export function InvisibleLightModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [spectrum, setSpectrum] = useState<InvisibleSpectrum>("infrared");
  const [application, setApplication] = useState<InvisibleApplication>("remote");
  const [power, setPower] = useState(0);
  const [distance, setDistance] = useState(3);
  const [barrier, setBarrier] = useState<InfraredBarrier>("none");
  const [targetTemperature, setTargetTemperature] = useState(36);
  const [ambientTemperature, setAmbientTemperature] = useState(22);
  const [sensitivity, setSensitivity] = useState(55);
  const [palette, setPalette] = useState<ThermalPalette>("iron");
  const [sample, setSample] = useState<FluorescentSample>("banknote");
  const [exposureTime, setExposureTime] = useState(20);
  const [shield, setShield] = useState<UvShield>("none");
  const [interacted, setInteracted] = useState(false);
  const applications = invisibleApplications[spectrum];
  const current = applications.find((item) => item.key === application) ?? applications[0]!;

  const measurement = useMemo(() => {
    const distanceFactor = Math.max(.18, 1 - (distance - 1) * .105);
    if (application === "remote") {
      const received = Math.round(power * distanceFactor * infraredBarrierTransmission[barrier]);
      return { active: interacted && power > 0, response: received, observable: received >= 18, emitted: `${power}%`, middleLabel: "接收信号", middleValue: `${received}%`, lastLabel: "指令状态", lastValue: received >= 18 ? "已识别" : "未识别", status: received >= 18 ? "遥控指令被接收器识别" : "信号未达到稳定识别范围" };
    }
    if (application === "thermal") {
      const contrast = Math.abs(targetTemperature - ambientTemperature);
      const response = Math.min(100, Math.round(contrast * (0.7 + sensitivity / 100) * 4.2));
      return { active: interacted, response, observable: response >= 15, emitted: `${targetTemperature.toFixed(1)}℃`, middleLabel: "目标与背景温差", middleValue: `${contrast.toFixed(1)}℃`, lastLabel: "图像对比度", lastValue: `${response}%`, status: response >= 15 ? "热成像中已经能区分目标轮廓" : "目标温度接近背景，轮廓不明显" };
    }
    if (application === "night") {
      const contrast = Math.abs(36.5 - ambientTemperature);
      const response = Math.min(100, Math.round(contrast * (sensitivity / 100) * distanceFactor * 8));
      return { active: interacted, response, observable: response >= 20, emitted: "36.5℃", middleLabel: "人体与环境温差", middleValue: `${contrast.toFixed(1)}℃`, lastLabel: "感应响应", lastValue: `${response}%`, status: response >= 20 ? "红外感应器发现热目标变化" : "温差或灵敏度不足，暂未触发" };
    }
    if (application === "banknote") {
      const response = Math.round(power * fluorescentResponse[sample]);
      return { active: interacted && power > 0, response, observable: response >= 16, emitted: `${power}%`, middleLabel: "荧光响应", middleValue: `${response}%`, lastLabel: "可见结果", lastValue: response >= 16 ? "已显现" : "不明显", status: response >= 16 ? "样品把紫外响应转成了可见荧光" : "荧光太弱，肉眼暂时难以分辨" };
    }
    if (application === "surface") {
      const dose = Math.round(power * exposureTime / 60);
      return { active: interacted && power > 0 && exposureTime > 0, response: Math.min(100, dose), observable: dose >= 20, emitted: `${power}%`, middleLabel: "照射时间", middleValue: `${exposureTime}s`, lastLabel: "相对剂量", lastValue: `${dose}`, status: dose >= 20 ? "相对剂量正在累积，目标表面响应增强" : "当前相对剂量较低，继续比较强度与时间" };
    }
    const transmitted = Math.round(power * uvShieldTransmission[shield]);
    return { active: interacted && power > 0, response: transmitted, observable: shield !== "none" && transmitted < power * .7, emitted: `${power}%`, middleLabel: "透过强度", middleValue: `${transmitted}%`, lastLabel: "削弱比例", lastValue: `${power === 0 ? 0 : Math.round((1 - transmitted / power) * 100)}%`, status: shield === "none" ? "没有防护材料，紫外线直接到达目标" : transmitted < power * .7 ? "防护材料明显削弱了紫外线" : "材料只削弱了部分紫外线" };
  }, [ambientTemperature, application, barrier, distance, exposureTime, interacted, power, sample, sensitivity, shield, targetTemperature]);

  const active = measurement.active;
  const targetOpacity = active ? Math.max(.1, measurement.response / 100) : .07;
  const beamStrength = application === "thermal" || application === "night" ? measurement.response : power;
  const paletteColors: Record<ThermalPalette, [string, string, string]> = { iron: ["#fff3a7", "#ff7655", "#45235d"], gray: ["#ffffff", "#9da9ad", "#26343b"], rainbow: ["#ffef55", "#4ee6ac", "#533ec5"] };
  const thermalColors = paletteColors[palette];

  const chooseSpectrum = (next: InvisibleSpectrum) => {
    const nextApplication = invisibleApplications[next][0]!.key;
    setSpectrum(next);
    setApplication(nextApplication);
    setPower(0);
    setInteracted(false);
    recordHarness("configuration.changed", { experiment: "invisible-light", control: "光的类型", value: next });
  };
  const chooseApplication = (next: InvisibleApplication) => {
    setApplication(next);
    setPower(0);
    setInteracted(false);
    recordHarness("configuration.changed", { experiment: "invisible-light", control: "生活应用", value: next, spectrum });
  };
  const reset = () => {
    setPower(0); setDistance(3); setBarrier("none"); setTargetTemperature(36); setAmbientTemperature(22); setSensitivity(55); setPalette("iron"); setSample("banknote"); setExposureTime(20); setShield("none"); setInteracted(false);
    recordHarness("simulation.toggled", { experiment: "invisible-light", running: false, action: "重置双频观察站" });
  };
  const interact = () => setInteracted(true);

  return <div className="open-experience invisible-light-experience">
    <ModuleIntro eyebrow="第三章 · 人眼看不见的光" title="打开一座红外线与紫外线生活观察站" text="这不再是一张不可见光示意图，而是六套具有不同变量的生活实验。学生需要选择仪器、样品或材料，再调节温度、距离、强度与时间，让设备把不可见信号转换成读数和画面。" action={<button onClick={reset}><RotateCcw size={15} />重置观察站</button>} />
    <section className="electromagnetic-map" aria-label="红外线可见光紫外线波段关系">
      <header><span>SPECTRUM MAP / 波段关系</span><strong>人眼只能看见电磁波谱中的一小段</strong><small>示意比例并非按真实波长等比例绘制</small></header>
      <div><button className={spectrum === "ultraviolet" ? "active" : ""} onClick={() => chooseSpectrum("ultraviolet")}><b>紫外线</b><span>约 10–400 nm</span><small>荧光 · 检测 · 防护</small></button><i className="visible-band"><span>可见光</span></i><button className={spectrum === "infrared" ? "active" : ""} onClick={() => chooseSpectrum("infrared")}><b>红外线</b><span>约 780 nm–1 mm</span><small>热辐射 · 通信 · 感应</small></button></div>
    </section>
    <div className="medium-tabs invisible-spectrum-tabs" aria-label="选择不可见光类型">
      <button className={spectrum === "infrared" ? "active infrared" : ""} onClick={() => chooseSpectrum("infrared")}><ThermometerSun size={18} />红外实验室 · 信号与温度</button>
      <button className={spectrum === "ultraviolet" ? "active ultraviolet" : ""} onClick={() => chooseSpectrum("ultraviolet")}><ScanLine size={18} />紫外实验室 · 荧光与防护</button>
    </div>
    <div className="invisible-application-picker" aria-label="选择生活应用">
      {applications.map((item, index) => <button className={application === item.key ? "active" : ""} onClick={() => chooseApplication(item.key)} key={item.key}><b>0{index + 1}</b><strong>{item.title}</strong><small>{item.note}</small></button>)}
    </div>
    <div className={`invisible-light-lab spectrum-${spectrum} scene-${application}`}>
      <div className="invisible-spectrum-ruler" aria-hidden="true"><span>{spectrum === "infrared" ? "长于可见红光" : "短于可见紫光"}</span><i /><strong>{current.title}</strong><i /><span>{active ? "仪器正在读数" : "等待操作"}</span></div>
      <svg viewBox="0 0 900 470" role="img" aria-label={`${current.title}中的${spectrum === "infrared" ? "红外线" : "紫外线"}动态实验`}>
        <defs>
          <linearGradient id="infraredBeam" x1="0" x2="1"><stop stopColor="#ffcc70" /><stop offset=".5" stopColor="#ff694e" /><stop offset="1" stopColor="#a92d63" /></linearGradient>
          <linearGradient id="ultravioletBeam" x1="0" x2="1"><stop stopColor="#75d7ff" /><stop offset=".5" stopColor="#8c66ff" /><stop offset="1" stopColor="#e782ff" /></linearGradient>
          <radialGradient id="thermalTarget"><stop stopColor={thermalColors[0]} /><stop offset=".45" stopColor={thermalColors[1]} /><stop offset="1" stopColor={thermalColors[2]} /></radialGradient>
          <filter id="invisibleGlow"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>
        <g className="invisible-grid">{Array.from({ length: 16 }, (_, index) => <line x1={35 + index * 56} x2={35 + index * 56} y1="70" y2="430" key={`iv-${index}`} />)}{Array.from({ length: 7 }, (_, index) => <line x1="35" x2="865" y1={90 + index * 55} y2={90 + index * 55} key={`ih-${index}`} />)}</g>
        {application === "remote" && <g className="invisible-source" transform="translate(135 245)"><circle r="61" /><circle r="34" /><path d="M-18 -10 L22 0 L-18 10 Z" /><text x="-49" y="92">遥控器红外发射端</text></g>}
        {(application === "thermal" || application === "night") && <g className="heat-body-source" transform="translate(125 120)"><circle cx="65" cy="55" r="38" style={{ fill: thermalColors[0] }} /><path d="M20 285 Q23 108 65 105 Q108 108 112 285 Z" style={{ fill: "url(#thermalTarget)" }} /><text x="12" y="322">发出红外辐射的目标</text></g>}
        {spectrum === "ultraviolet" && <g className="uv-lamp-source" transform="translate(88 145)"><rect width="105" height="190" rx="12" /><rect x="22" y="35" width="61" height="106" rx="28" /><path d="M25 161 H80" /><text x="14" y="220">封闭式紫外光源</text></g>}
        <path className="invisible-beam-halo" d="M190 205 L650 150 L650 340 L190 285 Z" style={{ opacity: active ? beamStrength / 180 : 0, fill: spectrum === "infrared" ? "url(#infraredBeam)" : "url(#ultravioletBeam)" }} />
        <path className="invisible-beam-core" d="M190 245 L650 245" style={{ opacity: active ? .25 + measurement.response / 150 : 0, stroke: spectrum === "infrared" ? "#ff7655" : "#a989ff" }} />
        {active && Array.from({ length: 7 }, (_, index) => <circle className="invisible-photon" cx={230 + index * 58} cy="245" r={3.5 + Math.min(3, beamStrength / 38)} style={{ animationDelay: `${index * -.22}s`, fill: spectrum === "infrared" ? "#ffad63" : "#c19aff" }} key={index} />)}
        {application === "remote" && barrier !== "none" && <g className={`beam-barrier barrier-${barrier}`} transform="translate(505 130)"><rect width="25" height="230" rx="4" /><text x="-20" y="258">{barrier === "paper" ? "纸板" : barrier === "glass" ? "普通玻璃" : "木板"}</text></g>}
        {application === "remote" && <g className="invisible-target remote-target" transform="translate(675 135)"><rect width="150" height="205" rx="8" /><rect x="15" y="18" width="120" height="130" rx="3" /><circle cx="75" cy="175" r="9" style={{ opacity: targetOpacity }} /><text x="28" y="232">电视红外接收器</text></g>}
        {application === "thermal" && <g className="invisible-target thermal-target" transform="translate(670 120)"><rect width="165" height="240" rx="5" /><circle cx="82" cy="72" r="29" fill="url(#thermalTarget)" opacity={targetOpacity} /><path d="M45 192 Q50 110 82 108 Q115 110 120 192 Z" fill="url(#thermalTarget)" opacity={targetOpacity} /><path className="scan-line" d="M15 92 H150" /><text x="31" y="266">热成像探测器</text></g>}
        {application === "night" && <g className="invisible-target night-target" transform="translate(665 135)"><path d="M10 105 L85 35 L160 105 V210 H10 Z" /><circle cx="85" cy="132" r="30" style={{ opacity: targetOpacity }} /><path d="M70 132 Q85 116 100 132 Q85 148 70 132 Z" /><text x="24" y="238">被动红外感应器</text></g>}
        {application === "banknote" && <g className={`invisible-target banknote-target sample-${sample}`} transform="translate(645 155)"><rect width="195" height="135" rx="8" /><circle cx="97" cy="67" r="33" style={{ opacity: targetOpacity }} /><path d="M28 34 H66 M128 100 H168 M26 102 L58 70" style={{ opacity: targetOpacity }} /><text x="35" y="167">{sample === "banknote" ? "钞票防伪标记" : sample === "fabric" ? "白色织物样品" : "荧光矿物样品"}</text></g>}
        {application === "surface" && <g className="invisible-target surface-target" transform="translate(655 145)"><rect x="5" y="120" width="185" height="30" rx="4" /><path d="M32 118 Q36 45 58 30 Q80 58 82 118 M105 118 Q112 58 136 43 Q158 69 160 118" style={{ opacity: Math.max(.08, 1 - measurement.response / 105) }} /><circle cx="58" cy="77" r="9" style={{ opacity: Math.max(.08, 1 - measurement.response / 100) }} /><circle cx="136" cy="83" r="8" style={{ opacity: Math.max(.08, 1 - measurement.response / 100) }} /><text x="37" y="184">相对剂量模拟区</text></g>}
        {application === "protection" && <g className="invisible-target protection-target" transform="translate(660 115)"><path d="M83 20 L155 48 V115 Q155 190 83 224 Q11 190 11 115 V48 Z" style={{ opacity: shield === "none" ? .1 : .45 + (1 - uvShieldTransmission[shield]) / 2 }} /><circle cx="83" cy="93" r="27" style={{ opacity: targetOpacity }} /><path d="M50 180 Q55 125 83 125 Q112 125 117 180 Z" style={{ opacity: targetOpacity }} /><text x="15" y="254">材料后的紫外探测器</text></g>}
      </svg>
      {!interacted && <OpticsInteractionCue text="选择器材或改变一个实验变量" />}
      <div className={`law-readout invisible-readout ${active ? "" : "awaiting-reading"}`}><span>{active ? spectrum === "infrared" ? "INFRARED INSTRUMENT READING" : "ULTRAVIOLET INSTRUMENT READING" : "INVISIBLE SPECTRUM STANDBY"}</span><strong>{active ? measurement.status : "实验装置等待第一次操作"}</strong><small>{active ? current.note : "不能用眼睛直接判断不可见光，应观察仪器或材料响应"}</small></div>
    </div>
    <div className={`invisible-meter-rack meter-${spectrum}`} aria-label="实时仪器读数">
      <div><span>{application === "thermal" ? "目标温度" : application === "night" ? "人体温度" : "发射端"}</span><strong>{active ? measurement.emitted : "— —"}</strong><small>INPUT / 输入</small></div>
      <div><span>{measurement.middleLabel}</span><strong>{active ? measurement.middleValue : "— —"}</strong><small>MEASURE / 测量</small></div>
      <div className={measurement.observable && active ? "detected" : ""}><span>{measurement.lastLabel}</span><strong>{active ? measurement.lastValue : "— —"}</strong><small>RESPONSE / 响应</small></div>
    </div>
    <div className={`open-control-deck invisible-controls controls-${application}`}>
      {application === "remote" && <><RangeControl label="红外发射强度" value={power} min={0} max={100} step={5} unit="%" onChange={setPower} onInteract={interact} /><RangeControl label="遥控距离" value={distance} min={1} max={8} step={.5} unit="m" onChange={setDistance} onInteract={interact} /><InvisibleChoiceControl label="光路中的遮挡物" value={barrier} options={[{ key: "none", label: "无遮挡" }, { key: "paper", label: "纸板" }, { key: "glass", label: "玻璃" }, { key: "wood", label: "木板" }]} onChange={(value) => { setBarrier(value as InfraredBarrier); interact(); }} /></>}
      {application === "thermal" && <><RangeControl label="目标温度" value={targetTemperature} min={15} max={55} step={.5} unit="℃" onChange={setTargetTemperature} onInteract={interact} /><RangeControl label="背景温度" value={ambientTemperature} min={5} max={40} step={.5} unit="℃" onChange={setAmbientTemperature} onInteract={interact} /><InvisibleChoiceControl label="热成像配色" value={palette} options={[{ key: "iron", label: "铁红" }, { key: "gray", label: "灰度" }, { key: "rainbow", label: "彩虹" }]} onChange={(value) => { setPalette(value as ThermalPalette); interact(); }} /></>}
      {application === "night" && <><RangeControl label="环境温度" value={ambientTemperature} min={5} max={38} step={.5} unit="℃" onChange={setAmbientTemperature} onInteract={interact} /><RangeControl label="目标距离" value={distance} min={1} max={8} step={.5} unit="m" onChange={setDistance} onInteract={interact} /><RangeControl label="传感器灵敏度" value={sensitivity} min={10} max={100} step={5} unit="%" onChange={setSensitivity} onInteract={interact} /></>}
      {application === "banknote" && <><RangeControl label="紫外发射强度" value={power} min={0} max={100} step={5} unit="%" onChange={setPower} onInteract={interact} /><InvisibleChoiceControl label="观察样品" value={sample} options={[{ key: "banknote", label: "钞票" }, { key: "fabric", label: "白织物" }, { key: "mineral", label: "荧光矿物" }]} onChange={(value) => { setSample(value as FluorescentSample); interact(); }} /><div className="invisible-method-card"><span>观察方法</span><strong>比较开灯前后，而不是直接看光源</strong><p>紫外线本身不可见，看到的是样品发出的可见荧光。</p></div></>}
      {application === "surface" && <><RangeControl label="紫外发射强度" value={power} min={0} max={100} step={5} unit="%" onChange={setPower} onInteract={interact} /><RangeControl label="照射时间" value={exposureTime} min={0} max={60} step={2} unit="s" onChange={setExposureTime} onInteract={interact} /><div className="invisible-method-card"><span>简化模型</span><strong>相对剂量 = 强度 × 时间</strong><p>这里只比较变量关系，不代表真实消毒效果或操作标准。</p></div></>}
      {application === "protection" && <><RangeControl label="入射紫外强度" value={power} min={0} max={100} step={5} unit="%" onChange={setPower} onInteract={interact} /><InvisibleChoiceControl label="防护材料" value={shield} options={[{ key: "none", label: "无材料" }, { key: "glass", label: "普通玻璃" }, { key: "sunglasses", label: "防护镜片" }, { key: "cloth", label: "致密织物" }]} onChange={(value) => { setShield(value as UvShield); interact(); }} /><div className="invisible-method-card"><span>比较原则</span><strong>保持入射强度不变，只替换材料</strong><p>模拟值用于趋势比较，实际防护能力以产品检测标识为准。</p></div></>}
      <div className={`observation-output ${active ? "" : "awaiting-reading"}`}><span>生活应用 · {current.title}</span><strong>{active ? measurement.status : "等待操作后生成观察"}</strong><p>{current.note}</p></div>
    </div>
    <section className="invisible-inquiry-strip"><div><span>可以继续追问</span><strong>遥控器的光为什么用手机摄像头有时能看见？</strong><p>摄像头传感器对部分近红外线有响应，再由屏幕把电信号显示成可见亮点；不同设备的红外截止滤镜效果不同。</p></div><div><span>容易混淆</span><strong>热成像不是“看见温度颜色”</strong><p>探测器接收红外辐射后计算并着色。画面颜色是人为选定的调色板，不是物体真正发出的可见颜色。</p></div><div><span>实验安全</span><strong>紫外线实验必须观察响应，不直视光源</strong><p>真实课堂应使用封闭式装置或传感器。模拟平台用于理解规律，不能替代安全规范。</p></div></section>
    <section className="dispersion-guide invisible-light-guide" aria-label="红外线与紫外线生活应用说明">
      <header><span>LIFE APPLICATION GUIDE / 生活应用说明</span><h2>看不见，不等于不存在</h2><p>红外线和紫外线都位于可见光之外。六个实验分别利用了信号接收、温度对比、材料荧光、剂量累积和透过率变化，让不可见光留下能够比较的证据。</p></header>
      <div>
        <article><i><ThermometerSun size={19} /></i><span><small>01 · 红外线</small><strong>既能传递信号，也能反映热辐射差异</strong><p>遥控器使用红外线传递编码；热成像和感应器则接收物体发出的红外辐射。两类应用都属于红外技术，但工作目的并不相同。</p></span></article>
        <article><i><ScanLine size={19} /></i><span><small>02 · 紫外线</small><strong>通过材料响应间接观察</strong><p>荧光材料能把紫外响应转成可见光；防护材料会改变透过强度；表面处理还与照射时间有关，不能只看是否“打开光源”。</p></span></article>
        <article><i><ShieldCheck size={19} /></i><span><small>03 · 科学方法</small><strong>一次只改变一个变量</strong><p>固定发射强度再改变距离或材料，固定材料再改变强度，才能判断究竟是哪一个条件影响了探测结果。</p></span></article>
      </div>
      <footer><b>建议路线：</b>先做红外遥控，认识“发射—传播—接收”；再做热成像，理解“不可见信号—传感器—伪彩色图”；最后用紫外防护比较材料透过率。</footer>
    </section>
  </div>;
}

function InvisibleChoiceControl({ label, value, options, onChange }: { label: string; value: string; options: Array<{ key: string; label: string }>; onChange: (value: string) => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const change = (next: string) => { onChange(next); recordHarness("configuration.changed", { experiment: "invisible-light", control: label, value: next }); };
  return <div className="invisible-choice-control"><span>{label}</span><div>{options.map((option) => <button className={value === option.key ? "active" : ""} onClick={() => change(option.key)} key={option.key}>{option.label}</button>)}</div></div>;
}
