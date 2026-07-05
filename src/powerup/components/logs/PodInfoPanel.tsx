import type { FC } from "react";
import type { AgentPod } from "../../types/pods";
import type { ClusterSettings } from "../../types/settings";

type Props = {
  pod: AgentPod | null | undefined;
  settings: ClusterSettings | null;
};

// Builds a Kubernetes-dashboard deep link to a pod. Uses the same scheme as the
// upstream Kubernetes Dashboard (`#/pod/<namespace>/<name>?namespace=<namespace>`),
// which is a sensible generic default. The dashboard base URL is configured via
// `consoleUrl` in board settings; when it is absent, no link is rendered.
const getConsolePodUrl = (
  consoleUrl: string | undefined,
  namespace: string,
  podName: string
): string | null => {
  if (!consoleUrl) return null;
  try {
    const base = new URL(consoleUrl);
    // Preserve any base path the user configured, then append the pod route.
    const trimmedPath = base.pathname.replace(/\/$/, "");
    base.pathname = trimmedPath;
    base.hash = `#/pod/${encodeURIComponent(namespace)}/${encodeURIComponent(
      podName
    )}?namespace=${encodeURIComponent(namespace)}`;
    return base.toString();
  } catch {
    return null;
  }
};

export const PodInfoPanel: FC<Props> = ({ pod, settings }) => {
  return (
    <section
      className="tab-panel"
      style={{
        background: "var(--ca-surface)",
        color: "var(--ca-text)",
        borderRadius: "0.75rem",
        padding: "1rem",
        border: "1px solid var(--ca-border)",
      }}
    >
      {!pod ? (
        <p style={{ margin: 0, opacity: 0.8 }}>No pod context.</p>
      ) : (
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 1fr) 2fr",
            gap: "0.5rem 1rem",
            margin: 0,
          }}
        >
          <dt className="eyebrow">Name</dt>
          <dd style={{ margin: 0 }}>{pod.name}</dd>
          <dt className="eyebrow">Namespace</dt>
          <dd style={{ margin: 0 }}>{pod.namespace}</dd>
          {settings?.consoleUrl && (
            <>
              <dt className="eyebrow">Dashboard</dt>
              <dd style={{ margin: 0 }}>
                {(() => {
                  const href = getConsolePodUrl(
                    settings.consoleUrl,
                    pod.namespace,
                    pod.name
                  );
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Dashboard"
                    >
                      Open in Dashboard ↗
                    </a>
                  ) : (
                    <span style={{ opacity: 0.7 }}>Link unavailable</span>
                  );
                })()}
              </dd>
            </>
          )}
          <dt className="eyebrow">Phase</dt>
          <dd style={{ margin: 0 }}>{pod.phase}</dd>
          <dt className="eyebrow">Started</dt>
          <dd style={{ margin: 0 }}>
            {new Date(pod.startedAt).toLocaleString()}
          </dd>
          <dt className="eyebrow">Containers</dt>
          <dd style={{ margin: 0 }}>{pod.containers.join(", ") || "—"}</dd>
          {pod.nodeName && (
            <>
              <dt className="eyebrow">Node</dt>
              <dd style={{ margin: 0 }}>{pod.nodeName}</dd>
            </>
          )}
          {typeof pod.restarts === "number" && (
            <>
              <dt className="eyebrow">Restarts</dt>
              <dd style={{ margin: 0 }}>{pod.restarts}</dd>
            </>
          )}
          {pod.owner && (
            <>
              <dt className="eyebrow">Owner</dt>
              <dd style={{ margin: 0 }}>
                {pod.owner.kind} / {pod.owner.name}
              </dd>
            </>
          )}
          {pod.lastEvent && (
            <>
              <dt className="eyebrow">Last event</dt>
              <dd style={{ margin: 0 }}>{pod.lastEvent}</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
};
