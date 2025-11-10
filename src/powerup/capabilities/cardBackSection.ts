import { CARD_BACK_IFRAME, ICON_PATH } from '../config/constants';
import { resolveAssetUrl } from '../utils/url';

export const cardBackSection: TrelloPowerUp.CapabilityHandler<[TrelloPowerUp.Client], TrelloPowerUp.CardBackSectionResponse> = (
  t,
) => ({
  title: 'Card Agents Live Roster',
  icon: { url: resolveAssetUrl(ICON_PATH) },
  content: {
    type: 'iframe',
    url: t.signUrl(resolveAssetUrl(CARD_BACK_IFRAME)),
    height: 520,
  },
});
