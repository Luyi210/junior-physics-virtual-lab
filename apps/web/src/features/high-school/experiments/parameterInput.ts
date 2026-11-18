export function commitParameterDraft(draft: string, min: number, max: number) {
  const normalized = draft.trim().replaceAll('−', '-');
  // Empty and intermediate signs are editing states, never a request for zero.
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return null;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  const value = Math.max(min, Math.min(max, numeric));
  return { value, clamped: value !== numeric };
}
