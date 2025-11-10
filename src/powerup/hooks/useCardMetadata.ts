import { useEffect, useState } from 'react';
import type { CardMetadata } from '../types/trello';
import { getPreviewConfig } from '../utils/preview';

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
      setCard(preview.card);
      setStatus('ready');
      return;
    }

    if (!trello) {
      setStatus('idle');
      setCard(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    const loadCard = async () => {
      try {
        const payload = await trello.card<{ id: string; shortLink?: string; labels?: CardMetadata['labels'] }>(['id', 'shortLink', 'labels']);
        if (cancelled) {
          return;
        }
        setCard(payload);
        setStatus('ready');
      } catch (loadError) {
        if (cancelled) {
          return;
        }
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
