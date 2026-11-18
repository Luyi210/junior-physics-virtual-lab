/** Keep this run's unique displayed seconds; taking more samples must not erase earlier phase evidence. */
export function appendTimedReading<T extends { time: number }>(readings: readonly T[], reading: T): T[] {
  if (!Number.isInteger(reading.time) || reading.time < 0) throw new RangeError("取样时刻应为非负整数秒");
  return [...readings.filter((previous) => previous.time !== reading.time), reading].sort((a, b) => a.time - b.time);
}
