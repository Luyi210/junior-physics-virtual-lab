import type { CapacitorMode } from '@physics-lab/contracts';

export interface CapacitorPoint { x: number; y: number }
export type CapacitorPoint3 = [number, number, number];
export const CAPACITOR_MODES: ReadonlyArray<{ mode: CapacitorMode; label: string; detail: string }> = [
  { mode: 'charge', label: '接电源', detail: '经电阻接入电源' },
  { mode: 'open', label: '开路保持', detail: '理想模型忽略漏电' },
  { mode: 'discharge', label: '经电阻放电', detail: '电源退出闭合回路' },
];
export const CAPACITOR_BOARD = {
  width: 700, height: 390,
  sourcePositive: { x: 90, y: 180 }, sourceNegative: { x: 90, y: 204 },
  common: { x: 280, y: 135 },
  contacts: { charge: { x: 210, y: 70 }, open: { x: 210, y: 135 }, discharge: { x: 210, y: 220 } },
  openBladeEnd: { x: 235, y: 135 },
  resistorLeft: { x: 325, y: 135 }, resistorRight: { x: 375, y: 135 },
  ammeterLeft: { x: 415, y: 135 }, ammeterRight: { x: 465, y: 135 },
  plateP: { x: 560, y: 190 }, plateN: { x: 560, y: 225 },
  voltmeterTop: { x: 650, y: 187 }, voltmeterBottom: { x: 650, y: 227 },
} as const;

/** Every path stops at component terminals. No wire bridges the dielectric or either meter. */
export const CAPACITOR_WIRES: ReadonlyArray<{ id: string; points: readonly CapacitorPoint[]; branch: 'charge' | 'discharge' | 'common' | 'voltmeter' }> = [
  { id: 'source-to-charge', points: [CAPACITOR_BOARD.sourcePositive, { x: 90, y: 70 }, CAPACITOR_BOARD.contacts.charge], branch: 'charge' },
  { id: 'negative-return', points: [CAPACITOR_BOARD.sourceNegative, { x: 90, y: 310 }, { x: 560, y: 310 }, CAPACITOR_BOARD.plateN], branch: 'common' },
  { id: 'discharge-return', points: [CAPACITOR_BOARD.contacts.discharge, { x: 210, y: 310 }], branch: 'discharge' },
  { id: 'switch-to-resistor', points: [CAPACITOR_BOARD.common, CAPACITOR_BOARD.resistorLeft], branch: 'common' },
  { id: 'resistor-to-ammeter', points: [CAPACITOR_BOARD.resistorRight, CAPACITOR_BOARD.ammeterLeft], branch: 'common' },
  { id: 'ammeter-to-plate', points: [CAPACITOR_BOARD.ammeterRight, { x: 560, y: 135 }, CAPACITOR_BOARD.plateP], branch: 'common' },
  { id: 'voltmeter-positive', points: [{ x: 560, y: 175 }, { x: 650, y: 175 }, CAPACITOR_BOARD.voltmeterTop], branch: 'voltmeter' },
  { id: 'voltmeter-negative', points: [{ x: 560, y: 240 }, { x: 650, y: 240 }, CAPACITOR_BOARD.voltmeterBottom], branch: 'voltmeter' },
];
export function capacitorPath(points: readonly CapacitorPoint[]) { return points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(''); }
export function capacitorWorldPoint(point: CapacitorPoint, elevation = -.55): CapacitorPoint3 { return [(point.x - 350) / 80, elevation, (point.y - 190) / 80]; }
export function capacitorSwitchEnd(mode: CapacitorMode): CapacitorPoint { return mode === 'open' ? CAPACITOR_BOARD.openBladeEnd : CAPACITOR_BOARD.contacts[mode]; }
export function capacitorCurrentArrow(current: number) {
  if (!Number.isFinite(current) || current === 0) return null;
  const direction = current > 0 ? 1 : -1;
  return { direction, start: { x: 410 - direction * 20, y: 97 }, end: { x: 410 + direction * 20, y: 97 } };
}
export function capacitorPlateSigns(charge: number): { p: '+' | '−' | null; n: '+' | '−' | null } {
  if (!Number.isFinite(charge) || charge === 0) return { p: null, n: null };
  return charge > 0 ? { p: '+', n: '−' } : { p: '−', n: '+' };
}
/** R3F click delta is CSS-pixel movement, independent of world zoom. */
export function isCapacitorSwitchClick(event: { delta?: number; button?: number }) {
  return (event.button === undefined || event.button === 0) && Number.isFinite(event.delta) && event.delta! >= 0 && event.delta! <= 4;
}
