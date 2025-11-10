import { APP_NAME } from './config/constants';
import { cardBackSection } from './capabilities/cardBackSection';
import { cardButtons } from './capabilities/cardButtons';
import { cardBadges } from './capabilities/cardBadges';
import { cardDetailBadges } from './capabilities/cardDetailBadges';
import { authorizationStatus, showAuthorization } from './capabilities/authorization';
import { showSettings } from './capabilities/settings';

const bootstrap = () => {
  const powerUp = (window as Window & { TrelloPowerUp?: TrelloPowerUpGlobal }).TrelloPowerUp;
  if (!powerUp) {
    console.warn('[powerup] TrelloPowerUp global unavailable; skipping initialize.');
    return;
  }

  const capabilityMap = {
    'card-back-section': cardBackSection,
    'card-buttons': cardButtons,
    'card-badges': cardBadges,
    'card-detail-badges': cardDetailBadges,
    'authorization-status': authorizationStatus,
    'show-authorization': showAuthorization,
    'show-settings': showSettings,
  } as TrelloPowerUp.CapabilityMap & Record<string, TrelloPowerUp.CapabilityHandler>;

  powerUp.initialize(capabilityMap, {
    appName: APP_NAME,
  });
};

bootstrap();
