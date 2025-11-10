import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { DEFAULT_CLUSTER_SETTINGS, type ClusterSettings } from '../powerup/types/settings';
import { usePowerUpClient } from '../powerup/hooks/usePowerUpClient';
import { STORAGE_KEYS } from '../powerup/config/constants';
import '../styles/index.css';
import '../pages/InnerPage.css';

const BoardSettingsPage = () => {
  const trello = usePowerUpClient();
  const [formState, setFormState] = useState<ClusterSettings>(DEFAULT_CLUSTER_SETTINGS);
  const [status, setStatus] = useState<'idle' | 'saving' | 'loaded'>('idle');

  useEffect(() => {
    const load = async () => {
      if (!trello) {
        return;
      }
      const saved = await trello.get<ClusterSettings>('board', 'private', STORAGE_KEYS.clusterConfig);
      if (saved) {
        setFormState(saved);
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
    await trello.set('board', 'private', STORAGE_KEYS.clusterConfig, formState);
    if (formState.tokenSecretId) {
      await trello.storeSecret(STORAGE_KEYS.tokenSecretId, formState.tokenSecretId);
    }
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
          <span>Token secret ID</span>
          <input type="password" value={formState.tokenSecretId} onChange={handleChange('tokenSecretId')} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={formState.ignoreSsl} onChange={handleChange('ignoreSsl')} />
          <span>Ignore SSL verification</span>
        </label>
        <button type="submit" disabled={!trello || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save settings'}
        </button>
      </form>
      {status === 'idle' && <p className="eyebrow">Waiting for Trello iframe…</p>}
    </main>
  );
};

export default BoardSettingsPage;
