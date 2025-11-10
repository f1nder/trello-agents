import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { ClusterSettings } from '../types/settings';
import { DEFAULT_CLUSTER_SETTINGS } from '../types/settings';
import { getPreviewConfig } from '../utils/preview';

export interface ClusterSettingsResult {
  settings: ClusterSettings;
  token: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: Error | null;
  reload: () => void;
}

export const useClusterSettings = (trello: TrelloPowerUp.Client | null): ClusterSettingsResult => {
  const [settings, setSettings] = useState<ClusterSettings>(DEFAULT_CLUSTER_SETTINGS);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const preview = getPreviewConfig();
    if (preview?.settings) {
      setSettings(preview.settings);
      setToken(preview.token ?? null);
      setStatus('ready');
      return;
    }

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
  }, [trello, reloadTick]);

  const reload = () => setReloadTick((n) => n + 1);

  return { settings, token, status, error, reload };
};
