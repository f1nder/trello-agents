import { resolveAssetUrl } from "../utils/url";

export const showSettings: TrelloPowerUp.CapabilityHandler<
  [TrelloPowerUp.Client],
  Promise<void>
> = async (t) => {
  // Follow Trello docs: use a popup for show-settings from the Power-Ups menu.
  await t.modal({
    title: "Agents Settings",
    url: t.signUrl(resolveAssetUrl("/settings.html")),
    height: 560, // popup can be resized later by Trello
  });
};
