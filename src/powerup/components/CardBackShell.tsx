import { useMemo, useState } from 'react';
import type { AgentPod } from '../types/pods';
import { useLivePods } from '../hooks/useLivePods';
import { usePowerUpClient } from '../hooks/usePowerUpClient';
import { useClusterSettings } from '../hooks/useClusterSettings';
import { useCardMetadata } from '../hooks/useCardMetadata';
import { OpenShiftClient } from '../services/openshiftClient';
import { resolveAssetUrl } from '../utils/url';
import PodActions from './PodActions';
import '../../styles/index.css';
import '../../pages/InnerPage.css';

const CardBackShell = () => {
  const trello = usePowerUpClient();
  const { settings, token, status: settingsStatus, error: settingsError } = useClusterSettings(trello);
  const { card, status: cardStatus, error: cardError } = useCardMetadata(trello);
  const [pendingStopIds, setPendingStopIds] = useState<Set<string>>(new Set());

  const openShiftClient = useMemo(() => {
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
  }, [settings, token]);

  const livePods = useLivePods({
    client: openShiftClient,
    cardId: card?.id ?? null,
    namespace: settings.namespace,
  });

  const iconUrl = useMemo(() => resolveAssetUrl('/icons/card-agents.svg'), []);

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
    <main className="inner-page" data-card-back>
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
          <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', color: '#b45309', fontSize: '0.95rem' }}>
            {readinessHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        )}
        {issues.length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', background: '#fef2f2', color: '#991b1b' }}>
            {issues.map((error) => (
              <p key={error.message} style={{ margin: 0 }}>
                {error.message}
              </p>
            ))}
          </div>
        )}
      </header>

      <section className="status-grid">
        {livePods.groups.map((group) => (
          <article key={group.phase}>
            <span className="badge">{group.phase}</span>
            <h2>{group.pods.length} pods</h2>
            <ul style={{ paddingLeft: '1rem', margin: '0.5rem 0 0', listStyle: 'disc' }}>
              {group.pods.map((pod) => (
                <li key={pod.id} style={{ marginBottom: '0.35rem' }}>
                  <strong>{pod.name}</strong>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                    Started {new Date(pod.startedAt).toLocaleString()}
                    {pod.lastEvent ? ` · ${pod.lastEvent}` : ''}
                  </div>
                  <PodActions
                    pod={pod}
                    onStop={handleStopPod}
                    onStreamLogs={handleStreamLogs}
                    disabled={!trello || !openShiftClient || readinessHints.length > 0}
                    isStopping={pendingStopIds.has(pod.id)}
                  />
                </li>
              ))}
            </ul>
          </article>
        ))}
        {livePods.groups.length === 0 && (
          <article>
            <span className="badge">No pods</span>
            <h2>Cluster returned 0 pods</h2>
            <p>Either this Trello card has no running agents yet or the service-account token lacks permissions.</p>
          </article>
        )}
      </section>
    </main>
  );
};

export default CardBackShell;
