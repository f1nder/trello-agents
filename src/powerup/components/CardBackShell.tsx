import { useMemo } from 'react';
import { useLivePods } from '../hooks/useLivePods';
import { usePowerUpClient } from '../hooks/usePowerUpClient';
import { resolveAssetUrl } from '../utils/url';
import PodActions from './PodActions';
import '../../styles/index.css';
import '../../pages/InnerPage.css';

const CardBackShell = () => {
  const client = usePowerUpClient();
  const { groups, status } = useLivePods();

  const iconUrl = useMemo(() => resolveAssetUrl('/icons/card-agents.svg'), []);

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
          This iframe mirrors the upcoming Trello card-back section. It renders grouped pods from the OpenShift watch
          stream and exposes Stop Pod / Stream Logs actions.
        </p>
        <p className="eyebrow">Stream status: {status}</p>
      </header>

      <section className="status-grid">
        {groups.map((group) => (
          <article key={group.phase}>
            <span className="badge">{group.phase}</span>
            <h2>{group.pods.length} pods</h2>
            <ul style={{ paddingLeft: '1rem', margin: '0.5rem 0 0', listStyle: 'disc' }}>
              {group.pods.map((pod) => (
                <li key={pod.id} style={{ marginBottom: '0.35rem' }}>
                  <strong>{pod.name}</strong>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>Started {new Date(pod.startedAt).toLocaleString()}</div>
                  <PodActions pod={pod} trello={client} />
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
};

export default CardBackShell;
