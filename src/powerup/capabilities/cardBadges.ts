import { resolveAssetUrl } from '../utils/url';

export const cardBadges: TrelloPowerUp.CapabilityHandler<[TrelloPowerUp.Client], TrelloPowerUp.CardBadge[]> = () => [
  {
    text: 'Agents',
    icon: resolveAssetUrl('/icons/card-agents.svg'),
    title: 'Card Agents Power-Up installed',
  },
];
