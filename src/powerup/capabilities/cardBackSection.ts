import { CARD_BACK_IFRAME, CARD_BACK_ICON_PATH } from "../config/constants";
import { resolveAssetUrl } from "../utils/url";
import logger from "../utils/logger";
import { ensureRunningWatcher } from "../services/podRuntime";
import {
  estimateCardBackHeight,
  hasDisplayablePods,
} from "../utils/cardBackSizing";

const resolveDynamicHeight = async (
  t: TrelloPowerUp.Client
): Promise<number | null> => {
  try {
    const watcher = await ensureRunningWatcher(t);
    if (!watcher) {
      logger.debug("cardBackSection: watcher not available");
      return null;
    }
    try {
      await watcher.ready;
    } catch (bootstrapError) {
      logger.debug("cardBackSection: watcher bootstrap failed", bootstrapError);
    }

    if (!hasDisplayablePods(watcher.total)) {
      logger.info("cardBackSection: no pods for card, hiding section", {
        cardId: watcher.cardId,
      });
      return null;
    }

    return estimateCardBackHeight(watcher.total);
  } catch (error) {
    logger.debug("cardBackSection: failed to resolve dynamic height", error);
    return null;
  }
};

export const cardBackSection: TrelloPowerUp.CapabilityHandler<
  [TrelloPowerUp.Client],
  Promise<TrelloPowerUp.CardBackSectionResponse | null>
> = async (t) => {
  const height = await resolveDynamicHeight(t);
  if (height === null) {
    return null;
  }

  return {
    title: "Agents",
    // Trello requires a monochrome gray icon for card-back sections.
    icon: resolveAssetUrl(CARD_BACK_ICON_PATH),
    content: {
      type: "iframe",
      url: t.signUrl(resolveAssetUrl(CARD_BACK_IFRAME)),
      height,
    },
  };
};

// Log resolved assets once on module load (helps debug missing icon issues)
(() => {
  try {
    const iconUrl = resolveAssetUrl(CARD_BACK_ICON_PATH);
    const iframeUrl = resolveAssetUrl(CARD_BACK_IFRAME);
    logger.info("cardBackSection assets", { iconUrl, iframeUrl });
  } catch (e) {
    logger.warn("cardBackSection asset resolution failed", e);
  }
})();
