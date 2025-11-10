import { useEffect, useState } from 'react';
import { getPreviewConfig } from '../utils/preview';

export const usePowerUpClient = () => {
  const [client, setClient] = useState<TrelloPowerUp.Client | null>(null);

  useEffect(() => {
    const previewClient = getPreviewConfig()?.trelloClient;
    if (previewClient) {
      setClient(previewClient);
      return;
    }

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
