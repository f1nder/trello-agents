import { resolveAssetUrl } from "../utils/url";
import {
  ensureRunningWatcher,
  warmRunningWatcher,
} from "../services/podRuntime";

const BASE_BADGE: TrelloPowerUp.CardBadge = {
  text: "Agents",
  icon: resolveAssetUrl("/icons/card-agents.svg"),
  title: "Card Agents Power-Up installed",
};

const BADGE_REFRESH_SECONDS = 15;

const buildRunningBadge = async (
  t: TrelloPowerUp.Client
): Promise<TrelloPowerUp.CardBadge | null> => {
  const refresh = BADGE_REFRESH_SECONDS;
  const watcher = await ensureRunningWatcher(t);
  if (!watcher) {
    return { text: "", refresh };
  }

  try {
    await watcher.ready;
  } catch {
    // ready rejects on fatal bootstrap; watcher.status will be 'error'
  }

  if (watcher.status === "error") {
    return {
      text: "Agents offline",
      color: "red",
      title: watcher.error?.message ?? "Unable to reach OpenShift pods API",
      refresh,
    };
  }

  const count = watcher.count;
  if (!Number.isFinite(count) || count <= 0) {
    return { text: "", refresh };
  }

  const plural = count === 1 ? "" : "s";
  return {
    text: `${count} agent${plural}`,
    color: "green",
    title:
      count === 1
        ? "1 agent is Running on this card"
        : `${count} agents are Running on this card`,
    refresh,
  };
};

const runningPodsBadge = (
  t: TrelloPowerUp.Client
): TrelloPowerUp.CardBadge => ({
  title: "Running agents",
  dynamic: () => buildRunningBadge(t),
});

export const cardBadges: TrelloPowerUp.CapabilityHandler<
  [TrelloPowerUp.Client],
  TrelloPowerUp.CardBadge[]
> = (t) => {
  void warmRunningWatcher(t);
  return [runningPodsBadge(t)];
};
