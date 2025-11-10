import { useEffect, useState } from 'react';
import { getPreviewConfig, PREVIEW_THEME_EVENT, type TrelloTheme } from '../utils/preview';

type ThemeAwareClient = TrelloPowerUp.Client & {
  getContext?: () => Record<string, unknown> | void;
  render?: (callback: () => void | Promise<void>) => void;
};

const coerceTheme = (value?: string | null): TrelloTheme => (value === 'dark' ? 'dark' : 'light');

export const useTrelloTheme = (trello: TrelloPowerUp.Client | null) => {
  const previewConfig = getPreviewConfig();
  const [theme, setTheme] = useState<TrelloTheme>(() => coerceTheme(previewConfig?.theme));

  useEffect(() => {
    if (!previewConfig) {
      return;
    }

    const handlePreviewTheme = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }
      setTheme(coerceTheme(event.detail as string | undefined));
    };

    window.addEventListener(PREVIEW_THEME_EVENT, handlePreviewTheme as EventListener);
    return () => window.removeEventListener(PREVIEW_THEME_EVENT, handlePreviewTheme as EventListener);
  }, [previewConfig]);

  useEffect(() => {
    if (previewConfig || !trello) {
      return;
    }

    let disposed = false;
    const themeClient = trello as ThemeAwareClient;

    const syncThemeFromContext = () => {
      if (disposed) {
        return;
      }
      try {
        const context = themeClient.getContext?.();
        const contextTheme =
          typeof context === 'object' && context ? (context as { theme?: string }).theme : undefined;
        setTheme(coerceTheme(contextTheme));
      } catch (error) {
        console.warn('[powerup] Unable to read Trello theme', error);
      }
    };

    syncThemeFromContext();

    if (typeof themeClient.render === 'function') {
      themeClient.render(() => {
        syncThemeFromContext();
        return Promise.resolve();
      });
    }

    return () => {
      disposed = true;
    };
  }, [previewConfig, trello]);

  return theme;
};
