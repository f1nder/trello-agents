import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  useCallback,
} from "react";
import { usePowerUpClient } from "../hooks/usePowerUpClient";
import { useClusterSettings } from "../hooks/useClusterSettings";
import { OpenShiftClient } from "../services/openshiftClient";
import type { AgentPod } from "../types/pods";
import { confirmPodDeletion } from "../utils/confirmPodDeletion";
import type { OpenShiftPodApi } from "../services/openshiftClient";
import { getPreviewConfig } from "../utils/preview";
import { useAppliedTrelloTheme } from "../hooks/useAppliedTrelloTheme";
import { LazyLog } from "@melloware/react-logviewer";
import "../../styles/index.css";
import "../../pages/InnerPage.css";
import ConnectionStatusIndicator from "./ConnectionStatusIndicator";
import { getDisplayableError } from "../utils/errors";

const TAB_OPTIONS = [
  {
    id: "logs" as const,
    label: "Logs",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 17l4-4 4 4 4-4 4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 7h16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "info" as const,
    label: "Info",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="8" r="1" fill="currentColor" />
        <path
          d="M12 12v4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "prompts" as const,
    label: "Prompts",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 6h16M4 12h16M4 18h10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const textDecoder = new TextDecoder();

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
  let visual: React.ReactNode;
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

const renderStatusIndicator = (
  status: "idle" | "connecting" | "streaming" | "error"
) => {
  const labelMap: Record<typeof status, string> = {
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

const LogStreamModal = () => {
  const trello = usePowerUpClient();
  const theme = useAppliedTrelloTheme(trello);
  const {
    settings,
    token,
    status: settingsStatus,
  } = useClusterSettings(trello);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "streaming" | "error"
  >("idle");
  const [error, setError] = useState<Error | null>(null);
  const [tab, setTab] = useState<"logs" | "info" | "prompts">("logs");
  const [follow, setFollow] = useState(true);
  const [lineCount, setLineCount] = useState(0);
  const logRef = useRef<LazyLog | null>(null);
  // Queue lines that arrive before the <LazyLog> ref is ready.
  const pendingLinesRef = useRef<string[]>([]);
  const ignoreScrollRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const previewConfig = getPreviewConfig();
  const displayableError = getDisplayableError(error);
  const pod = trello?.arg<AgentPod>("pod");
  const initialLogText = "";
  const logKey = pod ? `${pod.namespace}-${pod.name}` : "logs";

  const appendLinesSafely = useCallback((lines: string[]) => {
    if (!lines.length) return;
    const target = logRef.current;
    if (target) {
      target.appendLines(lines);
      return;
    }
    // LazyLog not ready yet; buffer and let the next attempt flush.
    pendingLinesRef.current.push(...lines);
  }, []);

  // Flush any buffered lines once the ref becomes ready.
  useEffect(() => {
    if (logRef.current && pendingLinesRef.current.length > 0) {
      logRef.current.appendLines(pendingLinesRef.current);
      pendingLinesRef.current = [];
    }
  });
  const handleScroll = useCallback(
    ({
      scrollTop,
      scrollHeight,
      clientHeight,
    }: {
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
    }) => {
      if (ignoreScrollRef.current) return;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom <= 8; // small buffer for smooth scroll
      if (follow && !isNearBottom) {
        setFollow(false);
      }
    },
    [follow]
  );

  const resumeFollow = useCallback(() => {
    ignoreScrollRef.current = true;
    setFollow(true);
    // allow LazyLog to settle its own scroll before we listen again
    setTimeout(() => {
      ignoreScrollRef.current = false;
    }, 150);
  }, []);

  const previewClient = previewConfig?.openShiftClient ?? null;
  const openShiftClient: OpenShiftPodApi | null = useMemo(() => {
    if (previewClient) {
      return previewClient;
    }
    if (!token || !settings.clusterUrl) {
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

  // Build OpenShift Console Pod URL in the requested form:
  // https://<host>:<port>/console/project/<ns>/browse/pods/<pod>?tab=details
  const getConsolePodUrl = (
    clusterUrl: string | undefined,
    namespace: string,
    podName: string
  ): string | null => {
    if (!clusterUrl) return null;
    try {
      const u = new URL(clusterUrl);
      const base = `${u.protocol}//${u.host}`; // keep protocol + host(+port)
      const path = `/console/project/${encodeURIComponent(
        namespace
      )}/browse/pods/${encodeURIComponent(podName)}?tab=details`;
      return `${base}${path}`;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!pod || !openShiftClient) {
      return;
    }

    const abortController = new AbortController();
    abortRef.current = abortController;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let cancelled = false;
    let stopWatching: (() => void) | null = null;

    // reset UI state on pod change
    setLineCount(0);
    setFollow(true);
    setError(null);

    const canStreamFromPhase = (phase: string | undefined) =>
      phase !== "Pending" && phase !== "Unknown"; // avoid connecting while pending/unresolved

    const startStreaming = async () => {
      try {
        setStatus("connecting");
        reader = await openShiftClient.streamLogs(pod.name, {
          namespace: pod.namespace,
          container: pod.containers[0],
          signal: abortController.signal,
          tailLines: 10000,
        });
        setStatus("streaming");
        let buffered = "";
        const flushBuffered = () => {
          const segments = buffered.split("\n");
          buffered = segments.pop() ?? "";
          const nextLines = segments.filter((segment) => segment.length > 0);
          if (nextLines.length === 0) {
            return;
          }
          appendLinesSafely(
            nextLines.map((line) =>
              line.replace(
                /^[\t\s]*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\s*/,
                ""
              )
            )
          );
          setLineCount((prev) => prev + nextLines.length);
        };

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (value) {
            buffered += textDecoder.decode(value, { stream: true });
            flushBuffered();
          }
          if (done) {
            // ensure any trailing partial line is flushed when the stream closes
            flushBuffered();
            break;
          }
        }
      } catch (streamError) {
        if (
          cancelled ||
          (streamError instanceof DOMException &&
            streamError.name === "AbortError")
        ) {
          return;
        }
        setStatus("error");
        setError(streamError as Error);
      }
    };

    // If pod is ready (not pending), connect immediately. Otherwise, watch for transition.
    if (canStreamFromPhase(pod.phase)) {
      startStreaming();
    } else {
      setStatus("idle");
      // Watch only the specific pod by name and namespace, and connect when it transitions
      stopWatching = openShiftClient.watchPods(
        (evt) => {
          if (evt.pod.name !== pod.name) return;
          if (canStreamFromPhase(evt.pod.phase) && !cancelled) {
            // stop watching and begin streaming
            stopWatching?.();
            stopWatching = null;
            startStreaming();
          }
        },
        {
          namespace: pod.namespace,
          fieldSelector: `metadata.name=${pod.name}`,
          onError: (err) => {
            // surface watch errors when we cannot recover
            if (!cancelled) {
              setStatus("error");
              setError(err);
            }
          },
        }
      );
    }

    return () => {
      cancelled = true;
      abortController.abort();
      reader?.cancel().catch(() => undefined);
      stopWatching?.();
      abortRef.current = null;
    };
  }, [openShiftClient, pod]);

  const stopPod = async () => {
    if (!pod || !openShiftClient || isStopping) return;
    const confirmed = await confirmPodDeletion(pod, trello);
    if (!confirmed) {
      return;
    }
    try {
      setIsStopping(true);
      abortRef.current?.abort();
      await openShiftClient.stopPod(pod.name, {
        namespace: pod.namespace,
        owner: pod.owner ?? null,
      });
      await trello?.alert?.({
        message: `Stop requested for ${pod.name}`,
        display: "info",
      });
    } catch (err) {
      await trello?.alert?.({
        message: `Failed to stop ${pod?.name}: ${(err as Error).message}`,
        display: "error",
      });
    } finally {
      setIsStopping(false);
    }
  };

  const podTitle = useMemo(() => {
    if (!pod) {
      return "Pod";
    }
    const jobLabel = pod.displayName ?? pod.jobName ?? null;
    if (jobLabel && jobLabel !== pod.name) {
      return `${jobLabel}`;
    }
    return jobLabel ?? pod.name;
  }, [pod]);

  return (
    <main className="inner-page" style={{ gap: "0.5rem" }} data-theme={theme}>
      <header>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {pod && <StatusIndicator phase={pod.phase} />}
          <h2 style={{ margin: "1.5rem 0" }}>{podTitle}</h2>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div
            className="log-toolbar"
            role="toolbar"
            aria-label="Log controls"
            style={{
              paddingLeft: "0.5rem",
              width: "100%",
              justifyContent: "space-between",
            }}
          >
            <div className="segmented" role="tablist" aria-label="Log views">
              {TAB_OPTIONS.map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`segmented__button ${
                    tab === id ? "is-active" : ""
                  }`}
                  onClick={() => setTab(id)}
                >
                  {id === "logs" && renderStatusIndicator(status)}
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <span className="eyebrow" style={{ paddingRight: "0.5rem" }}>
              Rows: {lineCount}
            </span>
            <button
              type="button"
              className="segmented__button segmented__button--danger"
              onClick={stopPod}
              disabled={isStopping || !openShiftClient}
              aria-label={isStopping ? "Stopping pod" : "Stop pod"}
              title="Stop pod"
            >
              {isStopping ? (
                <>
                  <span className="segmented__spinner" aria-hidden="true" />
                  <span>Stopping…</span>
                </>
              ) : (
                <>
                  <svg
                    width="12"
                    height="12"
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
                      fill="currentColor"
                      fillOpacity="0.85"
                    />
                  </svg>
                  <span>Stop</span>
                </>
              )}
            </button>
          </div>
        </div>
        {settingsStatus !== "ready" && (
          <p className="eyebrow">Loading board settings…</p>
        )}
        {displayableError && (
          <p style={{ color: "var(--ca-error-text)", margin: 0 }}>
            {displayableError.message}. Verify the token permits log streaming
            for this namespace.
          </p>
        )}
      </header>
      {tab === "logs" && (
        <section className="tab-panel" style={{ padding: 0 }}>
          <div
            style={{
              height: "clamp(420px, 60vh, 70vh)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                background: "var(--ca-log-bg)",
                color: "var(--ca-log-text)",
                borderRadius: "0.75rem",
                padding: "0.5rem 0.75rem 0.75rem",
                fontFamily:
                  '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
                position: "relative",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Resume button positioned in top right corner of LazyLog block when following is paused */}
              {!follow && (
                <button
                  type="button"
                  className="log-resume-overflow"
                  onClick={resumeFollow}
                  title="Resume log following"
                >
                  Resume
                </button>
              )}
              {lineCount === 0 ? (
                <pre style={{ margin: 0, opacity: 0.7, padding: "0 0.5rem" }}>
                  {pod?.phase === "Pending"
                    ? "Pod is Pending. Will connect and stream once it starts…"
                    : "No log output yet…"}
                </pre>
              ) : (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <LazyLog
                    key={logKey}
                    ref={logRef as React.RefObject<LazyLog>}
                    text={initialLogText}
                    follow={follow}
                    onScroll={handleScroll}
                    enableSearch
                    enableLineNumbers
                    enableGutters
                    selectableLines
                    external
                    extraLines={1}
                    height="auto"
                    width="auto"
                    style={{
                      background: "transparent",
                      color: "var(--ca-log-text)",
                      height: "100%",
                      width: "100%",
                    }}
                    containerStyle={{
                      background: "transparent",
                      color: "var(--ca-log-text)",
                      height: "100%",
                      width: "100%",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      {tab === "info" && (
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
                gridTemplateColumns: "max-content 1fr",
                gap: "0.5rem 1rem",
                margin: 0,
              }}
            >
              <dt className="eyebrow">Name</dt>
              <dd style={{ margin: 0 }}>{pod.name}</dd>
              <dt className="eyebrow">Namespace</dt>
              <dd style={{ margin: 0 }}>{pod.namespace}</dd>
              {settings?.clusterUrl && (
                <>
                  <dt className="eyebrow">OpenShift</dt>
                  <dd style={{ margin: 0 }}>
                    {(() => {
                      const href = getConsolePodUrl(
                        settings.clusterUrl,
                        pod.namespace,
                        pod.name
                      );
                      return href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in OpenShift Console"
                        >
                          Open in OpenShift Console ↗
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
      )}
      {tab === "prompts" && (
        <section className="tab-panel" style={{ display: "grid", gap: "1rem" }}>
          <div>
            <p className="eyebrow" style={{ margin: "0 0 0.5rem 0" }}>
              PROMPT
            </p>
            <div
              style={{
                background: "var(--ca-log-bg)",
                color: "var(--ca-log-text)",
                borderRadius: "0.75rem",
                padding: "1rem",
                height: "150px",
                overflow: "auto",
                position: "relative",
                fontFamily:
                  '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
                whiteSpace: "pre-wrap",
              }}
            >
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {pod?.prompt ?? "—"}
              </pre>
            </div>
          </div>

          <div>
            <p className="eyebrow" style={{ margin: "0 0 0.5rem 0" }}>
              AGENT_RULES
            </p>
            <div
              style={{
                background: "var(--ca-log-bg)",
                color: "var(--ca-log-text)",
                borderRadius: "0.75rem",
                padding: "1rem",
                height: "350px",
                overflow: "auto",
                position: "relative",
                fontFamily:
                  '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
                whiteSpace: "pre-wrap",
              }}
            >
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {pod?.agentRules ?? "—"}
              </pre>
            </div>
          </div>
        </section>
      )}
      {!trello && (
        <p className="eyebrow">Waiting for Trello iframe bootstrap…</p>
      )}
    </main>
  );
};

export default LogStreamModal;
