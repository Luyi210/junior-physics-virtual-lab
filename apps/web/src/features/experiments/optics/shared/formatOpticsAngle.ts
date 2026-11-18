/** Display only: never feed the rounded value back into Snell's law. */
export function formatOpticsAngle(value: number, digits = 4, fixed = false): string {
  if (!Number.isFinite(value)) return "—";
  const decimal = value.toFixed(digits);
  const rounded = Number(decimal);
  // Ignore floating-point representation noise, not a teaching tolerance.
  const approximate = Math.abs(value - rounded) > 8 * Number.EPSILON * Math.max(1, Math.abs(value));
  return `${approximate ? "≈" : ""}${fixed ? decimal : String(rounded)}`;
}
