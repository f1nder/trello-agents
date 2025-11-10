const stripTrailingSlash = (value: string) => value.replace(/\/$/, '');

export const resolveBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_POWERUP_BASE_URL as string | undefined;
  if (envUrl) {
    return stripTrailingSlash(envUrl);
  }

  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }

  return '';
};

export const resolveAssetUrl = (path: string): string => {
  if (/^https?:/i.test(path)) {
    return path;
  }
  const base = resolveBaseUrl();
  return `${base}${path}`;
};
