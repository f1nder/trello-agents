/* Minimal Trello Power-Up typings to keep the scaffold strongly typed. */
declare namespace TrelloPowerUp {
  interface Client {
    card<T = Record<string, unknown>>(props?: string[]): Promise<T>;
    board<T = Record<string, unknown>>(props?: string[]): Promise<T>;
    member<T = Record<string, unknown>>(): Promise<T>;
    signUrl(url: string): string;
    modal(options: {
      url: string;
      accentColor?: string;
      fullscreen?: boolean;
      height?: number;
      title?: string;
      args?: Record<string, unknown>;
    }): Promise<void>;
    alert(options: { message: string; display?: 'info' | 'warning' | 'error' }): Promise<void>;
    track(event: string, payload?: Record<string, unknown>): void;
    set(scope: 'card' | 'board', visibility: 'private' | 'shared', key: string, value: unknown): Promise<void>;
    get<T = unknown>(scope: 'card' | 'board', visibility: 'private' | 'shared', key: string): Promise<T | undefined>;
    remove(scope: 'card' | 'board', visibility: 'private' | 'shared', key: string): Promise<void>;
    storeSecret(key: string, value: string): Promise<string>;
    loadSecret(key: string): Promise<string | null>;
  }

  type CapabilityHandler<T extends unknown[] = unknown[], R = unknown> = (...args: T) => R;

  interface CapabilityMap {
    'card-back-section': CapabilityHandler<[Client], Promise<CardBackSectionResponse> | CardBackSectionResponse>;
    'card-buttons': CapabilityHandler<[Client], CardButton[]>;
    'card-detail-badges': CapabilityHandler<[Client], Promise<CardDetailBadge[]> | CardDetailBadge[]>;
    'card-badges': CapabilityHandler<[Client], Promise<CardBadge[]> | CardBadge[]>;
    'authorization-status': CapabilityHandler<[Client], Promise<AuthorizationStatus>>;
    'show-authorization': CapabilityHandler<[Client], Promise<void> | void>;
    'show-settings': CapabilityHandler<[Client], Promise<void> | void>;
    modals?: CapabilityHandler;
  }

  interface CardButton {
    icon?: string;
    text: string;
    callback: CapabilityHandler<[Client], void | Promise<void>>;
    condition?: CapabilityHandler<[Client], boolean | Promise<boolean>>;
  }

  interface CardBadge {
    icon?: string;
    text?: string;
    color?: string;
    title?: string;
  }

  interface CardDetailBadge extends CardBadge {
    display?: () => CardBadge;
  }

  interface CardBackSectionResponse {
    title: string;
    icon?: { url: string };
    content: {
      type: 'iframe';
      url: string;
      height?: number;
    };
  }

  interface AuthorizationStatus {
    authorized: boolean;
    validity?: Date | string | null;
  }

  interface InitializeOptions {
    appName?: string;
  }
}

declare interface TrelloPowerUpGlobal {
  initialize(
    capabilityMap: TrelloPowerUp.CapabilityMap & Record<string, TrelloPowerUp.CapabilityHandler>,
    options?: TrelloPowerUp.InitializeOptions,
  ): void;
  iframe(): Promise<TrelloPowerUp.Client>;
}

declare global {
  interface Window {
    TrelloPowerUp?: TrelloPowerUpGlobal;
  }
  interface GlobalThis {
    TrelloPowerUp?: TrelloPowerUpGlobal;
  }
  var TrelloPowerUp: TrelloPowerUpGlobal | undefined;
}
