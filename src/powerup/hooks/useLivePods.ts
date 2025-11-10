import { useEffect, useMemo, useReducer, useState } from 'react';
import type { AgentPod, PodGroup } from '../types/pods';
import type { OpenShiftPodApi } from '../services/openshiftClient';

const groupPods = (pods: AgentPod[]): PodGroup[] => {
  const phaseMap = new Map<PodGroup['phase'], AgentPod[]>();
  pods.forEach((pod) => {
    const group = phaseMap.get(pod.phase) ?? [];
    group.push(pod);
    phaseMap.set(pod.phase, group);
  });
  return Array.from(phaseMap.entries()).map(([phase, group]) => ({
    phase,
    pods: group.sort((a, b) => a.name.localeCompare(b.name)),
  }));
};

type PodAction =
  | { type: 'reset'; pods: AgentPod[] }
  | { type: 'upsert'; pod: AgentPod }
  | { type: 'remove'; podId: string };

const podReducer = (state: AgentPod[], action: PodAction): AgentPod[] => {
  switch (action.type) {
    case 'reset':
      return action.pods;
    case 'upsert': {
      const next = state.filter((pod) => pod.id !== action.pod.id);
      next.push(action.pod);
      return next;
    }
    case 'remove':
      return state.filter((pod) => pod.id !== action.podId);
    default:
      return state;
  }
};

export interface UseLivePodsOptions {
  client: OpenShiftPodApi | null;
  cardId?: string | null;
  namespace?: string;
}

export interface UseLivePodsResult {
  pods: AgentPod[];
  groups: PodGroup[];
  status: 'idle' | 'loading' | 'connecting' | 'streaming' | 'error';
  error: Error | null;
  reconnectAttempts: number;
  lastEventAt: number | null;
  mutate: {
    upsert: (pod: AgentPod) => void;
    remove: (podId: string) => void;
    reset: (next: AgentPod[]) => void;
  };
}

export const useLivePods = ({ client, cardId, namespace }: UseLivePodsOptions): UseLivePodsResult => {
  const [pods, dispatch] = useReducer(podReducer, []);
  const [status, setStatus] = useState<UseLivePodsResult['status']>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  useEffect(() => {
    if (!client || !cardId) {
      dispatch({ type: 'reset', pods: [] });
      setStatus('idle');
      setError(null);
      return;
    }

    let disposed = false;
    setStatus('loading');
    setError(null);
    setReconnectAttempts(0);

    client
      .listPods({ cardId, namespace })
      .then((initial) => {
        if (disposed) {
          return;
        }
        dispatch({ type: 'reset', pods: initial });
      })
      .catch((listError) => {
        if (disposed) {
          return;
        }
        setError(listError as Error);
        setStatus('error');
      });

    const stopWatch = client.watchPods(
      (event) => {
        if (disposed) {
          return;
        }
        setStatus('streaming');
        setLastEventAt(Date.now());
        if (event.type === 'DELETED') {
          dispatch({ type: 'remove', podId: event.pod.id });
        } else {
          dispatch({ type: 'upsert', pod: event.pod });
        }
      },
      {
        cardId,
        namespace,
        onConnectionStateChange: (state) => {
          if (disposed) {
            return;
          }
          setStatus(state);
        },
        onReconnect: (attempt) => {
          if (disposed) {
            return;
          }
          setReconnectAttempts(attempt);
        },
        onError: (watchError) => {
          if (disposed) {
            return;
          }
          setError(watchError);
          setStatus('error');
        },
      },
    );

    return () => {
      disposed = true;
      stopWatch();
    };
  }, [cardId, client, namespace]);

  const groups = useMemo(() => groupPods(pods), [pods]);
  const mutate = useMemo(
    () => ({
      upsert: (pod: AgentPod) => dispatch({ type: 'upsert', pod }),
      remove: (podId: string) => dispatch({ type: 'remove', podId }),
      reset: (next: AgentPod[]) => dispatch({ type: 'reset', pods: next }),
    }),
    [],
  );

  return { pods, groups, status, error, reconnectAttempts, lastEventAt, mutate };
};
