import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { ClusterSettings } from '../types/settings';
import { DEFAULT_CLUSTER_SETTINGS } from '../types/settings';

export interface ClusterSettingsResult {
  settings: ClusterSettings;
  token: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: Error | null;
}

export const useClusterSettings = (trello: TrelloPowerUp.Client | null): ClusterSettingsResult => {
  const [settings, setSettings] = useState<ClusterSettings>(DEFAULT_CLUSTER_SETTINGS);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!trello) {
      setStatus('idle');
      setToken(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    const loadSettings = async () => {
      try {
        const saved = (await trello.get<ClusterSettings>('board', 'private', STORAGE_KEYS.clusterConfig)) ?? DEFAULT_CLUSTER_SETTINGS;
        if (cancelled) {
          return;
        }
        setSettings(saved);

        if (saved.tokenSecretId) {
          try {
            const loadedToken = await trello.loadSecret(saved.tokenSecretId);
            if (!cancelled) {
              setToken(loadedToken);
            }
          } catch (tokenError) {
            console.error('[settings] Failed to load stored token', tokenError);
            if (!cancelled) {
              setToken(null);
            }
          }
        } else {
          setToken(null);
        }

        setStatus('ready');
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError as Error);
        setStatus('error');
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [trello]);

  return { settings, token, status, error };
};
