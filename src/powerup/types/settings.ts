export interface ClusterSettings {
  clusterUrl: string;
  namespace: string;
  loginAlias: string;
  ignoreSsl: boolean;
  token: string;
  caBundle?: string;
}

export const DEFAULT_CLUSTER_SETTINGS: ClusterSettings = {
  clusterUrl: '',
  namespace: 'automation',
  loginAlias: 'service-account',
  ignoreSsl: false,
  token: '',
};
