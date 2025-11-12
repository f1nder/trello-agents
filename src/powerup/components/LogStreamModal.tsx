import { useEffect, useMemo, useRef, useState } from "react";
import { usePowerUpClient } from "../hooks/usePowerUpClient";
import { useClusterSettings } from "../hooks/useClusterSettings";
import { OpenShiftClient } from "../services/openshiftClient";
import type { AgentPod } from "../types/pods";
import { confirmPodDeletion } from "../utils/confirmPodDeletion";
import type { OpenShiftPodApi } from "../services/openshiftClient";
import { getPreviewConfig } from "../utils/preview";
import { useAppliedTrelloTheme } from "../hooks/useAppliedTrelloTheme";
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
];

const textDecoder = new TextDecoder();

const LogStreamModal = () => {
  const trello = usePowerUpClient();
  const theme = useAppliedTrelloTheme(trello);
  const {
    settings,
    token,
    status: settingsStatus,
  } = useClusterSettings(trello);
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "streaming" | "error"
  >("idle");
  const [error, setError] = useState<Error | null>(null);
  const [tab, setTab] = useState<"logs" | "info">("logs");
  const [follow, setFollow] = useState(true);
  const logsRef = useRef<HTMLDivElement | null>(null);
  const isAutoScrollingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const previewConfig = getPreviewConfig();
  const displayableError = getDisplayableError(error);

  const pod = trello?.arg<AgentPod>("pod");
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
    setLines([]);
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
        });
        setStatus("streaming");
        let buffered = "";
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done || !value) {
            break;
          }
          buffered += textDecoder.decode(value, { stream: true });
          const segments = buffered.split("\n");
          buffered = segments.pop() ?? "";
          const nextLines = segments.filter(Boolean);
          if (nextLines.length > 0) {
            setLines((prev) => [...prev, ...nextLines]);
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

  // Auto-scroll to bottom when following and new lines arrive (or when returning to Logs tab)
  useEffect(() => {
    if (tab !== "logs" || !follow) return;
    const el = logsRef.current;
    if (!el) return;
    isAutoScrollingRef.current = true;
    requestAnimationFrame(() => {
      try {
        el.scrollTo({ top: el.scrollHeight });
      } finally {
        setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, 0);
      }
    });
  }, [lines, tab, follow]);

  const stripTimestamp = (line: string) =>
    line.replace(
      /^[\t\s]*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\s*/,
      ""
    );

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

  // Helper to detect whether the logs panel is scrolled to the bottom
  const isAtBottom = (el: HTMLDivElement) => {
    const threshold = 4; // px tolerance for float rounding
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  };

  return (
    <main className="inner-page" style={{ gap: "1rem" }} data-theme={theme}>
      <header>
        <p className="eyebrow">Pod</p>
        <h1>{pod ? pod.name : "Pod"}</h1>
        <p className="lede" style={{ marginBottom: 0 }}>
          {pod
            ? `Namespace ${pod.namespace} · container ${
                pod.containers[0] ?? "default"
              }`
            : "Waiting for pod context from Trello…"}
        </p>
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
            className="eyebrow"
            style={{
              margin: 0,
              display: "flex",
              justifyContent: "flex-end",
            }}
            title={`Log stream status: ${status}`}
          >
            <ConnectionStatusIndicator
              status={status}
              label={`Log stream status: ${status}`}
            />
          </div>
          <div
            className="log-toolbar"
            role="toolbar"
            aria-label="Log controls"
          >
            <div className="segmented" role="tablist" aria-label="Log views">
              {TAB_OPTIONS.map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`segmented__button ${tab === id ? "is-active" : ""}`}
                  onClick={() => setTab(id)}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>
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
            {displayableError.message}. Verify the token permits log streaming for this
            namespace.
          </p>
        )}
      </header>
      {tab === "logs" && (
        <section
          ref={logsRef}
          onScroll={(e) => {
            const el = logsRef.current;
            // Only treat user-initiated scrolling as an intent to stop following
            const isUser = (e as unknown as { nativeEvent?: { isTrusted?: boolean } })
              ?.nativeEvent?.isTrusted === true;
            if (!el) return;

            if (!isUser) return; // ignore programmatic scrolls

            // If the user scrolls away from the bottom, disable follow
            if (follow && !isAtBottom(el)) {
              setFollow(false);
            }
          }}
          style={{
            background: "var(--ca-log-bg)",
            color: "var(--ca-log-text)",
            borderRadius: "0.75rem",
            padding: "1rem",
            height: "420px",
            overflow: "auto",
            position: "relative",
            fontFamily: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
          }}
        >
          <div className="log-follow-container">
            <button
              type="button"
              className={`log-follow ${follow ? "is-active" : ""}`}
              aria-pressed={follow}
              onClick={() => {
                setFollow((f) => !f);
                if (!follow) {
                  const el = logsRef.current;
                  if (el) el.scrollTo({ top: el.scrollHeight });
                }
              }}
              title={
                follow
                  ? "Following logs (click to pause)"
                  : "Click to follow tail"
              }
            >
              {follow ? "Following" : "Follow"}
            </button>
          </div>
          {lines.length === 0 ? (
            <pre style={{ margin: 0, opacity: 0.7 }}>
              {pod?.phase === "Pending"
                ? "Pod is Pending. Will connect and stream once it starts…"
                : "No log output yet…"}
            </pre>
          ) : null}
          {lines.map((line, index) => (
            <pre key={`${line}-${index}`} style={{ margin: 0 }}>
              {stripTimestamp(line)}
            </pre>
          ))}
        </section>
      )}
      {tab === "info" && (
        <section
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
      {!trello && (
        <p className="eyebrow">Waiting for Trello iframe bootstrap…</p>
      )}
    </main>
  );
};

export default LogStreamModal;
