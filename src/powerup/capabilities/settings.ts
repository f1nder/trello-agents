import { resolveAssetUrl } from '../utils/url';

export const showSettings: TrelloPowerUp.CapabilityHandler<[TrelloPowerUp.Client], Promise<void>> = async (t) => {
  // Use a modal for broader compatibility across Trello entry points.
  await t.modal({
    url: t.signUrl(resolveAssetUrl('/settings.html')),
    title: 'Cluster Settings',
    height: 520,
  });
};
