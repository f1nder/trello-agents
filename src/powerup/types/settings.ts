export interface ClusterSettings {
  clusterUrl: string;
  namespace: string;
  loginAlias: string;
  tokenSecretId: string;
  ignoreSsl: boolean;
}

export const DEFAULT_CLUSTER_SETTINGS: ClusterSettings = {
  clusterUrl: '',
  namespace: 'automation',
  loginAlias: 'service-account',
  tokenSecretId: '',
  ignoreSsl: false,
};
