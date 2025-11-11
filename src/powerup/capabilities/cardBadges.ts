import { resolveAssetUrl } from "../utils/url";
import {
  fetchRunningPodSnapshot,
  type RunningPodSnapshot,
} from "../services/podRuntime";
import logger from "../utils/logger";

const BASE_BADGE: TrelloPowerUp.CardBadge = {
  text: "Agents",
  icon: resolveAssetUrl("/icons/card-agents-gray.svg"),
  title: "Card Agents Power-Up installed",
};

const BADGE_REFRESH_SECONDS = 10;

const buildRunningBadge = async (
  t: TrelloPowerUp.Client
): Promise<TrelloPowerUp.CardBadge | null> => {
  const refresh = BADGE_REFRESH_SECONDS;
  let snapshot: RunningPodSnapshot | null;
  try {
    snapshot = await fetchRunningPodSnapshot(t);
  } catch (error) {
    logger.warn("cardBadges: snapshot fetch failed", error);
    return {
      text: "Agents offline",
      color: "red",
      title: "Unable to reach OpenShift pods API",
      refresh,
      monochrome: false,
      icon: resolveAssetUrl("/icons/card-agents-gray.svg"),
    };
  }

  if (!snapshot) {
    return { text: "", refresh };
  }

  const count = snapshot.count;
  if (!Number.isFinite(count) || count <= 0) {
    return { text: "", refresh };
  }

  const plural = count === 1 ? "" : "s";
  return {
    text: `${count} agent${plural}`,
    color: "red",
    icon: resolveAssetUrl("/icons/card-agents-gray.svg"),
    title:
      count === 1
        ? "1 agent is Running on this card"
        : `${count} agents are Running on this card`,
    monochrome: false,
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
  return [runningPodsBadge(t)];
};
