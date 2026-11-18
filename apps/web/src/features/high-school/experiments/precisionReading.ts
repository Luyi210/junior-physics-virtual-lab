/** Independent learner inputs; never substituted into the automatic model archive. */
export function evaluatePrecisionReading(instrument: number, mainText: string, divisionText: string, zeroText: string) {
  if (instrument !== 0 && instrument !== 1) throw new Error('请选择游标卡尺或螺旋测微器。');
  if ([mainText, divisionText, zeroText].some((value) => !value.trim())) throw new Error('请自主填写主尺、辅助尺格数和零点读数。');
  const [main, division, zero] = [mainText, divisionText, zeroText].map(Number);
  if (![main, division, zero].every(Number.isFinite)) throw new Error('读数必须是有限数字。');
  const mainStep = instrument === 0 ? 1 : .5, resolution = instrument === 0 ? .02 : .01;
  if (main < -1 || main > 25 || Math.abs(main / mainStep - Math.round(main / mainStep)) > 1e-8) throw new Error(`主尺读数应为 ${mainStep} mm 的整倍数。`);
  if (!Number.isInteger(division) || division < 0 || division > 49) throw new Error('辅助尺格数应为 0～49 的整数。');
  if (Math.abs(zero) > .1 + 1e-9 || Math.abs(zero / resolution - Math.round(zero / resolution)) > 1e-8) throw new Error(`零点读数应在 ±0.1 mm 内，并符合 ${resolution} mm 分度。`);
  const indicatedMm = main + division * resolution;
  return { indicatedMm, correctedMm: indicatedMm - zero, zeroMm: zero };
}
