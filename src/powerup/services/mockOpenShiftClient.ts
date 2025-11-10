import type { AgentPod } from '../types/pods';
import type {
  OpenShiftPodApi,
  ListPodsParams,
  PodWatchHandler,
  PodWatchEvent,
  StopPodOptions,
  StreamLogsOptions,
  WatchPodsOptions,
} from './openshiftClient';

const textEncoder = new TextEncoder();

const clonePod = (pod: AgentPod): AgentPod => ({
  ...pod,
  containers: [...pod.containers],
  owner: pod.owner ? { ...pod.owner } : undefined,
});

const createBasePods = (cardId: string, namespace: string): AgentPod[] => {
  const now = Date.now();
  return [
    {
      id: 'preview-running-1',
      name: 'card-agent-running-1',
      phase: 'Running',
      cardId,
      namespace,
      startedAt: new Date(now - 1000 * 60 * 5).toISOString(),
      containers: ['agent'],
      lastEvent: 'Probe success',
      nodeName: 'automation-node-a',
      restarts: 0,
    },
    {
      id: 'preview-running-2',
      name: 'card-agent-running-2',
      phase: 'Running',
      cardId,
      namespace,
      startedAt: new Date(now - 1000 * 60 * 8).toISOString(),
      containers: ['agent'],
      lastEvent: 'Streaming logs',
      nodeName: 'automation-node-b',
      restarts: 1,
    },
    {
      id: 'preview-pending-1',
      name: 'card-agent-pending-1',
      phase: 'Pending',
      cardId,
      namespace,
      startedAt: new Date(now - 1000 * 60 * 2).toISOString(),
      containers: ['agent'],
      lastEvent: 'Pulling image',
      nodeName: 'automation-node-c',
      restarts: 0,
    },
    {
      id: 'preview-succeeded-1',
      name: 'card-agent-completed-1',
      phase: 'Succeeded',
      cardId,
      namespace,
      startedAt: new Date(now - 1000 * 60 * 15).toISOString(),
      containers: ['agent'],
      lastEvent: 'Completed successfully',
      nodeName: 'automation-node-d',
      restarts: 0,
    },
    {
      id: 'preview-succeeded-2',
      name: 'card-agent-completed-2',
      phase: 'Succeeded',
      cardId,
      namespace,
      startedAt: new Date(now - 1000 * 60 * 20).toISOString(),
      containers: ['agent'],
      lastEvent: 'Job finished',
      nodeName: 'automation-node-e',
      restarts: 1,
    },
    {
      id: 'preview-failed-1',
      name: 'card-agent-failed-1',
      phase: 'Failed',
      cardId,
      namespace,
      startedAt: new Date(now - 1000 * 60 * 12).toISOString(),
      containers: ['agent'],
      lastEvent: 'Error: exit code 1',
      nodeName: 'automation-node-f',
      restarts: 2,
    },
    {
      id: 'preview-failed-2',
      name: 'card-agent-failed-2',
      phase: 'Failed',
      cardId,
      namespace,
      startedAt: new Date(now - 1000 * 60 * 18).toISOString(),
      containers: ['agent'],
      lastEvent: 'CrashLoopBackOff',
      nodeName: 'automation-node-g',
      restarts: 0,
    },
  ];
};

interface WatchRegistration {
  handler: PodWatchHandler;
  cardId?: string;
}

export class MockOpenShiftClient implements OpenShiftPodApi {
  private pods: AgentPod[];
  private watchers = new Set<WatchRegistration>();
  private jitterTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly cardId = 'PREVIEW', private readonly namespace = 'automation') {
    this.pods = createBasePods(cardId, namespace);
  }

  async listPods(params: ListPodsParams = {}): Promise<AgentPod[]> {
    const targetCard = params.cardId ?? this.cardId;
    return this.pods
      .filter((pod) => !targetCard || pod.cardId === targetCard)
      .map(clonePod);
  }

  watchPods(handler: PodWatchHandler, options: WatchPodsOptions = {}): () => void {
    const registration: WatchRegistration = { handler, cardId: options.cardId ?? this.cardId };
    this.watchers.add(registration);
    this.emitSnapshot(registration);
    this.startTicker();

    return () => {
      this.watchers.delete(registration);
      this.stopTicker();
    };
  }

  async stopPod(podName: string, options: StopPodOptions = {}): Promise<void> {
    void options;
    const index = this.pods.findIndex((pod) => pod.name === podName);
    if (index === -1) {
      return;
    }
    const [removed] = this.pods.splice(index, 1);
    this.emit({ type: 'DELETED', pod: clonePod(removed) });
  }

  async streamLogs(podName: string, options: StreamLogsOptions = {}): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    void options;
    let count = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        interval = setInterval(() => {
          count += 1;
          const line = `[${new Date().toISOString()}] ${podName}: preview log line #${count}\n`;
          controller.enqueue(textEncoder.encode(line));
          if (count >= 40) {
            if (interval) {
              clearInterval(interval);
              interval = null;
            }
            controller.close();
          }
        }, 250);
      },
      cancel: () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      },
    });
    return stream.getReader();
  }

  private startTicker() {
    if (this.jitterTimer || this.watchers.size === 0) {
      return;
    }
    this.jitterTimer = setInterval(() => this.jitter(), 4000);
  }

  private stopTicker() {
    if (this.watchers.size === 0 && this.jitterTimer) {
      clearInterval(this.jitterTimer);
      this.jitterTimer = null;
    }
  }

  private jitter() {
    if (this.pods.length === 0) {
      return;
    }

    const index = Math.floor(Math.random() * this.pods.length);
    const pod = { ...this.pods[index] };
    const phases: AgentPod['phase'][] = ['Running', 'Pending', 'Succeeded', 'Failed'];
    pod.phase = phases[Math.floor(Math.random() * phases.length)];
    pod.lastEvent = `Heartbeat ${new Date().toLocaleTimeString()}`;
    this.pods[index] = pod;
    this.emit({ type: 'MODIFIED', pod: clonePod(pod) });
  }

  private emit(event: PodWatchEvent) {
    this.watchers.forEach((watcher) => {
      if (watcher.cardId && event.pod.cardId !== watcher.cardId) {
        return;
      }
      watcher.handler(event);
    });
  }

  private emitSnapshot(registration: WatchRegistration) {
    this.pods
      .filter((pod) => !registration.cardId || pod.cardId === registration.cardId)
      .forEach((pod) => registration.handler({ type: 'ADDED', pod: clonePod(pod) }));
  }
}
