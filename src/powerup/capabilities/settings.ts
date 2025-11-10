import { resolveAssetUrl } from '../utils/url';

export const showSettings: TrelloPowerUp.CapabilityHandler<[TrelloPowerUp.Client], Promise<void>> = async (t) => {
  await t.navigate({
    url: t.signUrl(resolveAssetUrl('/settings.html')),
  });
};
