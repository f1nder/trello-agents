export type PodPhase = 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';

export interface AgentPod {
  id: string;
  name: string;
  phase: PodPhase;
  cardId: string;
  namespace: string;
  startedAt: string;
  containers: string[];
  lastEvent?: string;
}

export interface PodGroup {
  phase: PodPhase;
  pods: AgentPod[];
}
