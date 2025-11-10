import type { AgentPod } from "../types/pods";

interface PodActionsProps {
  pod: AgentPod;
  onStop?: (pod: AgentPod) => Promise<void> | void;
  onStreamLogs?: (pod: AgentPod) => Promise<void> | void;
  disabled?: boolean;
  isStopping?: boolean;
  variant?: "default" | "compact";
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

const IconLogs = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M3 2.5h8A1.5 1.5 0 0 1 12.5 4v6A1.5 1.5 0 0 1 11 11.5H5.414l-2.707 2.293A.5.5 0 0 1 2 13.5v-9A2 2 0 0 1 4 2.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PodActions = ({
  pod,
  onStop,
  onStreamLogs,
  disabled = false,
  isStopping = false,
  variant = "default",
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
        <button
          type="button"
          className="icon-button"
          disabled={logsDisabled}
          onClick={openLogs}
          aria-label="Open logs"
          title="Open logs"
        >
          <IconLogs />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
      <button type="button" disabled={stopDisabled} onClick={stopPod}>
        {isStopping ? "Stopping…" : "Stop pod"}
      </button>
      <button type="button" disabled={logsDisabled} onClick={openLogs}>
        Stream logs
      </button>
    </div>
  );
};

export default PodActions;
