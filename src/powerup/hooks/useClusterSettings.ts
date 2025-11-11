import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { ClusterSettings } from '../types/settings';
import { DEFAULT_CLUSTER_SETTINGS } from '../types/settings';
import { getPreviewConfig } from '../utils/preview';
import logger from '../utils/logger';

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
      logger.info('useClusterSettings: using preview settings');
      const normalized = { ...DEFAULT_CLUSTER_SETTINGS, ...preview.settings };
      setSettings(normalized);
      const previewToken = normalized.token?.trim() ?? preview.token ?? null;
      setToken(previewToken || null);
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
        logger.info('useClusterSettings: loading saved cluster settings');
        const saved =
          (await trello.get<ClusterSettings>('board', 'private', STORAGE_KEYS.clusterConfig)) ?? DEFAULT_CLUSTER_SETTINGS;
        const normalized = { ...DEFAULT_CLUSTER_SETTINGS, ...saved };
        if (cancelled) {
          return;
        }
        logger.info('useClusterSettings: settings loaded', {
          hasUrl: Boolean(normalized.clusterUrl),
          namespace: normalized.namespace,
          hasToken: Boolean(normalized.token?.trim()),
        });
        setSettings(normalized);
        const nextToken = normalized.token?.trim() || null;
        setToken(nextToken);

        setStatus('ready');
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        logger.error('useClusterSettings: failed to load settings', loadError);
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
