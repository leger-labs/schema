/**
 * TypeScript types for multi-service topology schema
 */

export interface Topology {
  schema_version: string;
  release?: ReleaseInfo;
  topology: TopologyDefinition;
  secrets?: SecretsConfig;
}

export interface ReleaseInfo {
  version: string;
  released_at: string;
  template_sha: string;
  changelog_url?: string;
  description?: string;
}

export interface TopologyDefinition {
  network: NetworkConfig;
  services: Record<string, Service>;
}

export interface NetworkConfig {
  name: string;
  subnet: string;
  gateway: string;
}

export interface Service {
  infrastructure: ServiceInfrastructure;
  configuration?: ServiceConfiguration;
}

export interface ServiceInfrastructure {
  image: string;
  container_name: string;
  hostname?: string;
  port?: number;
  published_port?: number | null;
  bind?: string;
  network?: string;
  requires?: string[];
  enabled?: boolean;
  enabled_by?: string[];
  volumes?: VolumeMount[];
  healthcheck?: HealthCheck;
  websocket?: boolean;
  external_subdomain?: string | null;
  description?: string;
}

export interface VolumeMount {
  name: string;
  mount_path: string;
  selinux_label?: string;
  type?: 'volume' | 'bind';
}

export interface HealthCheck {
  cmd: string;
  interval?: string;
  timeout?: string;
  retries?: number;
  start_period?: string;
}

export interface ServiceConfiguration {
  type: 'object';
  properties: Record<string, ConfigurationField>;
  required?: string[];
}

export interface ConfigurationField {
  type: 'string' | 'boolean' | 'integer' | 'number' | 'array' | 'object';
  description: string;
  default?: any;
  enum?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;

  // Metadata extensions
  'x-env-var'?: string;
  'x-category'?: string;
  'x-display-order'?: number;
  'x-visibility'?: 'exposed' | 'advanced' | 'expert' | 'hidden';
  'x-sensitive'?: boolean;
  'x-depends-on'?: Record<string, any>;
  'x-enables-services'?: string[];
  'x-provider-fields'?: string[] | Record<string, string[]>;
  'x-affects-services'?: Record<string, string | null>;
  'x-template-path'?: string;
  'x-secret-ref'?: string;
  'x-rationale'?: string;
  'x-default-handling'?: 'preloaded' | 'unset' | 'user-configured';
  'x-requires-field'?: string;
}

export interface SecretsConfig {
  api_keys?: Record<string, string>;
  llm_providers?: Record<string, string>;
  search_providers?: Record<string, string>;
  audio_providers?: Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ConfigurationState {
  timestamp: string;
  schema_version: string;
  services: Record<string, ServiceState>;
}

export interface ServiceState {
  fields: Record<string, FieldState>;
  summary: {
    total: number;
    using_defaults: number;
    user_configured: number;
    unset_required: number;
  };
}

export interface FieldState {
  state: 'default' | 'configured' | 'unset' | 'optional_unset';
  value?: any;
  required: boolean;
  type: string;
  sensitive: boolean;
  visibility: string;
  template_path?: string;
  secret_ref?: string;
}
