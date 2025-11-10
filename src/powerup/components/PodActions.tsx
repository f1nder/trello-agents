import type { AgentPod } from '../types/pods';
import { resolveAssetUrl } from '../utils/url';

interface PodActionsProps {
  pod: AgentPod;
  trello: TrelloPowerUp.Client | null;
}

const PodActions = ({ pod, trello }: PodActionsProps) => {
  const disabled = !trello;

  const stopPod = async () => {
    if (!trello) {
      return;
    }
    await trello.alert({ message: `Stop Pod invoked for ${pod.name}`, display: 'info' });
    trello.track('stop-pod', { pod: pod.name });
  };

  const openLogs = async () => {
    if (!trello) {
      return;
    }
    await trello.modal({
      url: trello.signUrl(resolveAssetUrl('/logs.html')),
      title: `Logs · ${pod.name}`,
      height: 720,
    });
    trello.track('stream-logs', { pod: pod.name });
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
      <button type="button" disabled={disabled} onClick={stopPod}>
        Stop pod
      </button>
      <button type="button" disabled={disabled} onClick={openLogs}>
        Stream logs
      </button>
    </div>
  );
};

export default PodActions;
