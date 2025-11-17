import type { FC, ReactNode } from "react";

type StatusKind = "running" | "pending" | "complete" | "error";

const statusFamilies: Record<StatusKind, string[]> = {
  running: ["running"],
  pending: [
    "pending",
    "initialize",
    "initializing",
    "containercreating",
    "queued",
    "waiting",
  ],
  complete: ["succeeded", "completed", "complete"],
  error: [
    "failed",
    "error",
    "unknown",
    "terminating",
    "crashloopbackoff",
    "evicted",
  ],
};

const inferStatusKind = (phase: string): StatusKind => {
  const normalized = phase.toLowerCase();
  if (statusFamilies.running.includes(normalized)) {
    return "running";
  }
  if (statusFamilies.pending.includes(normalized)) {
    return "pending";
  }
  if (statusFamilies.complete.includes(normalized)) {
    return "complete";
  }
  if (statusFamilies.error.includes(normalized)) {
    return "error";
  }
  return "pending";
};

type PodStatusProps = {
  phase: string;
};

export const StatusIndicator: FC<PodStatusProps> = ({ phase }) => {
  const kind = inferStatusKind(phase);
  let visual: ReactNode;

  if (kind === "running") {
    visual = <span className="status-indicator__spinner" aria-hidden="true" />;
  } else if (kind === "complete") {
    visual = (
      <svg
        className="status-indicator__icon status-indicator__icon--complete"
        viewBox="0 0 16 16"
        width="18"
        height="18"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042-.018L6.75 9.19 5.28 7.72a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042l2 2a.75.75 0 0 0 1.06 0Z" />
      </svg>
    );
  } else if (kind === "error") {
    visual = (
      <span
        className="status-indicator__dot status-indicator__dot--error"
        aria-hidden="true"
      />
    );
  } else {
    visual = (
      <span
        className="status-indicator__dot status-indicator__dot--pending"
        aria-hidden="true"
      />
    );
  }

  return (
    <span className="status-indicator" role="img" aria-label={`${phase} pod`}>
      {visual}
      <span className="sr-only">{phase}</span>
    </span>
  );
};

type LogConnectionStatus = "idle" | "connecting" | "streaming" | "error";

type LogConnectionProps = {
  status: LogConnectionStatus;
};

export const LogConnectionIndicator: FC<LogConnectionProps> = ({ status }) => {
  const labelMap: Record<LogConnectionStatus, string> = {
    idle: "Idle",
    connecting: "Connecting",
    streaming: "Connected",
    error: "Error",
  };
  const label = labelMap[status];
  const dotClass =
    status === "streaming"
      ? "status-indicator__dot status-indicator__dot--connected"
      : status === "error"
      ? "status-indicator__dot status-indicator__dot--error"
      : "status-indicator__dot status-indicator__dot--pending";

  return (
    <span
      className="status-indicator"
      role="status"
      aria-live="polite"
      title={`Log stream: ${label}`}
    >
      {status === "connecting" ? (
        <span className="status-indicator__spinner" aria-hidden="true" />
      ) : (
        <span className={dotClass} aria-hidden="true" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
};
