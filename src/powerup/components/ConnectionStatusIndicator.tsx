import type { ReactNode } from "react";

type ConnectionStatus =
  | "idle"
  | "loading"
  | "connecting"
  | "streaming"
  | "error";

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus | null | undefined;
  label?: string;
  className?: string;
}

const ConnectionStatusIndicator = ({
  status,
  label,
  className,
}: ConnectionStatusIndicatorProps) => {
  if (!status || status === "idle") {
    return null;
  }

  const normalizedLabel = label ?? `Connection status: ${status}`;

  let visual: ReactNode;
  if (status === "streaming") {
    visual = (
      <span
        className="status-indicator__dot status-indicator__dot--connected"
        aria-hidden="true"
      />
    );
  } else if (status === "error") {
    visual = (
      <span
        className="status-indicator__dot status-indicator__dot--error"
        aria-hidden="true"
      />
    );
  } else {
    // loading / connecting
    visual = <span className="status-indicator__spinner" aria-hidden="true" />;
  }

  const classes = ["status-indicator", className].filter(Boolean).join(" ");

  return (
    <span className={classes} role="img" aria-label={normalizedLabel}>
      {visual}
      <span className="sr-only">{normalizedLabel}</span>
    </span>
  );
};

export default ConnectionStatusIndicator;
