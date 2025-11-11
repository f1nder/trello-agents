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
