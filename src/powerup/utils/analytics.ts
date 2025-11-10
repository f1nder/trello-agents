export type TrackPayload = Record<string, unknown> | undefined;

// Safely invoke Trello client's `track` if present; otherwise no-op (logs in dev).
export const trackEvent = (
  trello: TrelloPowerUp.Client | null,
  event: string,
  payload?: TrackPayload,
): void => {
  try {
    const anyClient = trello as unknown as { track?: (e: string, p?: TrackPayload) => void } | null;
    if (anyClient && typeof anyClient.track === 'function') {
      anyClient.track(event, payload);
      return;
    }
    if (typeof console !== 'undefined' && import.meta.env?.DEV) {
      // Helpful during local preview / non-Trello contexts.
      console.info('[track noop]', event, payload);
    }
  } catch {
    // Intentionally swallow errors from analytics.
  }
};
