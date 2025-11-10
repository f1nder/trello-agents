import type { AgentPod } from "../types/pods";
import logger from "./logger";

const fallbackConfirm = (message: string): boolean => {
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    return window.confirm(message);
  }
  // Environments without window.confirm (e.g., tests) just proceed.
  return true;
};

/**
 * Ask the operator to confirm destructive pod deletion via the Trello popup UI.
 * Falls back to `window.confirm` (or auto-approve in test environments) when
 * the Trello client is unavailable or rejects the popup request.
 */
export const confirmPodDeletion = async (
  pod: AgentPod,
  trello?: TrelloPowerUp.Client | null
): Promise<boolean> => {
  const message = `Stop pod ${pod.name} in namespace ${pod.namespace}? This also deletes its backing job when available.`;
  if (!trello) {
    return fallbackConfirm(message);
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    trello
      .popup({
        type: "confirm",
        title: `Stop ${pod.name}?`,
        message,
        confirmText: "Stop pod",
        confirmStyle: "danger",
        cancelText: "Keep running",
        onConfirm: async (_t, _opts) => {
          settle(true);
        },
        onCancel: async (_t, _opts) => {
          settle(false);
        },
      })
      .catch((error) => {
        logger.warn("confirmPodDeletion: Trello popup failed, falling back", error);
        settle(fallbackConfirm(message));
      });
  });
};

export default confirmPodDeletion;
