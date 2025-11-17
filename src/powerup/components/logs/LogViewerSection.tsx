import type { CSSProperties, FC, RefObject } from "react";
import { LazyLog, Line } from "@melloware/react-logviewer";
import type { AgentPod } from "../../types/pods";

type ScrollArgs = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

type Props = {
  pod: AgentPod | null | undefined;
  follow: boolean;
  resumeFollow: () => void;
  disableFollow: () => void;
  status: "idle" | "connecting" | "streaming" | "error";
  lineCount: number;
  handleScroll: (args: ScrollArgs) => void;
  logRef: RefObject<LazyLog>;
  logKey: string;
  visible?: boolean;
};

const INITIAL_TEXT = "";

export const LogViewerSection: FC<Props> = ({
  pod,
  follow,
  resumeFollow,
  disableFollow,
  status,
  lineCount,
  handleScroll,
  logRef,
  logKey,
  visible = true,
}) => {
  return (
    <section
      className="tab-panel"
      hidden={!visible}
      aria-hidden={!visible}
      style={{
        padding: 0,
        display: visible ? undefined : "none",
      }}
    >
      <div
        style={{
          height: "560px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            height: "100%",
            display: "flex",
          }}
        >
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <button
              type="button"
              className="log-follow-toggle"
              onClick={follow ? disableFollow : resumeFollow}
              title={follow ? "Disable log following" : "Resume log following"}
            >
              {follow ? "Following" : "Start following"}
            </button>
            {lineCount === 0 ? (
              <pre
                style={{
                  margin: 0,
                  opacity: 0.7,
                  padding: "0 0.5rem",
                  height: "100%",
                  backgroundColor: "#000000",
                  color: "var(--ca-text-primary, #f4f5f7)",
                }}
              >
                {status === "connecting" || status === "streaming"
                  ? "Loading logs…"
                  : pod?.phase === "Pending"
                    ? "Pod is Pending. Will connect and stream once it starts…"
                    : "No log output yet…"}
              </pre>
            ) : (
              <LazyLog
                key={logKey}
                ref={logRef}
                text={INITIAL_TEXT}
                follow={follow}
                onScroll={handleScroll}
                enableSearch
                enableLineNumbers={false}
                enableGutters
                selectableLines
                external
                extraLines={1}
                style={{ backgroundColor: "#000000" }}
                containerStyle={{
                  backgroundColor: "#000000",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
