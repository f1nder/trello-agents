import { useEffect, useMemo, useState } from 'react';
import { usePowerUpClient } from '../hooks/usePowerUpClient';
import { useClusterSettings } from '../hooks/useClusterSettings';
import { OpenShiftClient } from '../services/openshiftClient';
import type { AgentPod } from '../types/pods';
import type { OpenShiftPodApi } from '../services/openshiftClient';
import { getPreviewConfig } from '../utils/preview';
import { useAppliedTrelloTheme } from '../hooks/useAppliedTrelloTheme';
import '../../styles/index.css';
import '../../pages/InnerPage.css';

const textDecoder = new TextDecoder();

const LogStreamModal = () => {
  const trello = usePowerUpClient();
  const theme = useAppliedTrelloTheme(trello);
  const { settings, token, status: settingsStatus } = useClusterSettings(trello);
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'streaming' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [tab, setTab] = useState<'logs' | 'info'>('logs');
  const previewConfig = getPreviewConfig();

  const pod = trello?.arg<AgentPod>('pod');
  const previewClient = previewConfig?.openShiftClient ?? null;
  const openShiftClient: OpenShiftPodApi | null = useMemo(() => {
    if (previewClient) {
      return previewClient;
    }
    if (!token || !settings.clusterUrl) {
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

  useEffect(() => {
    if (!pod || !openShiftClient) {
      return;
    }

    const abortController = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let cancelled = false;
    setLines([]);
    setError(null);
    setStatus('connecting');

    const connect = async () => {
      try {
        reader = await openShiftClient.streamLogs(pod.name, {
          namespace: pod.namespace,
          container: pod.containers[0],
          signal: abortController.signal,
        });
        setStatus('streaming');
        let buffered = '';
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done || !value) {
            break;
          }
          buffered += textDecoder.decode(value, { stream: true });
          const segments = buffered.split('\n');
          buffered = segments.pop() ?? '';
          const nextLines = segments.filter(Boolean);
          if (nextLines.length > 0) {
            setLines((prev) => [...prev, ...nextLines]);
          }
        }
      } catch (streamError) {
        if (cancelled || (streamError instanceof DOMException && streamError.name === 'AbortError')) {
          return;
        }
        setStatus('error');
        setError(streamError as Error);
      }
    };

    connect();

    return () => {
      cancelled = true;
      abortController.abort();
      reader?.cancel().catch(() => undefined);
    };
  }, [openShiftClient, pod]);

  return (
    <main className="inner-page" style={{ gap: '1rem' }} data-theme={theme}>
      <header>
        <p className="eyebrow">Pod</p>
        <h1>{pod ? pod.name : 'Pod'}</h1>
        <p className="lede" style={{ marginBottom: 0 }}>
          {pod
            ? `Namespace ${pod.namespace} · container ${pod.containers[0] ?? 'default'}`
            : 'Waiting for pod context from Trello…'}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <p className="eyebrow" style={{ margin: 0 }}>Status: {status}</p>
          <div className="tabs" role="tablist" aria-label="Logs tabs">
            <button
              role="tab"
              aria-selected={tab === 'logs'}
              className={`tabs__tab ${tab === 'logs' ? 'is-active' : ''}`}
              onClick={() => setTab('logs')}
            >
              Logs
            </button>
            <button
              role="tab"
              aria-selected={tab === 'info'}
              className={`tabs__tab ${tab === 'info' ? 'is-active' : ''}`}
              onClick={() => setTab('info')}
            >
              Info
            </button>
          </div>
        </div>
        {settingsStatus !== 'ready' && <p className="eyebrow">Loading board settings…</p>}
        {error && (
          <p style={{ color: 'var(--ca-error-text)', margin: 0 }}>
            {error.message}. Verify the token permits log streaming for this namespace.
          </p>
        )}
      </header>
      {tab === 'logs' && (
        <section
          style={{
            background: 'var(--ca-log-bg)',
            color: 'var(--ca-log-text)',
            borderRadius: '0.75rem',
            padding: '1rem',
            height: '420px',
            overflow: 'auto',
            fontFamily: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
          }}
        >
          {lines.length === 0 ? <pre style={{ margin: 0, opacity: 0.7 }}>No log output yet…</pre> : null}
          {lines.map((line, index) => (
            <pre key={`${line}-${index}`} style={{ margin: 0 }}>
              {line}
            </pre>
          ))}
        </section>
      )}
      {tab === 'info' && (
        <section
          style={{
            background: 'var(--ca-surface)',
            color: 'var(--ca-text)',
            borderRadius: '0.75rem',
            padding: '1rem',
            border: '1px solid var(--ca-border)',
          }}
        >
          {!pod ? (
            <p style={{ margin: 0, opacity: 0.8 }}>No pod context.</p>
          ) : (
            <dl style={{
              display: 'grid',
              gridTemplateColumns: 'max-content 1fr',
              gap: '0.5rem 1rem',
              margin: 0,
            }}>
              <dt className="eyebrow">Name</dt>
              <dd style={{ margin: 0 }}>{pod.name}</dd>
              <dt className="eyebrow">Namespace</dt>
              <dd style={{ margin: 0 }}>{pod.namespace}</dd>
              <dt className="eyebrow">Phase</dt>
              <dd style={{ margin: 0 }}>{pod.phase}</dd>
              <dt className="eyebrow">Started</dt>
              <dd style={{ margin: 0 }}>{new Date(pod.startedAt).toLocaleString()}</dd>
              <dt className="eyebrow">Containers</dt>
              <dd style={{ margin: 0 }}>{pod.containers.join(', ') || '—'}</dd>
              {pod.nodeName && (
                <>
                  <dt className="eyebrow">Node</dt>
                  <dd style={{ margin: 0 }}>{pod.nodeName}</dd>
                </>
              )}
              {typeof pod.restarts === 'number' && (
                <>
                  <dt className="eyebrow">Restarts</dt>
                  <dd style={{ margin: 0 }}>{pod.restarts}</dd>
                </>
              )}
              {pod.owner && (
                <>
                  <dt className="eyebrow">Owner</dt>
                  <dd style={{ margin: 0 }}>{pod.owner.kind} / {pod.owner.name}</dd>
                </>
              )}
              {pod.lastEvent && (
                <>
                  <dt className="eyebrow">Last event</dt>
                  <dd style={{ margin: 0 }}>{pod.lastEvent}</dd>
                </>
              )}
            </dl>
          )}
        </section>
      )}
      {!trello && <p className="eyebrow">Waiting for Trello iframe bootstrap…</p>}
    </main>
  );
};

export default LogStreamModal;
