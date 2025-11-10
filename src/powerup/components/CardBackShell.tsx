import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AgentPod } from '../types/pods';
import type { OpenShiftPodApi } from '../services/openshiftClient';
import { useLivePods } from '../hooks/useLivePods';
import { usePowerUpClient } from '../hooks/usePowerUpClient';
import { useClusterSettings } from '../hooks/useClusterSettings';
import { useCardMetadata } from '../hooks/useCardMetadata';
import { OpenShiftClient } from '../services/openshiftClient';
import { resolveAssetUrl } from '../utils/url';
import { getPreviewConfig } from '../utils/preview';
import { useAppliedTrelloTheme } from '../hooks/useAppliedTrelloTheme';
import PodActions from './PodActions';
import '../../styles/index.css';
import '../../pages/InnerPage.css';

type StatusKind = 'running' | 'pending' | 'complete' | 'error';

const statusFamilies: Record<StatusKind, string[]> = {
  running: ['running'],
  pending: ['pending', 'initialize', 'initializing', 'containercreating', 'queued', 'waiting'],
  complete: ['succeeded', 'completed', 'complete'],
  error: ['failed', 'error', 'unknown', 'terminating', 'crashloopbackoff', 'evicted'],
};

const inferStatusKind = (phase: string): StatusKind => {
  const normalized = phase.toLowerCase();
  if (statusFamilies.running.includes(normalized)) {
    return 'running';
  }
  if (statusFamilies.pending.includes(normalized)) {
    return 'pending';
  }
  if (statusFamilies.complete.includes(normalized)) {
    return 'complete';
  }
  if (statusFamilies.error.includes(normalized)) {
    return 'error';
  }
  return 'pending';
};

const StatusIndicator = ({ phase }: { phase: string }) => {
  const kind = inferStatusKind(phase);
  let visual: ReactNode;
  if (kind === 'running') {
    visual = <span className="status-indicator__spinner" aria-hidden="true" />;
  } else if (kind === 'complete') {
    visual = <span className="status-indicator__dot status-indicator__dot--complete" aria-hidden="true" />;
  } else if (kind === 'error') {
    visual = <span className="status-indicator__dot status-indicator__dot--error" aria-hidden="true" />;
  } else {
    visual = <span className="status-indicator__dot status-indicator__dot--pending" aria-hidden="true" />;
  }
  return (
    <span className="status-indicator" role="img" aria-label={`${phase} pod`}>
      {visual}
      <span className="sr-only">{phase}</span>
    </span>
  );
};

const formatRuntime = (timestamp: string): string => {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return '–';
  }
  const diffMs = Date.now() - parsed;
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) {
    return '0m';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
};

const CardBackShell = () => {
  const trello = usePowerUpClient();
  const theme = useAppliedTrelloTheme(trello);
  const { settings, token, status: settingsStatus, error: settingsError } = useClusterSettings(trello);
  const { card, status: cardStatus, error: cardError } = useCardMetadata(trello);
  const [pendingStopIds, setPendingStopIds] = useState<Set<string>>(new Set());
  const previewConfig = getPreviewConfig();
  const previewClient = previewConfig?.openShiftClient ?? null;

  const openShiftClient: OpenShiftPodApi | null = useMemo(() => {
    if (previewClient) {
      return previewClient;
    }
    if (!settings.clusterUrl || !token) {
      return null;
    }
    return new OpenShiftClient({
      baseUrl: settings.clusterUrl,
      namespace: settings.namespace,
      token,
      ignoreSsl: settings.ignoreSsl,
      caBundle: settings.caBundle,
    });
  }, [previewClient, settings, token]);

  const livePods = useLivePods({
    client: openShiftClient,
    cardId: card?.id ?? null,
    namespace: settings.namespace,
  });

  const iconUrl = useMemo(() => resolveAssetUrl('/icons/card-agents.svg'), []);
  const sortedPods = useMemo(
    () =>
      [...livePods.pods].sort((a, b) => {
        const aTime = Date.parse(a.startedAt);
        const bTime = Date.parse(b.startedAt);
        if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
          return 0;
        }
        return bTime - aTime;
      }),
    [livePods.pods],
  );

  const markPending = (podId: string, nextState: boolean) => {
    setPendingStopIds((prev) => {
      const next = new Set(prev);
      if (nextState) {
        next.add(podId);
      } else {
        next.delete(podId);
      }
      return next;
    });
  };

  const handleStopPod = async (pod: AgentPod) => {
    if (!trello || !openShiftClient) {
      return;
    }
    markPending(pod.id, true);
    const previousSnapshot = { ...pod };
    livePods.mutate.remove(pod.id);
    try {
      await openShiftClient.stopPod(pod.name, { namespace: pod.namespace, owner: pod.owner ?? null });
      trello.track('stop-pod', { pod: pod.name, namespace: pod.namespace });
      await trello.alert({ message: `Stop requested for ${pod.name}`, display: 'info' });
    } catch (error) {
      livePods.mutate.upsert(previousSnapshot);
      await trello.alert({
        message: `Failed to stop ${pod.name}: ${(error as Error).message}`,
        display: 'error',
      });
    } finally {
      markPending(pod.id, false);
    }
  };

  const handleStreamLogs = async (pod: AgentPod) => {
    if (!trello) {
      return;
    }
    trello.track('stream-logs', { pod: pod.name, namespace: pod.namespace });
    await trello.modal({
      url: trello.signUrl(resolveAssetUrl('/logs.html')),
      title: `Logs · ${pod.name}`,
      height: 720,
      args: { pod },
    });
  };

  const readinessHints: string[] = [];
  if (!trello) {
    readinessHints.push('Waiting for Trello Power-Up iframe…');
  }
  if (settingsStatus === 'loading') {
    readinessHints.push('Loading cluster settings…');
  }
  if (settingsStatus === 'ready' && !settings.clusterUrl) {
    readinessHints.push('Set the cluster URL inside the Power-Up settings page.');
  }
  if (settingsStatus === 'ready' && !token) {
    readinessHints.push('Store a service-account token to connect to OpenShift.');
  }
  if (cardStatus === 'loading') {
    readinessHints.push('Fetching Trello card metadata…');
  }

  const issues = [settingsError, cardError, livePods.error].filter(Boolean) as Error[];

  return (
    <main className="inner-page" data-card-back data-theme={theme}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src={iconUrl} alt="Card Agents" width={32} height={32} />
          <div>
            <p className="eyebrow">Card Agents</p>
            <h1>Live roster prototype</h1>
          </div>
        </div>
        <p className="lede">
          Stream the pods tagged for this Trello card directly from OpenShift. Each update flows from the native watch
          API—no polling fallback—so operators can stop pods or open log streams without leaving Trello.
        </p>
        <p className="eyebrow">
          Stream status: {livePods.status}
          {livePods.reconnectAttempts > 0 ? ` · reconnect #${livePods.reconnectAttempts}` : ''}
          {livePods.lastEventAt ? ` · last event ${new Date(livePods.lastEventAt).toLocaleTimeString()}` : ''}
        </p>
        {readinessHints.length > 0 && (
          <ul
            style={{
              margin: '0.75rem 0 0',
              paddingLeft: '1.25rem',
              color: 'var(--ca-warning-text)',
              fontSize: '0.95rem',
            }}
          >
            {readinessHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        )}
        {trello && settingsStatus === 'ready' && (!settings.clusterUrl || !token) && (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={async () => {
                try {
                  trello.track('open-settings-from-card');
                  await trello.modal({
                    url: trello.signUrl(resolveAssetUrl('/settings.html')),
                    title: 'Cluster Settings',
                    height: 520,
                  });
                } catch (err) {
                  await trello.alert({ message: 'Unable to open settings', display: 'error' });
                }
              }}
              style={{
                appearance: 'none',
                border: 0,
                background: 'var(--ca-primary)',
                color: 'var(--ca-primary-contrast)',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Open Settings
            </button>
          </div>
        )}
        {issues.length > 0 && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--ca-issue-bg)',
              color: 'var(--ca-issue-text)',
            }}
          >
            {issues.map((error) => (
              <p key={error.message} style={{ margin: 0 }}>
                {error.message}
              </p>
            ))}
          </div>
        )}
      </header>

      <section className="pod-list">
        {sortedPods.map((pod) => (
          <article key={pod.id} className="pod-row">
            <div className="pod-row__status">
              <StatusIndicator phase={pod.phase} />
            </div>
            <div className="pod-row__meta">
              <strong>{pod.name}</strong>
              <span className="pod-row__time" title={`Started ${new Date(pod.startedAt).toLocaleString()}`}>
                {formatRuntime(pod.startedAt)} · {pod.lastEvent ?? 'no events yet'}
              </span>
            </div>
            <div className="pod-row__actions">
              <PodActions
                pod={pod}
                onStop={handleStopPod}
                onStreamLogs={handleStreamLogs}
                disabled={!trello || !openShiftClient || readinessHints.length > 0}
                isStopping={pendingStopIds.has(pod.id)}
                variant="compact"
              />
            </div>
          </article>
        ))}
        {sortedPods.length === 0 && (
          <article className="pod-row pod-row--empty">
            <div className="pod-row__meta">
              <strong>No pods in scope</strong>
              <span className="pod-row__time">
                Either this Trello card has no running agents or the service-account token lacks permissions.
              </span>
            </div>
          </article>
        )}
      </section>
    </main>
  );
};

export default CardBackShell;
