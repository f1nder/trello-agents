import { APP_NAME } from './config/constants';
import { cardBackSection } from './capabilities/cardBackSection';
import { cardButtons } from './capabilities/cardButtons';
import { cardBadges } from './capabilities/cardBadges';
import { cardDetailBadges } from './capabilities/cardDetailBadges';
import { authorizationStatus, showAuthorization } from './capabilities/authorization';
import { showSettings } from './capabilities/settings';
import logger from './utils/logger';
import { TRELLO_APP_KEY } from './config/trello';

const capabilityMap = {
  'card-back-section': cardBackSection,
  'card-buttons': cardButtons,
  'card-badges': cardBadges,
  'card-detail-badges': cardDetailBadges,
  'authorization-status': authorizationStatus,
  'show-authorization': showAuthorization,
  'show-settings': showSettings,
} as TrelloPowerUp.CapabilityMap & Record<string, TrelloPowerUp.CapabilityHandler>;

const waitForPowerUp = (timeoutMs = 8000, intervalMs = 100): Promise<TrelloPowerUpGlobal> =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const pu = (window as Window & { TrelloPowerUp?: TrelloPowerUpGlobal }).TrelloPowerUp;
      if (pu && typeof pu.initialize === 'function') return resolve(pu);
      if (Date.now() - start > timeoutMs) return reject(new Error('TrelloPowerUp global not found after wait'));
      setTimeout(check, intervalMs);
    };
    check();
  });

const bootstrap = async () => {
  logger.info('bootstrap start');
  try {
    const powerUp = await waitForPowerUp();
    logger.info('initialize capabilities', Object.keys(capabilityMap));
    const options: TrelloPowerUp.InitializeOptions & { appKey?: string } = { appName: APP_NAME };
    if (TRELLO_APP_KEY) options.appKey = TRELLO_APP_KEY;
    powerUp.initialize(capabilityMap, options);
    logger.info('initialize called');
  } catch (err) {
    logger.warn('TrelloPowerUp global not found. Did the client script load?', err);
  }
};

bootstrap();
