type ReflectionDiagramProps = {
  angle: number;
  roughness: number;
  interacted: boolean;
};

type RefractionDiagramProps = {
  angle: number;
  refractionAngle: number | null;
  totalInternalReflection: boolean;
  topMedium: string;
  bottomMedium: string;
  interacted: boolean;
};

type PlaneMirrorDiagramProps = {
  objectDistance: number;
  observerPosition: number;
  screenPlaced: boolean;
  interacted: boolean;
};

const radians = (degrees: number) => degrees * Math.PI / 180;

export function ReflectionDiagram2D({ angle, roughness, interacted }: ReflectionDiagramProps) {
  const centerX = 450;
  const surfaceY = 300;
  const rayLength = 238;
  const rayRadians = radians(angle);
  const incident = { x: centerX - Math.sin(rayRadians) * rayLength, y: surfaceY - Math.cos(rayRadians) * rayLength };
  const reflected = { x: centerX + Math.sin(rayRadians) * rayLength, y: surfaceY - Math.cos(rayRadians) * rayLength };
  const arcRadius = 62;
  const leftArc = { x: centerX - Math.sin(rayRadians) * arcRadius, y: surfaceY - Math.cos(rayRadians) * arcRadius };
  const rightArc = { x: centerX + Math.sin(rayRadians) * arcRadius, y: surfaceY - Math.cos(rayRadians) * arcRadius };
  const roughAmplitude = roughness / 11;
  const surfacePoints = Array.from({ length: 37 }, (_, index) => {
    const x = 90 + index * 20;
    const y = surfaceY + Math.sin(index * 1.71) * roughAmplitude * .62 + Math.cos(index * 2.37) * roughAmplitude * .38;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const scatterAngles = [-1.55, -.82, .72, 1.42].map((offset) => Math.max(-78, Math.min(78, angle + offset * roughness / 2.7)));
  const idealOpacity = Math.max(.16, 1 - roughness / 108);

  return <svg className="law-diagram-2d" viewBox="0 0 900 470" role="img" aria-label="光的反射二维测量图">
    <g className="ray-grid">{Array.from({ length: 17 }, (_, index) => <line x1={50 + index * 50} x2={50 + index * 50} y1="35" y2="420" key={`rv-${index}`} />)}{Array.from({ length: 8 }, (_, index) => <line x1="40" x2="860" y1={50 + index * 50} y2={50 + index * 50} key={`rh-${index}`} />)}</g>
    <text className="law-stage-kicker" x="58" y="69">2D PROTRACTOR / 二维量角视图</text>
    <line className="normal-line" x1={centerX} y1="54" x2={centerX} y2="378" />
    <text className="medium-label" x={centerX + 13} y="78">法线 N</text>
    <polyline className={`law-reflecting-surface ${roughness >= 12 ? "rough" : "smooth"}`} points={surfacePoints} />
    <text className="medium-label" x="104" y="340">{roughness < 12 ? "光滑反射面" : "粗糙反射面（局部法线方向不同）"}</text>
    <circle className="incidence-point" cx={centerX} cy={surfaceY} r="6" />
    {interacted && <>
      <path className="incident-ray" d={`M${incident.x} ${incident.y} L${centerX} ${surfaceY}`} markerEnd="url(#optics-ray-arrow)" />
      <path className="reflected-ray ideal-reflection" style={{ opacity: idealOpacity }} d={`M${centerX} ${surfaceY} L${reflected.x} ${reflected.y}`} markerEnd="url(#optics-ray-arrow)" />
      {roughness >= 12 && scatterAngles.map((scatterAngle, index) => {
        const scatterRadians = radians(scatterAngle);
        const length = 176 + index * 13;
        const endX = centerX + Math.sin(scatterRadians) * length;
        const endY = surfaceY - Math.cos(scatterRadians) * length;
        return <path className="scattered-ray" style={{ opacity: .24 + roughness / 260 }} d={`M${centerX} ${surfaceY} L${endX} ${endY}`} markerEnd="url(#optics-ray-arrow-small)" key={`${scatterAngle}-${index}`} />;
      })}
      <path className="angle-arc" d={`M${centerX} ${surfaceY - arcRadius} A${arcRadius} ${arcRadius} 0 0 0 ${leftArc.x} ${leftArc.y}`} />
      <path className="angle-arc reflected" d={`M${centerX} ${surfaceY - arcRadius} A${arcRadius} ${arcRadius} 0 0 1 ${rightArc.x} ${rightArc.y}`} />
      <text className="angle-label" x={centerX - 86} y={surfaceY - 86}>入射角 i = {angle.toFixed(0)}°</text>
      <text className="angle-label reflected" x={centerX + 31} y={surfaceY - 86}>反射角 r = {angle.toFixed(0)}°</text>
      <text className="ray-name incident" x={incident.x - 22} y={incident.y - 12}>入射光</text>
      <text className="ray-name reflected" x={reflected.x - 12} y={reflected.y - 12}>{roughness < 12 ? "反射光" : "理想反射方向"}</text>
    </>}
    <g className="law-formula-plate" transform="translate(58 364)"><rect width="255" height="67" rx="3" /><text x="16" y="24">LAW / 反射定律</text><text className="formula" x="16" y="49">∠i = ∠r　·　相对法线测量</text></g>
  </svg>;
}

export function RefractionDiagram2D({ angle, refractionAngle, totalInternalReflection, topMedium, bottomMedium, interacted }: RefractionDiagramProps) {
  const centerX = 450;
  const interfaceY = 225;
  const incidenceRadians = radians(angle);
  const resultAngle = refractionAngle ?? angle;
  const resultRadians = radians(resultAngle);
  const incident = { x: centerX - Math.sin(incidenceRadians) * 228, y: interfaceY - Math.cos(incidenceRadians) * 228 };
  const result = totalInternalReflection
    ? { x: centerX + Math.sin(incidenceRadians) * 220, y: interfaceY - Math.cos(incidenceRadians) * 220 }
    : { x: centerX + Math.sin(resultRadians) * 202, y: interfaceY + Math.cos(resultRadians) * 202 };
  const incidenceArc = { x: centerX - Math.sin(incidenceRadians) * 60, y: interfaceY - Math.cos(incidenceRadians) * 60 };
  const resultArc = totalInternalReflection
    ? { x: centerX + Math.sin(incidenceRadians) * 60, y: interfaceY - Math.cos(incidenceRadians) * 60 }
    : { x: centerX + Math.sin(resultRadians) * 60, y: interfaceY + Math.cos(resultRadians) * 60 };

  return <svg className="law-diagram-2d" viewBox="0 0 900 470" role="img" aria-label="光的折射二维测量图">
    <rect className="upper-medium" width="900" height={interfaceY} />
    <rect className="lower-medium" y={interfaceY} width="900" height={470 - interfaceY} />
    <g className="ray-grid">{Array.from({ length: 17 }, (_, index) => <line x1={50 + index * 50} x2={50 + index * 50} y1="35" y2="435" key={`fv-${index}`} />)}{Array.from({ length: 8 }, (_, index) => <line x1="40" x2="860" y1={50 + index * 50} y2={50 + index * 50} key={`fh-${index}`} />)}</g>
    <text className="law-stage-kicker" x="58" y="62">2D INTERFACE METER / 二维界面测量</text>
    <text className="medium-label" x="76" y="105">{topMedium} · 入射介质</text>
    <text className="medium-label" x="76" y="270">{bottomMedium} · 折射介质</text>
    <line className="interface-line solid" x1="42" x2="858" y1={interfaceY} y2={interfaceY} />
    <line className="normal-line" x1={centerX} x2={centerX} y1="45" y2="432" />
    <text className="medium-label" x={centerX + 12} y="72">法线 N</text>
    <circle className="incidence-point" cx={centerX} cy={interfaceY} r="6" />
    {interacted && <>
      <path className="incident-ray" d={`M${incident.x} ${incident.y} L${centerX} ${interfaceY}`} markerEnd="url(#optics-ray-arrow)" />
      <path className={totalInternalReflection ? "reflected-ray" : "refracted-ray"} d={`M${centerX} ${interfaceY} L${result.x} ${result.y}`} markerEnd="url(#optics-ray-arrow)" />
      <path className="angle-arc" d={`M${centerX} ${interfaceY - 60} A60 60 0 0 0 ${incidenceArc.x} ${incidenceArc.y}`} />
      {totalInternalReflection
        ? <path className="angle-arc reflected" d={`M${centerX} ${interfaceY - 60} A60 60 0 0 1 ${resultArc.x} ${resultArc.y}`} />
        : <path className="angle-arc refracted" d={`M${centerX} ${interfaceY + 60} A60 60 0 0 0 ${resultArc.x} ${resultArc.y}`} />}
      <text className="angle-label" x={centerX - 104} y={interfaceY - 82}>i = {angle.toFixed(0)}°</text>
      <text className={totalInternalReflection ? "angle-label reflected" : "angle-label refracted"} x={centerX + 34} y={totalInternalReflection ? interfaceY - 82 : interfaceY + 92}>{totalInternalReflection ? `r = ${angle.toFixed(0)}°` : `r = ${refractionAngle!.toFixed(1)}°`}</text>
      <text className="ray-name incident" x={incident.x - 18} y={incident.y - 12}>入射光</text>
      <text className={totalInternalReflection ? "ray-name reflected" : "ray-name refracted"} x={result.x - 18} y={result.y + (totalInternalReflection ? -12 : 22)}>{totalInternalReflection ? "全反射光" : "折射光"}</text>
    </>}
    <g className={`law-formula-plate ${totalInternalReflection ? "alert" : ""}`} transform="translate(58 365)"><rect width="250" height="67" rx="3" /><text x="15" y="24">{totalInternalReflection ? "TOTAL INTERNAL REFLECTION" : "SNELL / 折射定律"}</text><text className="formula" x="15" y="49">{totalInternalReflection ? "折射光消失 · 反射光保留" : "n₁ sin i = n₂ sin r"}</text></g>
  </svg>;
}

export function PlaneMirrorDiagram2D({ objectDistance, observerPosition, screenPlaced, interacted }: PlaneMirrorDiagramProps) {
  const mirrorX = 450;
  const objectX = mirrorX - 120 - (objectDistance - 90) / 170 * 95;
  const imageX = mirrorX + (mirrorX - objectX);
  const objectTopY = 130;
  const baseY = 320;
  const eyeX = 125 + observerPosition * .55;
  const eyeY = 236;
  const reflectionPoints = [-13, 13].map((offset) => {
    const targetY = eyeY + offset;
    const t = (mirrorX - imageX) / (eyeX - imageX);
    return { x: mirrorX, y: objectTopY + t * (targetY - objectTopY), targetY };
  });

  return <svg className="law-diagram-2d plane-mirror-diagram" viewBox="0 0 900 470" role="img" aria-label="平面镜成像二维光路图">
    <g className="mirror-grid">{Array.from({ length: 17 }, (_, index) => <line x1={50 + index * 50} x2={50 + index * 50} y1="35" y2="425" key={`mv-${index}`} />)}{Array.from({ length: 8 }, (_, index) => <line x1="40" x2="860" y1={50 + index * 50} y2={50 + index * 50} key={`mh-${index}`} />)}</g>
    <text className="law-stage-kicker" x="58" y="65">2D RAY TRACE / 二维虚像验证</text>
    <line className="plane-mirror-line" x1={mirrorX} x2={mirrorX} y1="52" y2="405" />
    <text className="medium-label" x={mirrorX - 30} y="438">平面镜</text>
    <g className="mirror-object"><line x1={objectX} x2={objectX} y1={baseY} y2={objectTopY} /><path d={`M${objectX - 11} ${objectTopY + 18} L${objectX} ${objectTopY} L${objectX + 11} ${objectTopY + 18}`} /><text x={objectX - 18} y="348">物体</text></g>
    {interacted && <g className="mirror-image"><line x1={imageX} x2={imageX} y1={baseY} y2={objectTopY} /><path d={`M${imageX - 11} ${objectTopY + 18} L${imageX} ${objectTopY} L${imageX + 11} ${objectTopY + 18}`} /><text x={imageX - 18} y="348">虚像</text></g>}
    <g className="observer-eye" transform={`translate(${eyeX} ${eyeY})`}><path d="M-31 0 Q0 -24 31 0 Q0 24 -31 0 Z" /><circle r="7" /><text x="-22" y="42">观察者</text></g>
    {interacted && <g className="mirror-light-paths">{reflectionPoints.map((point, index) => <g key={index}><path className="incident" d={`M${objectX} ${objectTopY} L${point.x} ${point.y}`} markerEnd="url(#optics-ray-arrow-small)" /><path className="reflected" d={`M${point.x} ${point.y} L${eyeX} ${point.targetY}`} markerEnd="url(#optics-ray-arrow-small)" /><path className="virtual-extension" d={`M${point.x} ${point.y} L${imageX} ${objectTopY}`} /></g>)}</g>}
    <line className="mirror-measure" x1={objectX} x2={imageX} y1="385" y2="385" />
    <text className="medium-label" x={objectX + 18} y="408">物距 {objectDistance} 格</text><text className="medium-label" x={mirrorX + 22} y="408">像距 {objectDistance} 格</text>
    {screenPlaced && <g className="virtual-screen"><rect x={imageX - 18} y="82" width="36" height="285" /><text x={imageX - 54} y="70">验证光屏：无清晰像</text></g>}
  </svg>;
}
