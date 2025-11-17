import type { FC } from "react";
import type { AgentPod } from "../../types/pods";

type Props = {
  pod: AgentPod | null | undefined;
};

export const PromptsPanel: FC<Props> = ({ pod }) => {
  return (
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
            fontFamily: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
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
            fontFamily: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
            whiteSpace: "pre-wrap",
          }}
        >
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {pod?.agentRules ?? "—"}
          </pre>
        </div>
      </div>
    </section>
  );
};
