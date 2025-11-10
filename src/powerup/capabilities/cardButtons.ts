import { resolveAssetUrl } from '../utils/url';

export const cardButtons: TrelloPowerUp.CapabilityHandler<[TrelloPowerUp.Client], TrelloPowerUp.CardButton[]> = (t) => [
  {
    text: 'Open roster',
    icon: resolveAssetUrl('/icons/card-agents.svg'),
    callback: () =>
      t.modal({
        url: t.signUrl(resolveAssetUrl('/card-back.html')),
        title: 'Card Agents roster',
        height: 640,
      }),
  },
];
