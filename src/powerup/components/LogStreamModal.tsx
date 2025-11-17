import { useMemo, useState } from "react";
import { usePowerUpClient } from "../hooks/usePowerUpClient";
import { useClusterSettings } from "../hooks/useClusterSettings";
import { OpenShiftClient } from "../services/openshiftClient";
import type { OpenShiftPodApi } from "../services/openshiftClient";
import type { AgentPod } from "../types/pods";
import { confirmPodDeletion } from "../utils/confirmPodDeletion";
import { getPreviewConfig } from "../utils/preview";
import { useAppliedTrelloTheme } from "../hooks/useAppliedTrelloTheme";
import "../../styles/index.css";
import "../../pages/InnerPage.css";
import { getDisplayableError } from "../utils/errors";
import {
  StatusIndicator,
  LogConnectionIndicator,
} from "./logs/StatusIndicators";
import { usePodLogStream } from "../hooks/usePodLogStream";
import { LogViewerSection } from "./logs/LogViewerSection";
import { PodInfoPanel } from "./logs/PodInfoPanel";
import { PromptsPanel } from "./logs/PromptsPanel";

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

type TabId = (typeof TAB_OPTIONS)[number]["id"];

const LogStreamModal = () => {
  const trello = usePowerUpClient();
  const theme = useAppliedTrelloTheme(trello);
  const {
    settings,
    token,
    status: settingsStatus,
  } = useClusterSettings(trello);
  const [tab, setTab] = useState<TabId>("logs");
  const [isStopping, setIsStopping] = useState(false);
  const pod = trello?.arg<AgentPod>("pod");
  const previewConfig = getPreviewConfig();

  const openShiftClient: OpenShiftPodApi | null = useMemo(() => {
    if (previewConfig?.openShiftClient) {
      return previewConfig.openShiftClient;
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
  }, [previewConfig, settings, token]);

  const {
    status: logStatus,
    error,
    lineCount,
    follow,
    handleScroll,
    resumeFollow,
    disableFollow,
    logRef,
    logKey,
    abortStreaming,
  } = usePodLogStream({ pod, openShiftClient });

  const displayableError = getDisplayableError(error);

  const stopPod = async () => {
    if (!pod || !openShiftClient || isStopping) return;
    const confirmed = await confirmPodDeletion(pod, trello);
    if (!confirmed) {
      return;
    }
    try {
      setIsStopping(true);
      abortStreaming();
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
                  {id === "logs" && (
                    <LogConnectionIndicator status={logStatus} />
                  )}
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
              disabled={
                isStopping ||
                !openShiftClient ||
                !pod ||
                (pod.phase !== "Pending" && pod.phase !== "Running")
              }
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

      <LogViewerSection
        pod={pod}
        follow={follow}
        resumeFollow={resumeFollow}
        disableFollow={disableFollow}
        lineCount={lineCount}
        handleScroll={handleScroll}
        logRef={logRef}
        logKey={logKey}
        visible={tab === "logs"}
      />

      {tab === "info" && <PodInfoPanel pod={pod} settings={settings} />}

      {tab === "prompts" && <PromptsPanel pod={pod} />}

      {!trello && (
        <p className="eyebrow">Waiting for Trello iframe bootstrap…</p>
      )}
    </main>
  );
};

export default LogStreamModal;
