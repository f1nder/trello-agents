import type { AgentPod, PodOwnerReference, PodPhase } from "../types/pods";
import logger from "../utils/logger";

export interface OpenShiftClientConfig {
  baseUrl: string;
  namespace: string;
  token?: string | null;
  caBundle?: string;
  ignoreSsl?: boolean;
}

export interface ListPodsParams {
  cardId?: string;
  namespace?: string;
  labelSelector?: string;
  fieldSelector?: string;
}

export interface PodWatchEvent {
  type: "ADDED" | "MODIFIED" | "DELETED";
  pod: AgentPod;
}

export type PodWatchHandler = (event: PodWatchEvent) => void;

export interface WatchPodsOptions extends ListPodsParams {
  signal?: AbortSignal;
  /**
   * Hook invoked whenever the underlying stream transitions to a new connection state.
   */
  onConnectionStateChange?: (state: "connecting" | "streaming") => void;
  /**
   * Hook invoked just before each retry attempt (1-indexed).
   */
  onReconnect?: (attempt: number) => void;
  onError?: (error: Error) => void;
  /**
   * Base delay used for exponential backoff between retries (ms).
   * Defaults to 750 ms.
   */
  backoffMs?: number;
}

export interface StopPodOptions {
  namespace?: string;
  owner?: PodOwnerReference | null;
}

export interface StreamLogsOptions {
  namespace?: string;
  container?: string;
  signal?: AbortSignal;
  /**
   * Number of lines to include from the end of the log prior to streaming.
   * Mirrors Kubernetes `tailLines` query param.
   */
  tailLines?: number;
  /**
   * Limit the duration of logs to recent seconds. Mirrors Kubernetes `sinceSeconds`.
   */
  sinceSeconds?: number;
  /**
   * Maximum bytes to return. Mirrors Kubernetes `limitBytes`.
   */
  limitBytes?: number;
}

export interface OpenShiftPodApi {
  listPods(params?: ListPodsParams): Promise<AgentPod[]>;
  watchPods(handler: PodWatchHandler, options?: WatchPodsOptions): () => void;
  stopPod(podName: string, options?: StopPodOptions): Promise<void>;
  streamLogs(
    podName: string,
    options?: StreamLogsOptions
  ): Promise<ReadableStreamDefaultReader<Uint8Array>>;
}

const textDecoder = new TextDecoder();

const waitFor = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const coercePhase = (phase?: string): PodPhase => {
  if (!phase) {
    return "Unknown";
  }
  if (
    phase === "Succeeded" ||
    phase === "Failed" ||
    phase === "Running" ||
    phase === "Pending" ||
    phase === "Unknown"
  ) {
    return phase;
  }
  if (phase === "Terminating") {
    return "Terminating";
  }
  return "Unknown";
};

const mapPodResource = (resource: KubernetesPod): AgentPod => {
  const containers =
    resource.spec?.containers?.map((container) => container.name) ?? [];
  const ownerRef = resource.metadata.ownerReferences?.[0];
  const readyCondition = resource.status?.conditions?.find(
    (condition) => condition.type === "Ready"
  );
  const lastEvent =
    readyCondition?.message ?? resource.status?.message ?? ownerRef?.kind;
  const fallbackId =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const statusList = resource.status?.containerStatuses ?? [];
  const primaryName = containers[0];
  const selected =
    statusList.find((s) => s.name === primaryName) ?? statusList[0];
  const state = selected?.state ?? selected?.lastState;
  const runningStarted = state?.running?.startedAt;
  const terminatedStarted = state?.terminated?.startedAt;
  const terminatedFinished = state?.terminated?.finishedAt;
  const runtimeStart = runningStarted ?? terminatedStarted ?? resource.status?.startTime;
  const runtimeEnd = terminatedFinished ?? null;
  // Prefer jobName from annotations for display when available
  const jobName = resource.metadata.annotations?.jobName;
  const displayName = jobName && jobName.length > 0
    ? jobName
    : (resource.metadata.name ?? "unknown");
  // Extract AGENT and MODEL from POD's first/primary container env vars
  const containerSpecs = resource.spec?.containers ?? [];
  const primarySpec = containerSpecs.find((c) => c.name === primaryName) ?? containerSpecs[0];
  const env = primarySpec?.env ?? [];
  const agentEnv = env.find((e) => (e.name ?? "").toUpperCase() === "AGENT")?.value;
  const modelEnv = env.find((e) => (e.name ?? "").toUpperCase() === "MODEL")?.value;
  const promptEnv = env.find((e) => (e.name ?? "").toUpperCase() === "PROMPT")?.value;
  const agentRulesEnv = env.find((e) => (e.name ?? "").toUpperCase() === "AGENT_RULES")?.value;
  return {
    id: resource.metadata.uid ?? resource.metadata.name ?? fallbackId,
    name: resource.metadata.name ?? "unknown",
    displayName,
    jobName: jobName ?? undefined,
    agent: agentEnv ?? undefined,
    model: modelEnv ?? undefined,
    prompt: promptEnv ?? undefined,
    agentRules: agentRulesEnv ?? undefined,
    phase: coercePhase(resource.status?.phase),
    cardId: resource.metadata.labels?.trelloCardId ?? "",
    namespace: resource.metadata.namespace ?? "",
    startedAt: resource.status?.startTime ?? new Date().toISOString(),
    runtimeStart: runtimeStart ?? undefined,
    runtimeEnd,
    containers,
    lastEvent,
    nodeName: resource.spec?.nodeName,
    restarts: resource.status?.containerStatuses?.reduce(
      (sum, status) => sum + (status.restartCount ?? 0),
      0
    ),
    owner: ownerRef
      ? {
          kind: ownerRef.kind ?? "Unknown",
          name: ownerRef.name ?? "unknown",
          uid: ownerRef.uid ?? undefined,
        }
      : undefined,
  };
};

const buildLabelSelector = (cardId?: string, extraSelector?: string) => {
  const selectors: string[] = [];
  if (cardId) {
    selectors.push(`trelloCardId=${cardId}`);
  }
  if (extraSelector) {
    selectors.push(extraSelector);
  }
  return selectors.join(",");
};

const normalizeBaseUrl = (value: string) => {
  if (!value.endsWith("/")) {
    return `${value}/`;
  }
  return value;
};

export class OpenShiftRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: string
  ) {
    super(message);
    this.name = "OpenShiftRequestError";
  }
}

/**
 * Minimal fetch-based OpenShift API client targeting the subset of
 * endpoints required by the Card Agents roster.
 */
export class OpenShiftClient implements OpenShiftPodApi {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(
    private readonly config: OpenShiftClientConfig,
    deps?: { fetchImpl?: typeof fetch }
  ) {
    this.fetchImpl =
      deps?.fetchImpl ?? (globalThis.fetch?.bind(globalThis) as typeof fetch);
    if (!this.fetchImpl) {
      throw new Error("OpenShiftClient requires global fetch support");
    }
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
  }

  async listPods(params: ListPodsParams = {}): Promise<AgentPod[]> {
    const url = this.buildPodUrl({ ...params, watch: false });
    logger.debug("[openshift] listPods", { url });
    const response = await this.request(url, { method: "GET" });
    const payload =
      (await response.json()) as KubernetesListResponse<KubernetesPod>;
    const result = (payload.items ?? []).map(mapPodResource);
    logger.debug("[openshift] listPods result", { count: result.length });
    return result;
  }

  watchPods(
    handler: PodWatchHandler,
    options: WatchPodsOptions = {}
  ): () => void {
    const controller = new AbortController();
    const externalSignal = options.signal;
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
    }

    let stopped = false;
    let reconnectAttempt = 0;

    const loop = async () => {
      while (!stopped && !controller.signal.aborted) {
        options.onConnectionStateChange?.("connecting");
        try {
          await this.consumeWatchStream(handler, controller.signal, options);
          reconnectAttempt = 0;
        } catch (error) {
          if (controller.signal.aborted || stopped) {
            if (
              !(error instanceof DOMException && error.name === "AbortError")
            ) {
              options.onError?.(error as Error);
            }
            return;
          }
          reconnectAttempt += 1;
          options.onError?.(error as Error);
          options.onReconnect?.(reconnectAttempt);
          const backoff = Math.min(
            30000,
            (options.backoffMs ?? 750) * 2 ** (reconnectAttempt - 1)
          );
          try {
            await waitFor(backoff, controller.signal);
          } catch (abortError) {
            if (
              !(
                abortError instanceof DOMException &&
                abortError.name === "AbortError"
              )
            ) {
              options.onError?.(abortError as Error);
            }
            return;
          }
        }
      }
    };

    loop().catch((error) => options.onError?.(error as Error));

    return () => {
      stopped = true;
      controller.abort();
    };
  }

  async stopPod(podName: string, options: StopPodOptions = {}): Promise<void> {
    const namespace = options.namespace ?? this.config.namespace;
    let jobName: string | undefined;
    try {
      jobName = await this.resolvePodJobName(namespace, podName, options.owner);
    } catch (error) {
      logger.warn("[openshift] Unable to resolve job for pod", {
        namespace,
        podName,
        message: (error as Error).message,
      });
    }

    if (!jobName) {
      return;
    }

    const jobPath = `/apis/batch/v1/namespaces/${namespace}/jobs/${jobName}`;
    try {
      await this.request(jobPath, { method: "DELETE" });
    } catch (error) {
      if (
        !(error instanceof OpenShiftRequestError) ||
        (error.status !== 404 && error.status !== 410)
      ) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const podPath = `/api/v1/namespaces/${namespace}/pods/${podName}`;
    try {
      await this.request(podPath, { method: "DELETE" });
    } catch (error) {
      if (!(error instanceof OpenShiftRequestError) || error.status !== 404) {
        throw error;
      }
    }
  }

  private async resolvePodJobName(
    namespace: string,
    podName: string,
    owner?: PodOwnerReference | null
  ): Promise<string | undefined> {
    if (owner?.kind === "Job" && owner.name) {
      return owner.name;
    }

    const podPath = `/api/v1/namespaces/${namespace}/pods/${podName}`;
    try {
      const response = await this.request(podPath, { method: "GET" });
      const pod = (await response.json()) as KubernetesPod;
      const jobOwner = pod.metadata.ownerReferences?.find(
        (reference) => reference.kind?.toLowerCase() === "job"
      );
      if (jobOwner?.name) {
        return jobOwner.name;
      }
      return pod.metadata.labels?.["job-name"] ?? pod.metadata.labels?.jobName;
    } catch (error) {
      if (
        error instanceof OpenShiftRequestError &&
        (error.status === 404 || error.status === 410)
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async streamLogs(
    podName: string,
    options: StreamLogsOptions = {}
  ): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    const namespace = options.namespace ?? this.config.namespace;
    const url = new URL(
      `/api/v1/namespaces/${namespace}/pods/${podName}/log`,
      this.baseUrl
    );
    url.searchParams.set("follow", "true");
    url.searchParams.set("timestamps", "true");
    if (options.tailLines != null) {
      url.searchParams.set("tailLines", String(options.tailLines));
    }
    if (options.sinceSeconds != null) {
      url.searchParams.set("sinceSeconds", String(options.sinceSeconds));
    }
    if (options.limitBytes != null) {
      url.searchParams.set("limitBytes", String(options.limitBytes));
    }
    if (options.container) {
      url.searchParams.set("container", options.container);
    }
    // Some clusters reject explicit 'text/plain' with 406 Not Acceptable.
    // Use a permissive Accept so API can choose an appropriate content type.
    const response = await this.request(url.toString(), {
      method: "GET",
      signal: options.signal,
      headers: { Accept: "*/*" },
    });
    if (!response.body) {
      throw new Error("Log streaming is unavailable in this environment");
    }
    return response.body.getReader();
  }

  private async consumeWatchStream(
    handler: PodWatchHandler,
    signal: AbortSignal,
    options: WatchPodsOptions
  ): Promise<void> {
    const url = this.buildPodUrl({ ...options, watch: true });
    logger.debug("[openshift] watchPods connect", { url });
    const response = await this.request(url, { method: "GET", signal });
    if (!response.body) {
      throw new Error("Streaming not supported by fetch implementation");
    }

    options.onConnectionStateChange?.("streaming");

    const reader = response.body.getReader();
    let buffered = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffered += textDecoder.decode(value, { stream: true });
      buffered = this.flushBuffer(buffered, handler);
    }
  }

  private flushBuffer(buffered: string, handler: PodWatchHandler): string {
    const lines = buffered.split("\n");
    const remainder = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const payload = JSON.parse(trimmed) as KubernetesWatchEvent;
        if (!payload.object) {
          continue;
        }
        handler({
          type: payload.type,
          pod: mapPodResource(payload.object),
        });
      } catch (error) {
        logger.warn("[openshift] Unable to parse watch payload", error);
      }
    }
    return remainder;
  }

  private buildPodUrl(params: ListPodsParams & { watch: boolean }): string {
    const namespace = params.namespace ?? this.config.namespace;
    const url = new URL(`/api/v1/namespaces/${namespace}/pods`, this.baseUrl);
    if (params.fieldSelector) {
      url.searchParams.set("fieldSelector", params.fieldSelector);
    }
    if (params.watch) {
      url.searchParams.set("watch", "true");
    }
    const labelSelector = buildLabelSelector(
      params.cardId,
      params.labelSelector
    );
    if (labelSelector) {
      url.searchParams.set("labelSelector", labelSelector);
    }
    return url.toString();
  }

  private resolveRequestUrl(path: string): string {
    if (/^https?:/i.test(path)) {
      return path;
    }
    return new URL(path, this.baseUrl).toString();
  }

  private async request(
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const headers = this.mergeHeaders(init.headers);
    const url = this.resolveRequestUrl(path);
    logger.debug("[openshift] request", { url, method: init.method ?? "GET" });
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers,
        credentials: "omit",
        mode: "cors",
      });
    } catch (err) {
      // Browsers throw TypeError on CORS/preflight/network failures before any response.
      if (err instanceof TypeError) {
        logger.warn("[openshift] network/CORS failure", {
          message: err.message,
        });
        throw new OpenShiftRequestError(
          "Network or CORS/preflight failure (browser blocked request)",
          0,
          err.message
        );
      }
      throw err as Error;
    }
    if (!response.ok) {
      throw await this.toRequestError(response);
    }
    return response;
  }

  private mergeHeaders(headers?: HeadersInit): Headers {
    const merged = new Headers(headers ?? {});
    if (!merged.has("Accept")) {
      merged.set("Accept", "application/json");
    }
    if (this.config.token) {
      merged.set("Authorization", `Bearer ${this.config.token}`);
    }
    return merged;
  }

  private async toRequestError(
    response: Response
  ): Promise<OpenShiftRequestError> {
    let payload: string | undefined;
    try {
      payload = await response.text();
    } catch {
      payload = undefined;
    }
    const message = `OpenShift request failed: ${response.status} ${response.statusText}`;
    logger.warn("[openshift] request failed", {
      status: response.status,
      statusText: response.statusText,
      payload,
    });
    return new OpenShiftRequestError(message, response.status, payload);
  }
}

interface KubernetesOwnerReference {
  kind?: string;
  name?: string;
  uid?: string;
}

interface KubernetesMetadata {
  name?: string;
  namespace?: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  ownerReferences?: KubernetesOwnerReference[];
}

interface KubernetesCondition {
  type?: string;
  status?: string;
  message?: string;
  reason?: string;
}

interface KubernetesContainerStateRunning { startedAt?: string }
interface KubernetesContainerStateTerminated { startedAt?: string; finishedAt?: string }
interface KubernetesContainerStateWaiting { reason?: string }
interface KubernetesContainerState {
  running?: KubernetesContainerStateRunning;
  terminated?: KubernetesContainerStateTerminated;
  waiting?: KubernetesContainerStateWaiting;
}

interface KubernetesPodStatus {
  phase?: string;
  startTime?: string;
  message?: string;
  conditions?: KubernetesCondition[];
  containerStatuses?: { name?: string; restartCount?: number; state?: KubernetesContainerState; lastState?: KubernetesContainerState }[];
}

interface KubernetesEnvVar { name?: string; value?: string }

interface KubernetesPodSpec {
  containers?: { name: string; env?: KubernetesEnvVar[] }[];
  nodeName?: string;
}

interface KubernetesPod {
  metadata: KubernetesMetadata;
  status?: KubernetesPodStatus;
  spec?: KubernetesPodSpec;
}

interface KubernetesListResponse<T> {
  items?: T[];
}

interface KubernetesWatchEvent {
  type: PodWatchEvent["type"];
  object: KubernetesPod;
}
