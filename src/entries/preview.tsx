import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import CardBackShell from "../powerup/components/CardBackShell";
import LogStreamModal from "../powerup/components/LogStreamModal";
import { MockOpenShiftClient } from "../powerup/services/mockOpenShiftClient";
import type { ClusterSettings } from "../powerup/types/settings";
import type { CardMetadata } from "../powerup/types/trello";
import {
  getPreviewConfig,
  PREVIEW_THEME_EVENT,
  type PreviewConfig,
  type TrelloTheme,
} from "../powerup/utils/preview";

const previewSettings: ClusterSettings = {
  clusterUrl: "https://preview.openshift.local",
  namespace: "automation",
  loginAlias: "preview-service-account",
  ignoreSsl: true,
};

const previewCard: CardMetadata = {
  id: "ESmbX5Vy",
  shortLink: "ESmbX5Vy",
  labels: [
    { id: "preview-label-1", name: "Preview", color: "green" },
    { id: "preview-label-2", name: "Backend", color: "blue" },
  ],
};

const mockOpenShift = new MockOpenShiftClient(
  previewCard.id,
  previewSettings.namespace
);

const previewConfig: PreviewConfig = {
  settings: previewSettings,
  token: "preview-token",
  card: previewCard,
  openShiftClient: mockOpenShift,
};

const IconSun = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M12 4V2m0 20v-2m6.364-12.364 1.414-1.414m-13.657 13.657 1.414-1.414M22 12h-2M4 12H2m15.364 6.364 1.414 1.414M5.222 5.222 6.636 6.636M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const IconMoon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M21 15.5A8.5 8.5 0 0 1 8.5 3 7 7 0 0 0 9 17a7 7 0 0 0 12 1.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

type StorageKey = `${"card" | "board"}:${"private" | "shared"}:${string}`;
const storage = new Map<StorageKey, unknown>();
const secrets = new Map<string, string>();
type ModalHandler = (
  args: Record<string, unknown> | undefined,
  resolve: () => void
) => void;
let modalHandler: ModalHandler | null = null;

const keyFor = (
  scope: "card" | "board",
  visibility: "private" | "shared",
  key: string
): StorageKey => `${scope}:${visibility}:${key}`;

const registerModalHandler = (handler: ModalHandler | null) => {
  modalHandler = handler;
};

const previewClient: TrelloPowerUp.Client = {
  async card<T = Record<string, unknown>>() {
    const payload = getPreviewConfig()?.card ?? previewCard;
    return { ...payload } as unknown as T;
  },
  async board<T = Record<string, unknown>>() {
    return { id: "preview-board", name: "Preview Board" } as unknown as T;
  },
  async member<T = Record<string, unknown>>() {
    return {
      username: "preview-user",
      fullName: "Preview User",
    } as unknown as T;
  },
  signUrl: (url) => url,
  modal: ({ args }) =>
    new Promise<void>((resolve) => {
      const config = getPreviewConfig();
      if (config) {
        config.modalArgs = args ?? {};
      }
      if (modalHandler) {
        modalHandler(args, () => {
          if (config) {
            config.modalArgs = undefined;
          }
          resolve();
        });
      } else {
        resolve();
      }
    }),
  popup: async ({ url }) => {
    window.open(url, "_blank", "noopener");
  },
  alert: async ({ message }) => {
    window.alert(message);
  },
  track: (event, payload) => {
    console.info("[preview track]", event, payload);
  },
  set: async (scope, visibility, key, value) => {
    storage.set(keyFor(scope, visibility, key), value);
  },
  get: async (scope, visibility, key) =>
    storage.get(keyFor(scope, visibility, key)) as never,
  remove: async (scope, visibility, key) => {
    storage.delete(keyFor(scope, visibility, key));
  },
  storeSecret: async (key, value) => {
    secrets.set(key, value);
    return key;
  },
  loadSecret: async (key) => secrets.get(key) ?? null,
  arg: (key) => getPreviewConfig()?.modalArgs?.[key] as never,
  navigate: async ({ url }) => {
    window.open(url, "_blank", "noopener");
  },
};

previewConfig.trelloClient = previewClient;
window.__CARD_AGENTS_PREVIEW__ = previewConfig;

const PreviewApp = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const resolverRef = useRef<(() => void) | null>(null);
  const seedTheme: TrelloTheme = previewConfig.theme ?? "dark";
  if (!previewConfig.theme) {
    previewConfig.theme = seedTheme;
  }
  const [theme, setTheme] = useState<TrelloTheme>(seedTheme);

  const closeModal = useCallback(() => {
    const config = getPreviewConfig();
    if (config) {
      config.modalArgs = undefined;
    }
    setModalVisible(false);
    resolverRef.current?.();
    resolverRef.current = null;
  }, []);

  useEffect(() => {
    registerModalHandler((_, resolve) => {
      resolverRef.current = resolve;
      setModalVisible(true);
    });
    return () => registerModalHandler(null);
  }, []);

  useEffect(() => {
    previewConfig.theme = theme;
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-trello-theme", theme);
      document.body?.setAttribute("data-trello-theme", theme);
    }
    window.dispatchEvent(
      new CustomEvent<TrelloTheme>(PREVIEW_THEME_EVENT, { detail: theme })
    );
  }, [theme]);

  const applyTheme = (nextTheme: TrelloTheme) => () => {
    setTheme((current) => (current === nextTheme ? current : nextTheme));
  };

  return (
    <>
      <section className="preview-hero">
        <p className="eyebrow">Preview harness</p>
        <h1 style={{ margin: "0.25rem 0", color: "var(--ca-text)" }}>
          Card Agents standalone sandbox (BETA)
        </h1>
        <p>
          This page renders the real card-back + log modal components without
          Trello. Dummy pods stream in via the mock OpenShift client so you can
          exercise Stop Pod and Stream Logs flows before wiring a live cluster.
        </p>
        <div className="theme-toggle">
          <span className="theme-toggle__label">Theme</span>
          <div
            className="theme-toggle__group"
            role="group"
            aria-label="Toggle Trello theme"
          >
            <button
              type="button"
              className={`theme-toggle__button${
                theme === "light" ? " is-active" : ""
              }`}
              onClick={applyTheme("light")}
            >
              <IconSun />
              Light
            </button>
            <button
              type="button"
              className={`theme-toggle__button${
                theme === "dark" ? " is-active" : ""
              }`}
              onClick={applyTheme("dark")}
            >
              <IconMoon />
              Dark
            </button>
          </div>
        </div>
        <div className="preview-hero__settings">
          <p>
            Visit the settings page to explore the configuration UI without
            Trello.
          </p>
          <a
            className="preview-hero__settings-link"
            href="./settings.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Settings page
          </a>
        </div>
      </section>
      <CardBackShell />
      {modalVisible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--ca-modal-scrim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            zIndex: 20,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        >
          <div
            style={{
              background: "var(--ca-modal-surface)",
              borderRadius: "1rem",
              width: "min(960px, 100%)",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 10px 35px rgba(15, 23, 42, 0.25)",
              position: "relative",
              pointerEvents: "auto",
              border: "1px solid var(--ca-modal-border)",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem 1.25rem",
                borderBottom: "1px solid var(--ca-modal-border)",
                background: "var(--ca-modal-surface)",
              }}
            >
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>
                  Preview modal
                </p>
                <h2 style={{ margin: 0 }}>Stream Logs</h2>
              </div>
              <button type="button" onClick={closeModal}>
                Close
              </button>
            </header>
            <div style={{ padding: "1.25rem" }}>
              <LogStreamModal />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

ReactDOM.createRoot(
  document.getElementById("preview-root") as HTMLElement
).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>
);

export default PreviewApp;
