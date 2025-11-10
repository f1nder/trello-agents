import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import CardBackShell from '../powerup/components/CardBackShell';
import LogStreamModal from '../powerup/components/LogStreamModal';
import { MockOpenShiftClient } from '../powerup/services/mockOpenShiftClient';
import type { ClusterSettings } from '../powerup/types/settings';
import type { CardMetadata } from '../powerup/types/trello';
import type { PreviewConfig } from '../powerup/utils/preview';
import { getPreviewConfig } from '../powerup/utils/preview';

const previewSettings: ClusterSettings = {
  clusterUrl: 'https://preview.openshift.local',
  namespace: 'automation',
  loginAlias: 'preview-service-account',
  ignoreSsl: true,
};

const previewCard: CardMetadata = {
  id: 'ESmbX5Vy',
  shortLink: 'ESmbX5Vy',
  labels: [
    { id: 'preview-label-1', name: 'Preview', color: 'green' },
    { id: 'preview-label-2', name: 'Backend', color: 'blue' },
  ],
};

const mockOpenShift = new MockOpenShiftClient(previewCard.id, previewSettings.namespace);

const previewConfig: PreviewConfig = {
  settings: previewSettings,
  token: 'preview-token',
  card: previewCard,
  openShiftClient: mockOpenShift,
};

type StorageKey = `${'card' | 'board'}:${'private' | 'shared'}:${string}`;
const storage = new Map<StorageKey, unknown>();
const secrets = new Map<string, string>();
type ModalHandler = (args: Record<string, unknown> | undefined, resolve: () => void) => void;
let modalHandler: ModalHandler | null = null;

const keyFor = (scope: 'card' | 'board', visibility: 'private' | 'shared', key: string): StorageKey =>
  `${scope}:${visibility}:${key}`;

const registerModalHandler = (handler: ModalHandler | null) => {
  modalHandler = handler;
};

const previewClient: TrelloPowerUp.Client = {
  async card<T = Record<string, unknown>>() {
    const payload = getPreviewConfig()?.card ?? previewCard;
    return { ...payload } as unknown as T;
  },
  async board<T = Record<string, unknown>>() {
    return { id: 'preview-board', name: 'Preview Board' } as unknown as T;
  },
  async member<T = Record<string, unknown>>() {
    return { username: 'preview-user', fullName: 'Preview User' } as unknown as T;
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
  alert: async ({ message }) => {
    window.alert(message);
  },
  track: (event, payload) => {
    console.info('[preview track]', event, payload);
  },
  set: async (scope, visibility, key, value) => {
    storage.set(keyFor(scope, visibility, key), value);
  },
  get: async (scope, visibility, key) => storage.get(keyFor(scope, visibility, key)) as never,
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
    window.open(url, '_blank', 'noopener');
  },
};

previewConfig.trelloClient = previewClient;
window.__CARD_AGENTS_PREVIEW__ = previewConfig;

const PreviewApp = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const resolverRef = useRef<(() => void) | null>(null);

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

  return (
    <>
      <section
        style={{
          margin: '0 auto 1rem',
          padding: '1rem',
          maxWidth: '960px',
          borderRadius: '0.75rem',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          color: '#0f172a',
        }}
      >
        <p className="eyebrow">Preview harness</p>
        <h1 style={{ margin: '0.25rem 0' }}>Card Agents standalone sandbox</h1>
        <p style={{ margin: 0 }}>
          This page renders the real card-back + log modal components without Trello. Dummy pods stream in via the mock
          OpenShift client so you can exercise Stop Pod and Stream Logs flows before wiring a live cluster.
        </p>
      </section>
      <CardBackShell />
      {modalVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            zIndex: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '1rem',
              width: 'min(960px, 100%)',
              maxHeight: '90vh',
              overflow: 'hidden',
              boxShadow: '0 10px 35px rgba(15, 23, 42, 0.25)',
              position: 'relative',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
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
            <div style={{ padding: '1.25rem' }}>
              <LogStreamModal />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

ReactDOM.createRoot(document.getElementById('preview-root') as HTMLElement).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>,
);

export default PreviewApp;
