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
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'loaded'>('idle');
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing'>('idle');
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!trello) {
        return;
      }
      const saved = await trello.get<ClusterSettings>('board', 'private', STORAGE_KEYS.clusterConfig);
      if (saved) {
        setFormState(saved);
        setHasStoredToken(Boolean(saved.tokenSecretId));
      } else {
        setHasStoredToken(false);
      }
      setStatus('loaded');
    };
    load();
  }, [trello]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (tone: 'success' | 'error' | 'info', message: string) => {
    setToast({ tone, message });
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
    let nextTokenSecretId = formState.tokenSecretId;
    if (tokenInput.trim()) {
      const secretKey = `${STORAGE_KEYS.tokenSecretId}:${Date.now().toString(36)}`;
      await trello.storeSecret(secretKey, tokenInput.trim());
      nextTokenSecretId = secretKey;
      setTokenInput('');
      setHasStoredToken(true);
    }
    await trello.set('board', 'private', STORAGE_KEYS.clusterConfig, { ...formState, tokenSecretId: nextTokenSecretId });
    setFormState((prev) => ({ ...prev, tokenSecretId: nextTokenSecretId }));
    setHasStoredToken(Boolean(nextTokenSecretId));
    setStatus('loaded');
    trackEvent(trello, 'settings-save');
    showToast('success', 'Settings saved');
  };

  const resolveToken = async () => {
    if (tokenInput.trim()) {
      return tokenInput.trim();
    }
    if (!trello || !formState.tokenSecretId) {
      return null;
    }
    try {
      return await trello.loadSecret(formState.tokenSecretId);
    } catch {
      return null;
    }
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
    const token = await resolveToken();
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
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder={hasStoredToken ? 'Token already stored — paste a new token to rotate' : 'Paste token value'}
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
          <li>Tokens are stored via Trello secrets; leave the field blank to keep the current token.</li>
          <li>Use Ignore SSL only when testing against trusted staging clusters.</li>
          <li>Run Test connection after edits to confirm Trello can reach your cluster.</li>
        </ul>
      </section>
      {status === 'idle' && <p className="eyebrow">Waiting for Trello iframe…</p>}
      {toast && (
        <div className="toast-stack" aria-live="polite">
          <div className={`toast toast--${toast.tone}`}>{toast.message}</div>
        </div>
      )}
    </main>
  );
};

export default BoardSettingsPage;
