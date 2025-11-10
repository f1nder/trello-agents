export interface ClusterSettings {
  clusterUrl: string;
  namespace: string;
  loginAlias: string;
  ignoreSsl: boolean;
  tokenSecretId?: string;
  caBundle?: string;
}

export const DEFAULT_CLUSTER_SETTINGS: ClusterSettings = {
  clusterUrl: '',
  namespace: 'automation',
  loginAlias: 'service-account',
  ignoreSsl: false,
};
