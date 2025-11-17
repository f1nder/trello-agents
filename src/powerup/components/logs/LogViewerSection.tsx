import type { CSSProperties, FC, RefObject } from "react";
import { LazyLog } from "@melloware/react-logviewer";
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
}) => {
  return (
    <section className="tab-panel" style={{ padding: 0 }}>
      <div
        style={{
          height: "560px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={
            {
              color: "var(--ca-log-text)",
              borderRadius: "0.75rem",
              padding: "0.5rem 0.75rem 0.75rem",
              fontFamily:
                '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
              position: "relative",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              "--ca-log-bg": "#1233dd",
            } as CSSProperties
          }
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
                style={{ backgroundColor: "lightgray" }}
                containerStyle={{
                  backgroundColor: "lightgray",
                  padding: "0.5rem 0.75rem 0.75rem",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
