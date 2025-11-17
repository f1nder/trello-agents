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
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
