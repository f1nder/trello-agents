import { resolveAssetUrl } from "../utils/url";
import {
  fetchRunningPodSnapshot,
  type RunningPodSnapshot,
} from "../services/podRuntime";
import logger from "../utils/logger";

const BADGE_REFRESH_SECONDS = 10;

const buildDetailBadge = async (
  t: TrelloPowerUp.Client
): Promise<TrelloPowerUp.CardDetailBadge | null> => {
  const refresh = BADGE_REFRESH_SECONDS;
  let snapshot: RunningPodSnapshot | null;
  try {
    snapshot = await fetchRunningPodSnapshot(t);
  } catch (error) {
    logger.warn("cardDetailBadges: snapshot fetch failed", error);
    return null;
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
    icon: resolveAssetUrl("/icons/card-agents-gray.svg"),
    text: `${count} agent${plural}`,
    color: "blue",
    refresh,
  };
};

const runningAgentsDetailBadge = (
  t: TrelloPowerUp.Client
): TrelloPowerUp.CardDetailBadge => ({
  dynamic: () => buildDetailBadge(t),
});

export const cardDetailBadges: TrelloPowerUp.CapabilityHandler<
  [TrelloPowerUp.Client],
  TrelloPowerUp.CardDetailBadge[]
> = (t) => [runningAgentsDetailBadge(t)];
