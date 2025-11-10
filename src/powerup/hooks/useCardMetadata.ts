import { useEffect, useState } from 'react';
import type { CardMetadata } from '../types/trello';
import { getPreviewConfig } from '../utils/preview';
import logger from '../utils/logger';

export interface CardMetadataResult {
  card: CardMetadata | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: Error | null;
}

export const useCardMetadata = (trello: TrelloPowerUp.Client | null): CardMetadataResult => {
  const [card, setCard] = useState<CardMetadata | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const preview = getPreviewConfig();
    if (preview?.card) {
      logger.info('useCardMetadata: using preview card from config', preview.card);
      setCard(preview.card);
      setStatus('ready');
      return;
    }

    if (!trello) {
      logger.debug('useCardMetadata: trello client not ready');
      setStatus('idle');
      setCard(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    const loadCard = async () => {
      try {
        logger.info('useCardMetadata: requesting card fields', ['id', 'shortLink', 'labels']);
        const payload = await trello.card<{ id: string; shortLink?: string; labels?: CardMetadata['labels'] }>(
          'id',
          'shortLink',
          'labels',
        );
        if (cancelled) {
          return;
        }
        logger.info('useCardMetadata: received card payload', { id: (payload as any).id, shortLink: (payload as any).shortLink, labels: (payload as any).labels?.length ?? 0 });
        setCard(payload);
        setStatus('ready');
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        logger.warn('useCardMetadata: failed to load card', loadError);
        setError(loadError as Error);
        setStatus('error');
      }
    };

    loadCard();
    return () => {
      cancelled = true;
    };
  }, [trello]);

  return { card, status, error };
};
