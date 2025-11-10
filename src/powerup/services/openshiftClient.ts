import type { AgentPod } from '../types/pods';

export interface OpenShiftClientConfig {
  baseUrl: string;
  namespace: string;
  token?: string;
  caBundle?: string;
  ignoreSsl?: boolean;
}

export interface PodWatchEvent {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  pod: AgentPod;
}

export type PodWatchHandler = (event: PodWatchEvent) => void;

/**
 * Placeholder OpenShift client. Future iterations will replace these stubs with
 * real fetch/stream logic targeting OpenShift 3.11 watch + log APIs.
 */
export class OpenShiftClient {
  constructor(private readonly config: OpenShiftClientConfig) {}

  async listPods(): Promise<AgentPod[]> {
    console.info('[openshift] listPods() stub invoked', this.config);
    return [];
  }

  watchPods(handler: PodWatchHandler): () => void {
    console.info('[openshift] watchPods() stub invoked', this.config);
    let closed = false;

    queueMicrotask(() => {
      if (closed) {
        return;
      }
      handler({
        type: 'ADDED',
        pod: {
          id: 'stub-pod',
          name: 'card-agent-stub',
          phase: 'Running',
          cardId: 'STUB',
          namespace: this.config.namespace,
          startedAt: new Date().toISOString(),
          containers: ['agent'],
          lastEvent: 'bootstrap',
        },
      });
    });

    return () => {
      closed = true;
    };
  }

  async stopPod(podName: string): Promise<void> {
    console.info(`[openshift] stopPod(${podName}) stub invoked`);
  }

  streamLogs(podName: string, container?: string): ReadableStreamDefaultReader<string> {
    console.info(`[openshift] streamLogs(${podName}, ${container ?? 'default'}) stub invoked`);
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(`[stub log] Connected to ${podName}`);
        controller.close();
      },
    });
    return stream.getReader();
  }
}
