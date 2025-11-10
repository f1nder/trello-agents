import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { DEFAULT_CLUSTER_SETTINGS, type ClusterSettings } from '../powerup/types/settings';
import { usePowerUpClient } from '../powerup/hooks/usePowerUpClient';
import { STORAGE_KEYS } from '../powerup/config/constants';
import '../styles/index.css';
import '../pages/InnerPage.css';

const BoardSettingsPage = () => {
  const trello = usePowerUpClient();
  const [formState, setFormState] = useState<ClusterSettings>(DEFAULT_CLUSTER_SETTINGS);
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'loaded'>('idle');
  const [hasStoredToken, setHasStoredToken] = useState(false);

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
      nextTokenSecretId = await trello.storeSecret(secretKey, tokenInput.trim());
      setTokenInput('');
      setHasStoredToken(true);
    }
    await trello.set('board', 'private', STORAGE_KEYS.clusterConfig, { ...formState, tokenSecretId: nextTokenSecretId });
    setFormState((prev) => ({ ...prev, tokenSecretId: nextTokenSecretId }));
    setHasStoredToken(Boolean(nextTokenSecretId));
    setStatus('loaded');
    trello.track('settings-save');
  };

  return (
    <main className="inner-page" style={{ maxWidth: '640px' }}>
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
          <span>Login display alias</span>
          <input type="text" value={formState.loginAlias} onChange={handleChange('loginAlias')} />
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={formState.ignoreSsl} onChange={handleChange('ignoreSsl')} />
          <span>Ignore SSL verification</span>
        </label>
        <label>
          <span>Custom CA bundle (PEM)</span>
          <textarea
            value={formState.caBundle ?? ''}
            onChange={(event) => setFormState((prev) => ({ ...prev, caBundle: event.target.value }))}
            rows={3}
            placeholder="-----BEGIN CERTIFICATE-----"
          />
        </label>
        <button type="submit" disabled={!trello || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save settings'}
        </button>
      </form>
      <section style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#475569' }}>
        <p className="eyebrow">Security notes</p>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li>Tokens are stored via Trello secrets; leave the field blank to keep the current token.</li>
          <li>Provide a PEM-encoded CA bundle if your cluster uses a custom certificate authority.</li>
          <li>Use Ignore SSL only for trusted staging clusters—production should rely on CA bundles.</li>
        </ul>
      </section>
      {status === 'idle' && <p className="eyebrow">Waiting for Trello iframe…</p>}
    </main>
  );
};

export default BoardSettingsPage;
