import type { ClusterSettings } from '../types/settings';
import type { CardMetadata } from '../types/trello';
import type { OpenShiftPodApi } from '../services/openshiftClient';

export type TrelloTheme = 'light' | 'dark';

export interface PreviewConfig {
  trelloClient?: TrelloPowerUp.Client;
  settings?: ClusterSettings;
  token?: string | null;
  card?: CardMetadata;
  openShiftClient?: OpenShiftPodApi;
  modalArgs?: Record<string, unknown>;
  theme?: TrelloTheme;
}

export const PREVIEW_THEME_EVENT = 'card-agents-preview-theme';

export const getPreviewConfig = (): PreviewConfig | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.__CARD_AGENTS_PREVIEW__;
};

declare global {
  interface Window {
    __CARD_AGENTS_PREVIEW__?: PreviewConfig;
  }
}
