import { CARD_BACK_IFRAME, CARD_BACK_ICON_PATH } from '../config/constants';
import { resolveAssetUrl } from '../utils/url';
import logger from '../utils/logger';

export const cardBackSection: TrelloPowerUp.CapabilityHandler<[TrelloPowerUp.Client], TrelloPowerUp.CardBackSectionResponse> = (
  t,
) => ({
  title: 'Card Agents Live Roster',
  // Trello requires a monochrome gray icon for card-back sections.
  icon: resolveAssetUrl(CARD_BACK_ICON_PATH),
  content: {
    type: 'iframe',
    url: t.signUrl(resolveAssetUrl(CARD_BACK_IFRAME)),
    height: 520,
  },
});

// Log resolved assets once on module load (helps debug missing icon issues)
(() => {
  try {
    const iconUrl = resolveAssetUrl(CARD_BACK_ICON_PATH);
    const iframeUrl = resolveAssetUrl(CARD_BACK_IFRAME);
    logger.info('cardBackSection assets', { iconUrl, iframeUrl });
  } catch (e) {
    logger.warn('cardBackSection asset resolution failed', e);
  }
})();
