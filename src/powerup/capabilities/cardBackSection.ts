import { CARD_BACK_IFRAME, CARD_BACK_ICON_PATH } from "../config/constants";
import { resolveAssetUrl } from "../utils/url";
import logger from "../utils/logger";
import { ensureRunningWatcher } from "../services/podRuntime";

const MIN_SECTION_HEIGHT = 100;
const POD_ROW_HEIGHT = 74;
const HEADER_ALLOWANCE = 110;
const MAX_VISIBLE_PODS = 10;

const clampRows = (pods: number | null): number => {
  if (!Number.isFinite(pods ?? NaN) || (pods ?? 0) <= 0) {
    return 1;
  }
  return Math.min(Math.max(Math.floor(pods ?? 1), 1), MAX_VISIBLE_PODS);
};

const estimateSectionHeight = (rows: number): number => {
  const estimated = HEADER_ALLOWANCE + rows * POD_ROW_HEIGHT;
  return Math.max(MIN_SECTION_HEIGHT, Math.round(estimated));
};


export const cardBackSection: TrelloPowerUp.CapabilityHandler<
  [TrelloPowerUp.Client],
  Promise<TrelloPowerUp.CardBackSectionResponse | null>
> = async (t) => {
  try {
    const watcher = await ensureRunningWatcher(t);
    if (!watcher) {
      return null;
    }
    try {
      await watcher.ready;
    } catch {
      // ignore bootstrap errors; watcher.status will describe issues elsewhere
    }
    if (!watcher.total || watcher.total <= 0) {
      return null;
    }
    const rows = clampRows(watcher.total);
    const height = estimateSectionHeight(rows);
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
  } catch (error) {
    logger.debug("cardBackSection: falling back to null", error);
    return null;
  }
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
