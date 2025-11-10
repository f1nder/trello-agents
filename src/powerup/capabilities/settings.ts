import { resolveAssetUrl } from '../utils/url';

export const showSettings: TrelloPowerUp.CapabilityHandler<[TrelloPowerUp.Client], Promise<void>> = async (t) => {
  await t.modal({
    url: t.signUrl(resolveAssetUrl('/settings.html')),
    title: 'Card Agents settings',
    height: 720,
  });
};
