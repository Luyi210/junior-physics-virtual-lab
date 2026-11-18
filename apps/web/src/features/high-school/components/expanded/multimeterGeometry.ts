import type { Point2 } from './expandedGeometry';

const line = (...coordinates: number[]): Point2[] => Array.from({ length: coordinates.length / 2 }, (_, index) => ({ x: coordinates[index * 2], y: coordinates[index * 2 + 1] }));

/** The same terminals and broken branches are used by both apparatus views. */
export function multimeterWiring(parameters: Record<string, number>) {
  const isolated = parameters.connection === 2, series = parameters.connection === 1;
  const resistor = { x: 520, y: isolated ? 295 : 245 };
  const wires = [line(430, 140, 430, 80, 490, 80), line(510, 80, 550, 80), line(580, 80, 620, 80, 620, 140), line(620, 175, 620, 245, 552, 245), line(488, 245, 430, 245, 430, 185)];
  if (!series) wires.push(line(430, 140, 430, 185));
  const powerSwitch = line(550, 80, parameters.powerOn ? 580 : 575, parameters.powerOn ? 80 : 59);
  const circuitSwitch = line(620, 140, parameters.circuitClosed ? 620 : 642, parameters.circuitClosed ? 175 : 165);
  const leftTerminal = series ? { x: 430, y: 140 } : isolated ? { x: 488, y: 295 } : { x: 430, y: 245 };
  const rightTerminal = series ? { x: 430, y: 185 } : isolated ? { x: 552, y: 295 } : { x: 620, y: 245 };
  const redTerminal = parameters.probesReversed ? rightTerminal : leftTerminal;
  const blackTerminal = parameters.probesReversed ? leftTerminal : rightTerminal;
  const redProbe = line(105, 291, 105, 315, 325, 315, 325, redTerminal.y, redTerminal.x, redTerminal.y);
  const blackProbe = line(221, 291, 221, 329, 660, 329, 660, blackTerminal.y, blackTerminal.x, blackTerminal.y);
  return { wires, powerSwitch, circuitSwitch, redProbe, blackProbe, resistor, leftTerminal, rightTerminal, isolated, series };
}

export const MULTIMETER_FUNCTION_LABELS = ['直流电压', '直流电流', '电阻'] as const;
export const MULTIMETER_CONNECTION_LABELS = ['并联待测电阻', '串入电流回路', '隔离待测元件'] as const;
export const MULTIMETER_RANGE_LABELS = [['2 V', '20 V', '200 V'], ['2 mA', '20 mA', '200 mA'], ['200 Ω', '2 kΩ', '20 kΩ']] as const;

/** Display-only direction: the same visible pointer marks V / A / Ω in SVG and Three. */
export function multimeterDialDirection(functionMode: number): Point2 {
  const angle = (functionMode - 1) * Math.PI / 4;
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

/** Unit conversion/decimal layout only. Never recomputes or repairs the model reading. */
export function multimeterPresentation(parameters: Record<string, number>, state: Record<string, number>) {
  const mode = parameters.functionMode, scale = mode === 1 ? 1000 : mode === 2 && state.selectedRange >= 2000 ? .001 : 1;
  const unit = mode === 1 ? 'mA' : mode === 2 ? scale === .001 ? 'kΩ' : 'Ω' : 'V';
  const resolution = state.resolution * scale;
  const decimals = resolution > 0 && Number.isFinite(resolution) ? Math.max(0, Math.min(6, Math.round(-Math.log10(resolution)))) : 0;
  const valid = state.readingValid === 1;
  const reason: string[] = [];
  if (state.configurationValid !== 1) {
    if (mode === 2) {
      if (parameters.powerOn !== 0) reason.push('电阻挡仍有外部供电，请先断开外部电源。');
      if (parameters.connection !== 2) reason.push('待测元件尚未隔离，请选择隔离元件后测电阻。');
    } else reason.push(mode === 0 ? '电压挡需并联在待测电阻两端，当前接法不适用。' : '电流挡需串入电流回路，当前接法不适用。');
  } else if (state.overRange === 1) reason.push('读数超过所选量程，请自行选择更大量程；当前没有有效示数。');
  else if (valid) {
    if (mode === 2) reason.push('外部电源已断开，元件已隔离；表内测量电源用于读阻值。');
    else if (parameters.powerOn === 0) reason.push('外部电源已断开；此时负载电压和电流均为零。');
    else if (parameters.circuitClosed === 0) reason.push('总开关断开，待测负载无电流；负载两端电压为零。');
    else if (parameters.supplyVoltage === 0) reason.push('电源设为0 V；这是有效的零读数。');
    else if (parameters.probesReversed === 1) reason.push('表笔极性反接，负号表示与红表笔约定的方向相反。');
    else reason.push(mode === 0 ? '当前并联测量待测电阻两端电压。' : '当前串联测量回路电流。');
  } else reason.push('当前读数无效，请核对功能、接法与量程。');
  const converted = state.meterValue * scale;
  const numeric = valid && Number.isFinite(converted) ? (Object.is(converted, -0) ? 0 : converted).toFixed(decimals) : null;
  const status = valid ? '有效读数' : state.overRange === 1 ? '超量程' : '接法无效';
  return { unit, decimals, scale, numeric, display: numeric === null ? status : `${numeric} ${unit}`, status, valid,
    rangeLabel: MULTIMETER_RANGE_LABELS[mode]?.[parameters.rangeIndex] ?? '量程未选择',
    resolutionLabel: `${Number(resolution.toPrecision(6))} ${unit}`,
    reasons: reason, connectionLabel: MULTIMETER_CONNECTION_LABELS[parameters.connection] ?? '未知接法',
    functionLabel: MULTIMETER_FUNCTION_LABELS[mode] ?? '未知功能',
  };
}
