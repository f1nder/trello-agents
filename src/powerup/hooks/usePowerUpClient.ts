import { useEffect, useState } from 'react';

export const usePowerUpClient = () => {
  const [client, setClient] = useState<TrelloPowerUp.Client | null>(null);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const trelloApi = (window as Window & { TrelloPowerUp?: TrelloPowerUpGlobal }).TrelloPowerUp;
        if (!trelloApi) {
          return;
        }
        const iframeClient = await trelloApi.iframe();
        if (!cancelled) {
          setClient(iframeClient);
        }
      } catch (error) {
        console.error('[powerup] Unable to bootstrap iframe client', error);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  return client;
};
