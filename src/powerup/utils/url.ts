const stripTrailingSlash = (value: string) => value.replace(/\/$/, '');

export const resolveBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_POWERUP_BASE_URL as string | undefined;
  if (envUrl) {
    return stripTrailingSlash(envUrl);
  }

  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin && origin !== 'null' && !origin.startsWith('file://')) {
      return origin;
    }
  }

  return '';
};

const normalizePath = (path: string): string => {
  if (path.startsWith('./')) {
    return path.slice(1);
  }
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
};

export const resolveAssetUrl = (path: string): string => {
  if (/^https?:/i.test(path)) {
    return path;
  }
  const normalizedPath = normalizePath(path);
  const base = resolveBaseUrl();
  if (!base) {
    return `.${normalizedPath}`;
  }
  return `${base}${normalizedPath}`;
};
