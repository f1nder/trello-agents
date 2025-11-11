import type { AgentPod } from "../types/pods";

interface PodActionsProps {
  pod: AgentPod;
  onStop?: (pod: AgentPod) => Promise<void> | void;
  onStreamLogs?: (pod: AgentPod) => Promise<void> | void;
  disabled?: boolean;
  isStopping?: boolean;
  variant?: "default" | "compact";
  showStop?: boolean;
}

const IconStop = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      x="3"
      y="3"
      width="8"
      height="8"
      rx="2"
      fill="#f33c3c"
      fillOpacity="0.7"
    />
  </svg>
);

// Contextual logs icon: terminal panel with tailing lines
const IconLogs = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
    <rect x="1.5" y="2" width="11" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M3 5h6M3 7h8M3 9h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const PodActions = ({
  pod,
  onStop,
  onStreamLogs,
  disabled = false,
  isStopping = false,
  variant = "default",
  showStop = true,
}: PodActionsProps) => {
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

  if (variant === "compact") {
    return (
      <div style={{ display: "flex", gap: "0.35rem" }}>
        {showStop && (
          <button
            type="button"
            className="icon-button"
            disabled={stopDisabled}
            onClick={stopPod}
            aria-label={isStopping ? "Stopping pod" : "Stop pod"}
            title="Stop pod"
          >
            {isStopping ? (
              <span className="icon-button__spinner" aria-hidden="true" />
            ) : (
              <IconStop />
            )}
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          disabled={logsDisabled}
          onClick={openLogs}
          aria-label="Tail logs"
          title="Tail logs"
        >
          <IconLogs />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
      {showStop && (
        <button type="button" disabled={stopDisabled} onClick={stopPod}>
          {isStopping ? "Stopping…" : "Stop pod"}
        </button>
      )}
      <button type="button" disabled={logsDisabled} onClick={openLogs}>
        Stream logs
      </button>
    </div>
  );
};

export default PodActions;
