export interface ClusterSettings {
  clusterUrl: string;
  namespace: string;
  loginAlias: string;
  ignoreSsl: boolean;
  token: string;
  caBundle?: string;
  /**
   * Optional base URL of a Kubernetes dashboard (e.g. the Kubernetes Dashboard,
   * Headlamp, or any web UI). When set, pods link out to this dashboard using a
   * Kubernetes-Dashboard-style deep link. Leave empty to hide the link.
   */
  consoleUrl?: string;
}

export const DEFAULT_CLUSTER_SETTINGS: ClusterSettings = {
  clusterUrl: '',
  namespace: 'automation',
  loginAlias: 'service-account',
  ignoreSsl: false,
  token: '',
};
