import type { AgentPod } from '../types/pods';

interface PodActionsProps {
  pod: AgentPod;
  onStop?: (pod: AgentPod) => Promise<void> | void;
  onStreamLogs?: (pod: AgentPod) => Promise<void> | void;
  disabled?: boolean;
  isStopping?: boolean;
}

const PodActions = ({ pod, onStop, onStreamLogs, disabled = false, isStopping = false }: PodActionsProps) => {
  const stopDisabled = disabled || !onStop || isStopping;
  const logsDisabled = disabled || !onStreamLogs;

  const stopPod = async () => {
    if (stopDisabled || !onStop) {
      return;
    }
    await onStop(pod);
  };

  const openLogs = async () => {
    if (logsDisabled || !onStreamLogs) {
      return;
    }
    await onStreamLogs(pod);
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
      <button type="button" disabled={stopDisabled} onClick={stopPod}>
        {isStopping ? 'Stopping…' : 'Stop pod'}
      </button>
      <button type="button" disabled={logsDisabled} onClick={openLogs}>
        Stream logs
      </button>
    </div>
  );
};

export default PodActions;
