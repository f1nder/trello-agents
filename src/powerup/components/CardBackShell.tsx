import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AgentPod } from "../types/pods";
import type { OpenShiftPodApi } from "../services/openshiftClient";
import { useLivePods } from "../hooks/useLivePods";
import { usePowerUpClient } from "../hooks/usePowerUpClient";
import { useClusterSettings } from "../hooks/useClusterSettings";
import { useCardMetadata } from "../hooks/useCardMetadata";
import { OpenShiftClient } from "../services/openshiftClient";
import { resolveAssetUrl } from "../utils/url";
import { getPreviewConfig } from "../utils/preview";
import { useAppliedTrelloTheme } from "../hooks/useAppliedTrelloTheme";
import PodActions from "./PodActions";
import "../../styles/index.css";
import "../../pages/InnerPage.css";
import { trackEvent } from "../utils/analytics";
import { confirmPodDeletion } from "../utils/confirmPodDeletion";

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

const StatusIndicator = ({ phase }: { phase: string }) => {
  const kind = inferStatusKind(phase);
  let visual: ReactNode;
  if (kind === "running") {
    visual = <span className="status-indicator__spinner" aria-hidden="true" />;
  } else if (kind === "complete") {
    visual = (
      <svg
        className="status-indicator__icon status-indicator__icon--complete"
        viewBox="0 0 16 16"
        width="16"
        height="16"
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

const formatRuntime = (
  startTimestamp: string,
  nowMs: number = Date.now(),
  endTimestamp?: string | null
): string => {
  const start = Date.parse(startTimestamp);
  if (Number.isNaN(start)) return "–";
  const endMs = endTimestamp ? Date.parse(endTimestamp) : nowMs;
  const diffSec = Math.max(
    0,
    Math.floor(((Number.isNaN(endMs) ? nowMs : endMs) - start) / 1000)
  );
  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;
  const mm = String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss} m`;
};

const CardBackShell = () => {
  const trello = usePowerUpClient();
  const theme = useAppliedTrelloTheme(trello);
  const {
    settings,
    token,
    status: settingsStatus,
    error: settingsError,
    reload: reloadSettings,
  } = useClusterSettings(trello);
  const {
    card,
    status: cardStatus,
    error: cardError,
  } = useCardMetadata(trello);
  const [pendingStopIds, setPendingStopIds] = useState<Set<string>>(new Set());
  const previewConfig = getPreviewConfig();
  const previewClient = previewConfig?.openShiftClient ?? null;

  const openShiftClient: OpenShiftPodApi | null = useMemo(() => {
    if (previewClient) {
      return previewClient;
    }
    if (!settings.clusterUrl || !token) {
      return null;
    }
    return new OpenShiftClient({
      baseUrl: settings.clusterUrl,
      namespace: settings.namespace,
      token,
      ignoreSsl: settings.ignoreSsl,
      caBundle: settings.caBundle,
    });
  }, [previewClient, settings, token]);

  const livePods = useLivePods({
    client: openShiftClient,
    cardId: card?.id ?? null,
    namespace: settings.namespace,
  });

  const iconUrl = useMemo(() => resolveAssetUrl("/icons/card-agents.svg"), []);
  const sortedPods = useMemo(
    () =>
      [...livePods.pods].sort((a, b) => {
        const aTime = Date.parse(a.startedAt);
        const bTime = Date.parse(b.startedAt);
        if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
          return 0;
        }
        return bTime - aTime;
      }),
    [livePods.pods]
  );

  const isAwaitingInitialPods =
    sortedPods.length === 0 &&
    !livePods.initialLoadComplete &&
    (livePods.status === "idle" ||
      livePods.status === "loading" ||
      livePods.status === "connecting");
  const shouldShowEmptyState =
    sortedPods.length === 0 && livePods.initialLoadComplete;

  // Track which pods have been seen to animate only truly new insertions.
  const seenPodIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  useEffect(() => {
    // After each render, record all current IDs as seen.
    for (const p of sortedPods) {
      seenPodIdsRef.current.add(p.id);
    }
    if (!initializedRef.current) {
      initializedRef.current = true;
    }
  }, [sortedPods]);

  const markPending = (podId: string, nextState: boolean) => {
    setPendingStopIds((prev) => {
      const next = new Set(prev);
      if (nextState) {
        next.add(podId);
      } else {
        next.delete(podId);
      }
      return next;
    });
  };

  const handleStopPod = async (pod: AgentPod) => {
    if (!trello || !openShiftClient) {
      return;
    }
    const confirmed = await confirmPodDeletion(pod, trello);
    if (!confirmed) {
      return;
    }
    markPending(pod.id, true);
    try {
      await openShiftClient.stopPod(pod.name, {
        namespace: pod.namespace,
        owner: pod.owner ?? null,
      });
      trackEvent(trello, "stop-pod", {
        pod: pod.name,
        namespace: pod.namespace,
      });
      await trello.alert({
        message: `Stop requested for ${pod.name}`,
        display: "info",
      });
    } catch (error) {
      await trello.alert({
        message: `Failed to stop ${pod.name}: ${(error as Error).message}`,
        display: "error",
      });
    } finally {
      markPending(pod.id, false);
    }
  };

  const handleStreamLogs = async (pod: AgentPod) => {
    if (!trello) {
      return;
    }
    trackEvent(trello, "stream-logs", {
      pod: pod.name,
      namespace: pod.namespace,
    });
    await trello.modal({
      url: trello.signUrl(resolveAssetUrl("/logs.html")),
      title: `Logs · ${pod.name}`,
      height: 720,
      args: { pod },
    });
  };

  const readinessHints: string[] = [];
  if (!trello) {
    readinessHints.push("Waiting for Trello Power-Up iframe…");
  }
  if (settingsStatus === "loading") {
    readinessHints.push("Loading cluster settings…");
  }
  if (settingsStatus === "ready" && !settings.clusterUrl) {
    readinessHints.push(
      "Set the cluster URL inside the Power-Up settings page."
    );
  }
  if (settingsStatus === "ready" && !token) {
    readinessHints.push(
      "Store a service-account token to connect to OpenShift."
    );
  }
  if (cardStatus === "loading") {
    readinessHints.push("Fetching Trello card metadata…");
  }

  const issues = [settingsError, cardError, livePods.error].filter(
    Boolean
  ) as Error[];

  // tick every second so runtime includes seconds
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="inner-page" data-card-back data-theme={theme}>
      <header>
        <p
          className="eyebrow"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.5rem",
            margin: 0,
          }}
        >
          {/* Stream connection indicator: dot-only with optional label */}
          {(() => {
            const s = livePods.status;
            if (s === "error") {
              return (
                <>
                  <span
                    className="status-indicator__dot status-indicator__dot--error"
                    aria-hidden="true"
                  />
                </>
              );
            }
            if (s === "connecting" || s === "loading") {
              return (
                <>
                  <span
                    className="status-indicator__dot status-indicator__dot--pending"
                    aria-hidden="true"
                  />
                </>
              );
            }
            if (s === "streaming") {
              return (
                <>
                  <span>ok</span>
                  <span
                    className="status-indicator__dot status-indicator__dot--connected"
                    aria-hidden="true"
                  />
                </>
              );
            }
            // idle or unknown → show nothing (no label)
            return null;
          })()}
        </p>
        {readinessHints.length > 0 && (
          <ul
            style={{
              margin: "0.75rem 0 0",
              paddingLeft: "1.25rem",
              color: "var(--ca-warning-text)",
              fontSize: "0.95rem",
            }}
          >
            {readinessHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        )}
        {trello &&
          settingsStatus === "ready" &&
          (!settings.clusterUrl || !token) && (
            <div style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    trackEvent(trello, "open-settings-from-card");
                    await trello.modal({
                      url: trello.signUrl(resolveAssetUrl("/settings.html")),
                      title: "Cluster Settings",
                      height: 520,
                    });
                    // User may have saved new settings/token; refresh state.
                    reloadSettings();
                  } catch (err) {
                    await trello.alert({
                      message: "Unable to open settings",
                      display: "error",
                    });
                  }
                }}
                style={{
                  appearance: "none",
                  border: 0,
                  background: "var(--ca-primary)",
                  color: "var(--ca-primary-contrast)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Open Settings
              </button>
            </div>
          )}
        {issues.length > 0 && (
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              background: "var(--ca-issue-bg)",
              color: "var(--ca-issue-text)",
            }}
          >
            {issues.map((error) => (
              <p key={error.message} style={{ margin: 0 }}>
                {error.message}
              </p>
            ))}
          </div>
        )}
      </header>

      <section className="pod-list">
        {sortedPods.map((pod) => {
          const isNew =
            initializedRef.current && !seenPodIdsRef.current.has(pod.id);
          const kind = inferStatusKind(pod.phase);
          const rowClass =
            "pod-row" +
            (isNew ? " pod-row--enter" : "") +
            (kind === "pending" ? " pod-row--dimmed" : "");
          return (
            <article key={pod.id} className={rowClass}>
              <div className="pod-row__status">
                <StatusIndicator phase={pod.phase} />
              </div>
              <div className="pod-row__meta">
                <strong>{pod.displayName ?? pod.name}</strong>
                <span
                  className="pod-row__time"
                  title={`Started ${new Date(pod.startedAt).toLocaleString()}`}
                >
                  {pod.agent || pod.model ? (
                    <span className="pod-row__agentline">
                      <span className="pod-row__agentname">
                        {pod.agent ?? "?"}
                      </span>
                      {pod.model ? (
                        <span className="pod-row__modelline">
                          {" · "}
                          {pod.model}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {pod.agent || pod.model ? " · " : ""}
                  {formatRuntime(
                    pod.runtimeStart ?? pod.startedAt,
                    now,
                    pod.runtimeEnd
                  )}{" "}
                  · {pod.lastEvent ?? "no events yet"}
                </span>
              </div>
              <div className="pod-row__actions">
                <PodActions
                  pod={pod}
                  onStop={handleStopPod}
                  onStreamLogs={handleStreamLogs}
                  disabled={
                    !trello || !openShiftClient || readinessHints.length > 0
                  }
                  isStopping={pendingStopIds.has(pod.id)}
                  variant="compact"
                  showStop={inferStatusKind(pod.phase) === "running"}
                />
              </div>
            </article>
          );
        })}
        {isAwaitingInitialPods &&
          Array.from({ length: 2 }).map((_, index) => (
            <article
              key={`pod-skeleton-${index}`}
              className="pod-row pod-row--skeleton"
              aria-hidden="true"
            >
              <div className="pod-row__status">
                <span className="skeleton-block skeleton-block--icon" />
              </div>
              <div className="pod-row__meta">
                <span className="skeleton-block skeleton-block--text" />
                <span className="skeleton-block skeleton-block--text skeleton-block--thin" />
              </div>
              <div className="pod-row__actions">
                <span className="skeleton-block skeleton-block--button" />
              </div>
            </article>
          ))}
        {shouldShowEmptyState && (
          <article className="pod-row pod-row--empty">
            <div className="pod-row__meta">
              <strong>No pods in scope</strong>
              <span className="pod-row__time">
                Either this Trello card has no running agents or the
                service-account token lacks permissions.
              </span>
            </div>
          </article>
        )}
      </section>
    </main>
  );
};

export default CardBackShell;
