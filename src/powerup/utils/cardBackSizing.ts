const MIN_SECTION_HEIGHT = 100;
const POD_ROW_HEIGHT = 74;
const HEADER_ALLOWANCE = 110;
const MAX_VISIBLE_PODS = 10;

const clampVisibleRows = (podCount: number | null | undefined): number => {
  if (!Number.isFinite(podCount ?? NaN)) {
    return 1;
  }
  const normalized = Math.floor(podCount ?? 0);
  if (normalized <= 0) {
    return 1;
  }
  return Math.min(normalized, MAX_VISIBLE_PODS);
};

export const estimateCardBackHeight = (
  podCount: number | null | undefined
): number => {
  const rows = clampVisibleRows(podCount);
  const estimated = HEADER_ALLOWANCE + rows * POD_ROW_HEIGHT;
  return Math.max(MIN_SECTION_HEIGHT, Math.round(estimated));
};

export const hasDisplayablePods = (
  podCount: number | null | undefined
): boolean => Number.isFinite(podCount ?? NaN) && (podCount ?? 0) > 0;

export const cardBackSizing = {
  MIN_SECTION_HEIGHT,
  POD_ROW_HEIGHT,
  HEADER_ALLOWANCE,
  MAX_VISIBLE_PODS,
};

