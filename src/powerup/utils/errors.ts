export const isIgnorableNetworkError = (error?: Error | null): boolean => {
  if (!error) {
    return false;
  }

  const normalized = error.message?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized === "load failed" || normalized === "failed to fetch";
};

export const getDisplayableError = <T extends Error | null | undefined>(
  error: T
): T | null => {
  return isIgnorableNetworkError(error ?? null) ? null : error ?? null;
};
