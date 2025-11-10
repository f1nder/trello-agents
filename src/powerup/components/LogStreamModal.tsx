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
        <p className="eyebrow">Streaming logs</p>
        <h1>{pod ? pod.name : 'Pod logs'}</h1>
        <p className="lede">
          {pod
            ? `Namespace ${pod.namespace} · container ${pod.containers[0] ?? 'default'}`
            : 'Waiting for pod context from Trello…'}
        </p>
        <p className="eyebrow">Status: {status}</p>
        {settingsStatus !== 'ready' && <p className="eyebrow">Loading board settings…</p>}
        {error && (
          <p style={{ color: 'var(--ca-error-text)', margin: 0 }}>
            {error.message}. Verify the token permits log streaming for this namespace.
          </p>
        )}
      </header>
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
      {!trello && <p className="eyebrow">Waiting for Trello iframe bootstrap…</p>}
    </main>
  );
};

export default LogStreamModal;
