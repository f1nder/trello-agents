type Level = 'debug' | 'info' | 'warn' | 'error';

const prefix = '[card-agents]';

const log = (level: Level, ...args: unknown[]) => {
  // eslint-disable-next-line no-console
  (console as any)[level]?.(prefix, ...args);
};

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};

export default logger;

