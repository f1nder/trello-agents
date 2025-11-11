import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { DEFAULT_CLUSTER_SETTINGS, type ClusterSettings } from '../powerup/types/settings';
import { useAppliedTrelloTheme } from '../powerup/hooks/useAppliedTrelloTheme';
import { usePowerUpClient } from '../powerup/hooks/usePowerUpClient';
import { STORAGE_KEYS } from '../powerup/config/constants';
import { OpenShiftClient, OpenShiftRequestError } from '../powerup/services/openshiftClient';
import '../styles/index.css';
import '../pages/InnerPage.css';
import { trackEvent } from '../powerup/utils/analytics';

const BoardSettingsPage = () => {
  const trello = usePowerUpClient();
  const theme = useAppliedTrelloTheme(trello);
  const [formState, setFormState] = useState<ClusterSettings>(DEFAULT_CLUSTER_SETTINGS);
  const [status, setStatus] = useState<'idle' | 'saving' | 'loaded'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing'>('idle');

  useEffect(() => {
    const load = async () => {
      if (!trello) {
        return;
      }
      const saved = await trello.get<ClusterSettings>('board', 'private', STORAGE_KEYS.clusterConfig);
      if (saved) {
        setFormState((prev) => ({ ...prev, ...saved }));
      } else {
        setFormState(DEFAULT_CLUSTER_SETTINGS);
      }
      setStatus('loaded');
    };
    load();
  }, [trello]);

  const showToast = (tone: 'success' | 'error' | 'info', message: string) => {
    const display = tone === 'error' ? 'error' : 'info';
    if (trello) {
      void trello.alert({ message, display });
      return;
    }
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message);
    }
  };

  const handleChange = (field: keyof ClusterSettings) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = field === 'ignoreSsl' ? event.target.checked : event.target.value;
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trello) {
      return;
    }
    setStatus('saving');
    await trello.set('board', 'private', STORAGE_KEYS.clusterConfig, formState);
    setStatus('loaded');
    trackEvent(trello, 'settings-save');
    showToast('success', 'Settings saved');
  };

  const handleTestConnection = async () => {
    if (!trello) {
      return;
    }
    const trimmedUrl = formState.clusterUrl.trim();
    const trimmedNamespace = formState.namespace.trim();
    if (!trimmedUrl || !trimmedNamespace) {
      showToast('error', 'Add a cluster URL and namespace before testing.');
      return;
    }
    const token = (formState.token ?? '').trim();
    if (!token) {
      showToast('error', 'Store a service-account token before testing the connection.');
      return;
    }
    setTestStatus('testing');
    try {
      const client = new OpenShiftClient({
        baseUrl: trimmedUrl,
        namespace: trimmedNamespace,
        token,
        ignoreSsl: formState.ignoreSsl,
        caBundle: formState.caBundle,
      });
      await client.listPods({ namespace: trimmedNamespace });
      showToast('success', `Connected to ${trimmedNamespace}`);
      trackEvent(trello, 'settings-test-connection', { result: 'success' });
    } catch (error) {
      let message = 'Unable to reach the cluster. Double-check credentials.';
      if (error instanceof OpenShiftRequestError) {
        message = error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      showToast('error', message);
      trackEvent(trello, 'settings-test-connection', { result: 'error', message });
    } finally {
      setTestStatus('idle');
    }
  };

  const progressLabel =
    status === 'saving' ? 'Saving settings…' : testStatus === 'testing' ? 'Testing connection…' : null;

  return (
    <main className="inner-page" style={{ maxWidth: '640px' }} data-theme={theme}>
      <header>
        <p className="eyebrow">Board-level settings</p>
        <h1>Cluster connection</h1>
        <p className="lede">Configure OpenShift endpoint, namespace, and Trello-facing aliases.</p>
      </header>
      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          <span>Cluster URL</span>
          <input type="url" value={formState.clusterUrl} onChange={handleChange('clusterUrl')} required />
        </label>
        <label>
          <span>Namespace</span>
          <input type="text" value={formState.namespace} onChange={handleChange('namespace')} required />
        </label>
        <label>
          <span>Service-account token</span>
          <textarea
            value={formState.token ?? ''}
            onChange={(event) => setFormState((prev) => ({ ...prev, token: event.target.value }))}
            placeholder="Paste token value"
            rows={3}
          />
        </label>
        <label className="settings-form__checkbox">
          <input type="checkbox" checked={formState.ignoreSsl} onChange={handleChange('ignoreSsl')} />
          <span>Ignore SSL verification</span>
        </label>
        <div className="settings-actions">
          <button type="submit" disabled={!trello || status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save settings'}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={handleTestConnection}
            disabled={!trello || status === 'saving' || testStatus === 'testing'}
          >
            {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
          </button>
          {progressLabel && (
            <span className="settings-progress" role="status">
              <span className="settings-progress__spinner" aria-hidden="true" />
              {progressLabel}
            </span>
          )}
        </div>
      </form>
      <section style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#475569' }}>
        <p className="eyebrow">Security notes</p>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li>Tokens are stored as board-private config; paste a fresh value whenever you need to rotate credentials.</li>
          <li>Use Ignore SSL only when testing against trusted staging clusters.</li>
          <li>Run Test connection after edits to confirm Trello can reach your cluster.</li>
        </ul>
      </section>
      {status === 'idle' && <p className="eyebrow">Waiting for Trello iframe…</p>}
    </main>
  );
};

export default BoardSettingsPage;
