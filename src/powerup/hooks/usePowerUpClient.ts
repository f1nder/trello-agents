import { useEffect, useState } from 'react';
import { getPreviewConfig } from '../utils/preview';
import logger from '../utils/logger';

export const usePowerUpClient = () => {
  const [client, setClient] = useState<TrelloPowerUp.Client | null>(null);

  useEffect(() => {
    const previewClient = getPreviewConfig()?.trelloClient;
    if (previewClient) {
      logger.info('usePowerUpClient: using preview client');
      setClient(previewClient);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const trelloApi = (window as Window & { TrelloPowerUp?: TrelloPowerUpGlobal }).TrelloPowerUp;
        if (!trelloApi) {
          logger.warn('usePowerUpClient: TrelloPowerUp not available');
          return;
        }
        logger.info('usePowerUpClient: awaiting iframe client');
        const iframeClient = await trelloApi.iframe();
        if (!cancelled) {
          logger.info('usePowerUpClient: iframe client ready');
          setClient(iframeClient);
        }
      } catch (error) {
        logger.error('usePowerUpClient: failed to bootstrap iframe client', error);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  return client;
};
