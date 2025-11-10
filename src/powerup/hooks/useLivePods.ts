import { useEffect, useMemo, useState } from 'react';
import type { AgentPod, PodGroup } from '../types/pods';
import { OpenShiftClient } from '../services/openshiftClient';
import type { ClusterSettings } from '../types/settings';

const MOCK_PODS: AgentPod[] = [
  {
    id: 'mock-running-1',
    name: 'card-agent-running-1',
    phase: 'Running',
    cardId: 'ESmbX5Vy',
    namespace: 'automation',
    startedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    containers: ['agent'],
    lastEvent: 'Probe success',
  },
  {
    id: 'mock-pending-1',
    name: 'card-agent-pending-1',
    phase: 'Pending',
    cardId: 'ESmbX5Vy',
    namespace: 'automation',
    startedAt: new Date().toISOString(),
    containers: ['agent'],
    lastEvent: 'Pulling image',
  },
];

const groupPods = (pods: AgentPod[]): PodGroup[] => {
  const map = new Map<string, AgentPod[]>();
  pods.forEach((pod) => {
    const bucket = map.get(pod.phase) ?? [];
    bucket.push(pod);
    map.set(pod.phase, bucket);
  });
  return Array.from(map.entries()).map(([phase, bucket]) => ({ phase: phase as PodGroup['phase'], pods: bucket }));
};

export interface UseLivePodsOptions {
  settings?: ClusterSettings;
}

export const useLivePods = () => {
  const [pods, setPods] = useState<AgentPod[]>(MOCK_PODS);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'streaming'>('idle');

  useEffect(() => {
    setStatus('connecting');
    const client = new OpenShiftClient({ baseUrl: 'https://openshift.local', namespace: 'automation' });
    const stop = client.watchPods((event) => {
      setStatus('streaming');
      setPods((prev) => {
        const next = prev.filter((pod) => pod.id !== event.pod.id);
        if (event.type !== 'DELETED') {
          next.push(event.pod);
        }
        return next;
      });
    });

    return () => {
      stop();
    };
  }, []);

  const groups = useMemo(() => groupPods(pods), [pods]);

  return { pods, groups, status };
};
