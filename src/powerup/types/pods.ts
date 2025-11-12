export type PodPhase = 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown' | 'Terminating';

export interface PodOwnerReference {
  kind: string;
  name: string;
  uid?: string;
}

export interface AgentPod {
  id: string;
  name: string;
  /**
   * Human-friendly name for display. When available, this prefers
   * Kubernetes metadata.annotations.jobName; otherwise falls back to `name`.
   */
  displayName?: string;
  /** Raw Kubernetes job name from metadata.annotations.jobName */
  jobName?: string;
  /** Optional agent kind from pod env var AGENT */
  agent?: string;
  /** Optional model name from pod env var MODEL */
  model?: string;
  /** Optional prompt text from pod env var PROMPT */
  prompt?: string;
  /** Optional agent rules text from pod env var AGENT_RULES */
  agentRules?: string;
  phase: PodPhase;
  cardId: string;
  namespace: string;
  startedAt: string;
  /** When available, the container's actual start timestamp used for runtime. */
  runtimeStart?: string;
  /** When available for terminated containers, the container's finished timestamp. */
  runtimeEnd?: string | null;
  containers: string[];
  lastEvent?: string;
  nodeName?: string;
  restarts?: number;
  owner?: PodOwnerReference;
}

export interface PodGroup {
  phase: PodPhase;
  pods: AgentPod[];
}
