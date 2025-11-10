import { APP_NAME } from './config/constants';
import { cardBackSection } from './capabilities/cardBackSection';
import { cardButtons } from './capabilities/cardButtons';
import { cardBadges } from './capabilities/cardBadges';
import { cardDetailBadges } from './capabilities/cardDetailBadges';
import { authorizationStatus, showAuthorization } from './capabilities/authorization';
import { showSettings } from './capabilities/settings';
import logger from './utils/logger';

const bootstrap = () => {
  logger.info('bootstrap start');
  const powerUp = (window as Window & { TrelloPowerUp?: TrelloPowerUpGlobal }).TrelloPowerUp;
  if (!powerUp) {
    logger.warn('TrelloPowerUp global not found. Did the client script load?');
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

  try {
    logger.info('initialize capabilities', Object.keys(capabilityMap));
    powerUp.initialize(capabilityMap, { appName: APP_NAME });
    logger.info('initialize called');
  } catch (err) {
    logger.error('initialize failed', err);
  }
};

bootstrap();
