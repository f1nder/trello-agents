import { STORAGE_KEYS } from '../config/constants';
import { OpenShiftClient, type OpenShiftPodApi, type PodWatchEvent } from '../services/openshiftClient';
import type { AgentPod } from '../types/pods';
import type { ClusterSettings } from '../types/settings';
import { DEFAULT_CLUSTER_SETTINGS } from '../types/settings';
import { getPreviewConfig } from '../utils/preview';
import logger from '../utils/logger';
import { resolveAssetUrl } from '../utils/url';

const BASE_BADGE: TrelloPowerUp.CardBadge = {
  text: 'Agents',
  icon: resolveAssetUrl('/icons/card-agents.svg'),
  title: 'Card Agents Power-Up installed',
};

const BADGE_REFRESH_SECONDS = 15;
const WATCHER_STALE_MS = 2 * 60 * 1000;

const countRunningPods = (pods: AgentPod[]): number =>
  pods.reduce((total, pod) => (pod.phase === 'Running' ? total + 1 : total), 0);

const hashToken = (value: string): string => {
  let hash = 0;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(idx);
    hash |= 0;
  }
  return hash.toString(16);
};

const loadClusterSettings = async (
  t: TrelloPowerUp.Client,
): Promise<{ settings: ClusterSettings; token: string | null }> => {
  const saved =
    (await t.get<ClusterSettings>('board', 'private', STORAGE_KEYS.clusterConfig)) ?? DEFAULT_CLUSTER_SETTINGS;
  let token: string | null = null;
  if (saved.tokenSecretId) {
    try {
      token = await t.loadSecret(saved.tokenSecretId);
    } catch (error) {
      logger.warn('cardBadges: failed to load stored token', error);
    }
  }
  return { settings: saved, token };
};

interface PodRuntimeContext {
  cardId: string;
  namespace: string;
  fingerprint: string;
  clientFactory: () => OpenShiftPodApi;
}

interface RunningPodWatcher {
  cardId: string;
  fingerprint: string;
  status: 'initializing' | 'ready' | 'error';
  count: number;
  error?: Error;
  ready: Promise<void>;
  lastAccess: number;
  touch: () => void;
  dispose: () => void;
}

const runningWatchers = new Map<string, RunningPodWatcher>();
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleCleanup = () => {
  if (cleanupTimer !== null) {
    return;
  }
  cleanupTimer = setTimeout(() => {
    cleanupTimer = null;
    const now = Date.now();
    for (const [cardId, watcher] of runningWatchers.entries()) {
      if (now - watcher.lastAccess > WATCHER_STALE_MS) {
        watcher.dispose();
        runningWatchers.delete(cardId);
      }
    }
    if (runningWatchers.size > 0) {
      scheduleCleanup();
    }
  }, WATCHER_STALE_MS);
};

const createRunningWatcher = (context: PodRuntimeContext): RunningPodWatcher => {
  let stopWatch: (() => void) | null = null;
  let disposed = false;
  const pods = new Map<string, AgentPod>();
  let runningCount = 0;

  const watcher: RunningPodWatcher = {
    cardId: context.cardId,
    fingerprint: context.fingerprint,
    status: 'initializing',
    count: 0,
    ready: Promise.resolve(),
    lastAccess: Date.now(),
    touch: () => {
      watcher.lastAccess = Date.now();
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      stopWatch?.();
    },
  };

  const updateCount = (next: number) => {
    watcher.count = Math.max(0, next);
  };

  const applyEvent = (event: PodWatchEvent) => {
    const previous = pods.get(event.pod.id);
    if (event.type === 'DELETED') {
      if (previous) {
        if (previous.phase === 'Running') {
          runningCount = Math.max(0, runningCount - 1);
        }
        pods.delete(event.pod.id);
        updateCount(runningCount);
      }
      return;
    }
    pods.set(event.pod.id, event.pod);
    const prevRunning = previous?.phase === 'Running' ? 1 : 0;
    const nextRunning = event.pod.phase === 'Running' ? 1 : 0;
    runningCount = Math.max(0, runningCount - prevRunning + nextRunning);
    updateCount(runningCount);
    watcher.status = 'ready';
  };

  const client = context.clientFactory();

  const bootstrap = async () => {
    const initial = await client.listPods({ cardId: context.cardId, namespace: context.namespace });
    pods.clear();
    initial.forEach((pod) => pods.set(pod.id, pod));
    runningCount = countRunningPods(initial);
    updateCount(runningCount);
    watcher.status = 'ready';

    stopWatch = client.watchPods(
      (event) => {
        if (disposed) {
          return;
        }
        applyEvent(event);
      },
      {
        cardId: context.cardId,
        namespace: context.namespace,
        onError: (watchError) => {
          logger.warn('cardBadges: watchPods error', watchError);
        },
      },
    );
  };

  watcher.ready = bootstrap().catch((error) => {
    watcher.status = 'error';
    watcher.error = error as Error;
    throw error;
  });

  return watcher;
};

const resolvePodContext = async (t: TrelloPowerUp.Client): Promise<PodRuntimeContext | null> => {
  const preview = getPreviewConfig();
  if (preview?.openShiftClient && preview.card?.id) {
    const namespace = preview.settings?.namespace ?? DEFAULT_CLUSTER_SETTINGS.namespace;
    return {
      cardId: preview.card.id,
      namespace,
      fingerprint: `preview:${namespace}`,
      clientFactory: () => preview.openShiftClient!,
    };
  }

  const card = await t.card<{ id: string }>('id');
  if (!card?.id) {
    logger.warn('cardBadges: Trello card payload missing id');
    return null;
  }

  const { settings, token } = await loadClusterSettings(t);
  if (!settings.clusterUrl || !token) {
    logger.debug('cardBadges: cluster URL or token missing');
    return null;
  }

  const fingerprint = `${settings.clusterUrl}|${settings.namespace}|${hashToken(token)}`;
  return {
    cardId: card.id,
    namespace: settings.namespace,
    fingerprint,
    clientFactory: () =>
      new OpenShiftClient({
        baseUrl: settings.clusterUrl,
        namespace: settings.namespace,
        token,
        ignoreSsl: settings.ignoreSsl,
        caBundle: settings.caBundle,
      }),
  };
};

const ensureRunningWatcher = async (t: TrelloPowerUp.Client): Promise<RunningPodWatcher | null> => {
  const context = await resolvePodContext(t);
  if (!context) {
    return null;
  }

  let watcher = runningWatchers.get(context.cardId);
  if (!watcher || watcher.fingerprint !== context.fingerprint || watcher.status === 'error') {
    watcher?.dispose();
    watcher = createRunningWatcher(context);
    runningWatchers.set(context.cardId, watcher);
  }

  watcher.touch();
  scheduleCleanup();
  return watcher;
};

const warmRunningWatcher = async (t: TrelloPowerUp.Client) => {
  try {
    const watcher = await ensureRunningWatcher(t);
    await watcher?.ready;
  } catch (error) {
    logger.debug('cardBadges: warm watcher failed', error);
  }
};

const buildRunningBadge = async (t: TrelloPowerUp.Client): Promise<TrelloPowerUp.CardBadge | null> => {
  const refresh = BADGE_REFRESH_SECONDS;
  const watcher = await ensureRunningWatcher(t);
  if (!watcher) {
    return { text: '', refresh };
  }

  try {
    await watcher.ready;
  } catch {
    // ready rejects on fatal bootstrap; watcher.status will be 'error'
  }

  if (watcher.status === 'error') {
    return {
      text: 'Pods offline',
      color: 'red',
      title: watcher.error?.message ?? 'Unable to reach OpenShift pods API',
      refresh,
    };
  }

  const count = watcher.count;
  if (!Number.isFinite(count) || count <= 0) {
    return { text: '', refresh };
  }

  const plural = count === 1 ? '' : 's';
  return {
    text: `${count} running pod${plural}`,
    color: 'green',
    title: count === 1 ? '1 pod is Running on this card' : `${count} pods are Running on this card`,
    refresh,
  };
};

const runningPodsBadge = (t: TrelloPowerUp.Client): TrelloPowerUp.CardBadge => ({
  title: 'Running pods',
  dynamic: () => buildRunningBadge(t),
});

export const cardBadges: TrelloPowerUp.CapabilityHandler<[TrelloPowerUp.Client], TrelloPowerUp.CardBadge[]> = (t) => {
  void warmRunningWatcher(t);
  return [BASE_BADGE, runningPodsBadge(t)];
};
