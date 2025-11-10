import { useEffect } from 'react';
import { useTrelloTheme } from './useTrelloTheme';

export const useAppliedTrelloTheme = (trello: TrelloPowerUp.Client | null) => {
  const theme = useTrelloTheme(trello);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.setAttribute('data-trello-theme', theme);
    document.body?.setAttribute('data-trello-theme', theme);
  }, [theme]);

  return theme;
};
