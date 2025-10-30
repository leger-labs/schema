#!/usr/bin/env python3
"""
Blueprint Config Migration Tool

Migrates blueprint-config.json to topology.json format with dual-layer architecture.

Transformation:
  blueprint-config.json (flat config) -> topology.json (dual-layer)

Key Changes:
  • infrastructure.services -> topology.services.*.infrastructure
  • Service-specific configs -> topology.services.*.configuration
  • Adds metadata (x-env-var, x-category, x-visibility, etc.)
  • Preserves secrets section
  • Handles conditional enablement (enabled_by)
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime


class BlueprintMigrator:
    """Migrate blueprint-config.json to topology.json"""

    def __init__(self, blueprint: Dict):
        """
        Initialize migrator

        Args:
            blueprint: Blueprint config dictionary
        """
        self.blueprint = blueprint

    def migrate(self) -> Dict:
        """
        Perform migration

        Returns:
            Topology dictionary in new format
        """
        topology = {
            'schema_version': '2.0.0',
            'release': {
                'version': 'v1.0.0-migrated',
                'released_at': datetime.utcnow().isoformat() + 'Z',
                'template_sha': 'migrated',
                'changelog_url': '',
                'description': f"Migrated from blueprint-config.json on {datetime.utcnow().date()}"
            },
            'topology': {
                'network': self._migrate_network(),
                'services': self._migrate_services()
            },
            'secrets': self.blueprint.get('secrets', {})
        }

        return topology

    def _migrate_network(self) -> Dict:
        """Migrate network configuration"""
        network = self.blueprint.get('infrastructure', {}).get('network', {})

        return {
            'name': network.get('name', 'llm'),
            'subnet': network.get('subnet', '10.89.0.0/24'),
            'gateway': network.get('gateway', '10.89.0.1')
        }

    def _migrate_services(self) -> Dict:
        """Migrate all services"""
        services = {}
        blueprint_services = self.blueprint.get('infrastructure', {}).get('services', {})

        for service_name, service in blueprint_services.items():
            migrated = self._migrate_service(service_name, service)
            if migrated:
                services[service_name] = migrated

        return services

    def _migrate_service(self, service_name: str, service: Dict) -> Optional[Dict]:
        """Migrate a single service to dual-layer format"""

        # Build infrastructure layer
        infrastructure = {
            'image': service.get('image', ''),
            'container_name': service.get('container_name', service_name),
            'port': service.get('port', 8080),
            'network': 'llm.network',
            'description': service.get('description', f'{service_name} service')
        }

        # Optional infrastructure fields
        if 'hostname' in service:
            infrastructure['hostname'] = service['hostname']

        if service.get('published_port') is not None:
            infrastructure['published_port'] = service['published_port']
        else:
            infrastructure['published_port'] = None

        if 'bind' in service:
            infrastructure['bind'] = service['bind']

        if service.get('requires'):
            infrastructure['requires'] = service['requires']
        else:
            infrastructure['requires'] = []

        if service.get('enabled', False):
            infrastructure['enabled'] = True
        else:
            infrastructure['enabled'] = False

        if service.get('enabled_by'):
            infrastructure['enabled_by'] = service['enabled_by']

        if service.get('websocket'):
            infrastructure['websocket'] = service['websocket']

        if service.get('external_subdomain'):
            infrastructure['external_subdomain'] = service['external_subdomain']

        # Volumes
        volumes = []
        if service.get('volume'):
            volumes.append({
                'name': service['volume'],
                'mount_path': self._get_default_mount_path(service_name),
                'selinux_label': 'Z'
            })

        if service.get('models_volume'):
            volumes.append({
                'name': service['models_volume'],
                'mount_path': f"{service.get('workspace', '/workspace')}/models",
                'selinux_label': 'Z'
            })

        if volumes:
            infrastructure['volumes'] = volumes

        # Healthcheck
        healthcheck = self._generate_healthcheck(service_name, service)
        if healthcheck:
            infrastructure['healthcheck'] = healthcheck

        # Build configuration layer
        configuration = self._migrate_service_configuration(service_name, service)

        return {
            'infrastructure': infrastructure,
            'configuration': configuration
        }

    def _get_default_mount_path(self, service_name: str) -> str:
        """Get default mount path for service volumes"""
        if 'postgres' in service_name:
            return '/var/lib/postgresql/data'
        elif 'redis' in service_name:
            return '/data'
        elif service_name == 'qdrant':
            return '/qdrant/storage'
        elif service_name == 'searxng':
            return '/etc/searxng'
        elif service_name == 'jupyter':
            return '/home/jovyan'
        elif service_name == 'comfyui':
            return '/workspace'
        else:
            return '/data'

    def _generate_healthcheck(self, service_name: str, service: Dict) -> Optional[Dict]:
        """Generate healthcheck configuration"""
        port = service.get('port', 8080)

        # Service-specific healthchecks
        if 'postgres' in service_name:
            db_user = service.get('db_user', 'postgres')
            return {
                'cmd': f'pg_isready -U {db_user}',
                'interval': '10s',
                'timeout': '5s',
                'retries': 5,
                'start_period': '10s'
            }
        elif 'redis' in service_name:
            return {
                'cmd': 'redis-cli ping || exit 1',
                'interval': '10s',
                'timeout': '5s',
                'retries': 5,
                'start_period': '5s'
            }
        elif service_name in ['litellm', 'openwebui']:
            return {
                'cmd': f'curl -f http://localhost:{port}/health || exit 1',
                'interval': '30s',
                'timeout': '5s',
                'retries': 3,
                'start_period': '30s'
            }
        elif service_name == 'searxng':
            return {
                'cmd': f'curl -f http://localhost:{port}/healthz || exit 1',
                'interval': '30s',
                'timeout': '5s',
                'retries': 3,
                'start_period': '10s'
            }
        elif service_name == 'qdrant':
            return {
                'cmd': f'curl -f http://localhost:{port}/health || exit 1',
                'interval': '30s',
                'timeout': '5s',
                'retries': 3,
                'start_period': '10s'
            }
        else:
            # Generic HTTP healthcheck
            return {
                'cmd': f'curl -f http://localhost:{port}/ || exit 1',
                'interval': '30s',
                'timeout': '5s',
                'retries': 3,
                'start_period': '10s'
            }

    def _migrate_service_configuration(self, service_name: str, service: Dict) -> Dict:
        """Migrate service configuration to schema format"""

        # Look for service-specific config in blueprint
        service_config = None

        # Check for service name in blueprint root
        if service_name in self.blueprint:
            service_config = self.blueprint[service_name]
        # Check for base service name (e.g., 'openwebui' for 'openwebui_postgres')
        elif '_' in service_name:
            base_name = service_name.split('_')[0]
            if base_name in self.blueprint:
                service_config = self.blueprint[base_name]

        # Build configuration properties
        properties = {}

        # Service-specific migrations
        if service_name == 'litellm':
            properties.update(self._migrate_litellm_config())
        elif service_name == 'openwebui':
            properties.update(self._migrate_openwebui_config())
        elif service_name == 'comfyui':
            properties.update(self._migrate_comfyui_config())
        elif service_name == 'searxng':
            properties.update(self._migrate_searxng_config())
        elif 'postgres' in service_name:
            properties.update(self._migrate_postgres_config(service))

        # Return configuration object
        return {
            'type': 'object',
            'properties': properties
        }

    def _migrate_litellm_config(self) -> Dict:
        """Migrate LiteLLM configuration"""
        litellm = self.blueprint.get('litellm', {})

        properties = {
            'LITELLM_MASTER_KEY': {
                'type': 'string',
                'description': 'Master authentication key for LiteLLM proxy',
                'default': litellm.get('master_key', 'sk-litellm-local'),
                'x-env-var': 'LITELLM_MASTER_KEY',
                'x-category': 'Security',
                'x-display-order': 1,
                'x-visibility': 'exposed',
                'x-sensitive': True,
                'x-secret-ref': 'secrets.api_keys.litellm_master',
                'x-template-path': 'litellm.master_key'
            },
            'DATABASE_URL': {
                'type': 'string',
                'description': 'PostgreSQL connection for LiteLLM state',
                'default': litellm.get('database_url', 'postgresql://litellm@litellm-postgres:5432/litellm'),
                'x-env-var': 'DATABASE_URL',
                'x-category': 'Advanced',
                'x-visibility': 'expert',
                'x-template-path': 'litellm.database_url',
                'x-requires-field': 'litellm_postgres.infrastructure.container_name'
            },
            'REDIS_URL': {
                'type': 'string',
                'description': 'Redis cache for rate limiting and caching',
                'default': litellm.get('redis_url', 'redis://litellm-redis:6379/0'),
                'x-env-var': 'REDIS_URL',
                'x-category': 'Advanced',
                'x-visibility': 'expert',
                'x-template-path': 'litellm.redis_url',
                'x-requires-field': 'litellm_redis.infrastructure.container_name'
            },
            'DROP_PARAMS': {
                'type': 'boolean',
                'description': 'Drop unsupported parameters instead of erroring',
                'default': litellm.get('drop_params', True),
                'x-env-var': 'DROP_PARAMS',
                'x-category': 'Advanced',
                'x-display-order': 4,
                'x-visibility': 'advanced',
                'x-template-path': 'litellm.drop_params',
                'x-rationale': 'Improves compatibility with different model providers'
            }
        }

        return properties

    def _migrate_openwebui_config(self) -> Dict:
        """Migrate OpenWebUI configuration"""
        openwebui = self.blueprint.get('openwebui', {})
        general = openwebui.get('general', {})
        features = openwebui.get('features', {})
        providers = openwebui.get('providers', {})

        properties = {
            'WEBUI_NAME': {
                'type': 'string',
                'description': 'Main WebUI display name',
                'default': general.get('webui_name', 'Open WebUI'),
                'x-env-var': 'WEBUI_NAME',
                'x-category': 'General',
                'x-display-order': 1,
                'x-visibility': 'exposed',
                'x-template-path': 'openwebui.general.webui_name'
            },
            'WEBUI_AUTH': {
                'type': 'boolean',
                'description': 'Enable user authentication',
                'default': general.get('webui_auth', False),
                'x-env-var': 'WEBUI_AUTH',
                'x-category': 'Security',
                'x-display-order': 1,
                'x-visibility': 'exposed',
                'x-template-path': 'openwebui.general.webui_auth'
            },
            'ENABLE_WEB_SEARCH': {
                'type': 'boolean',
                'description': 'Enable web search functionality',
                'default': features.get('web_search', False),
                'x-env-var': 'ENABLE_WEB_SEARCH',
                'x-category': 'Features',
                'x-display-order': 1,
                'x-visibility': 'exposed',
                'x-template-path': 'openwebui.features.web_search',
                'x-enables-services': ['searxng', 'searxng_redis'],
                'x-provider-fields': ['WEB_SEARCH_ENGINE']
            },
            'WEB_SEARCH_ENGINE': {
                'type': 'string',
                'description': 'Web search provider',
                'enum': ['searxng', 'tavily', 'brave'],
                'default': providers.get('web_search_engine', 'searxng'),
                'x-env-var': 'WEB_SEARCH_ENGINE',
                'x-category': 'Providers',
                'x-display-order': 1,
                'x-visibility': 'exposed',
                'x-depends-on': {'ENABLE_WEB_SEARCH': True},
                'x-template-path': 'openwebui.providers.web_search_engine',
                'x-affects-services': {
                    'searxng': 'searxng',
                    'tavily': None,
                    'brave': None
                }
            },
            'ENABLE_IMAGE_GENERATION': {
                'type': 'boolean',
                'description': 'Enable image generation capability',
                'default': features.get('image_generation', False),
                'x-env-var': 'ENABLE_IMAGE_GENERATION',
                'x-category': 'Features',
                'x-display-order': 2,
                'x-visibility': 'exposed',
                'x-template-path': 'openwebui.features.image_generation',
                'x-enables-services': ['comfyui'],
                'x-provider-fields': ['IMAGE_GENERATION_ENGINE']
            },
            'IMAGE_GENERATION_ENGINE': {
                'type': 'string',
                'description': 'Image generation backend',
                'enum': ['comfyui', 'automatic1111', 'openai'],
                'default': providers.get('image_engine', 'comfyui'),
                'x-env-var': 'IMAGE_GENERATION_ENGINE',
                'x-category': 'Providers',
                'x-display-order': 3,
                'x-visibility': 'exposed',
                'x-depends-on': {'ENABLE_IMAGE_GENERATION': True},
                'x-template-path': 'openwebui.providers.image_engine',
                'x-affects-services': {
                    'comfyui': 'comfyui',
                    'automatic1111': None,
                    'openai': None
                }
            },
            'VECTOR_DB': {
                'type': 'string',
                'description': 'Vector database for RAG embeddings',
                'enum': ['pgvector', 'qdrant', 'chromadb', 'milvus'],
                'default': providers.get('vector_db', 'pgvector'),
                'x-env-var': 'VECTOR_DB',
                'x-category': 'Providers',
                'x-display-order': 4,
                'x-visibility': 'exposed',
                'x-template-path': 'openwebui.providers.vector_db',
                'x-affects-services': {
                    'pgvector': None,
                    'qdrant': 'qdrant',
                    'chromadb': None,
                    'milvus': None
                }
            },
            'DATABASE_URL': {
                'type': 'string',
                'description': 'PostgreSQL database connection string',
                'default': general.get('database_url', 'postgresql://openwebui@openwebui-postgres:5432/openwebui'),
                'x-env-var': 'DATABASE_URL',
                'x-category': 'Advanced',
                'x-display-order': 1,
                'x-visibility': 'expert',
                'x-template-path': 'openwebui.general.database_url',
                'x-requires-field': 'openwebui_postgres.infrastructure.container_name'
            },
            'OPENAI_API_BASE_URL': {
                'type': 'string',
                'description': 'LiteLLM proxy endpoint',
                'default': general.get('openai_api_base_url', 'http://litellm:4000/v1'),
                'x-env-var': 'OPENAI_API_BASE_URL',
                'x-category': 'Advanced',
                'x-display-order': 3,
                'x-visibility': 'expert',
                'x-template-path': 'openwebui.general.openai_api_base_url',
                'x-requires-field': 'litellm.infrastructure.container_name'
            },
            'OPENAI_API_KEY': {
                'type': 'string',
                'description': 'LiteLLM authentication key',
                'default': general.get('openai_api_key', 'sk-litellm-local'),
                'x-env-var': 'OPENAI_API_KEY',
                'x-category': 'Security',
                'x-display-order': 2,
                'x-visibility': 'hidden',
                'x-sensitive': True,
                'x-secret-ref': 'secrets.api_keys.litellm_master',
                'x-template-path': 'openwebui.general.openai_api_key',
                'x-requires-field': 'litellm.configuration.LITELLM_MASTER_KEY'
            }
        }

        return properties

    def _migrate_comfyui_config(self) -> Dict:
        """Migrate ComfyUI configuration"""
        comfyui = self.blueprint.get('comfyui', {})

        properties = {
            'WEB_ENABLE_AUTH': {
                'type': 'boolean',
                'description': 'Enable web authentication for ComfyUI',
                'default': comfyui.get('web_enable_auth', False),
                'x-env-var': 'WEB_ENABLE_AUTH',
                'x-category': 'Security',
                'x-visibility': 'exposed',
                'x-template-path': 'comfyui.web_enable_auth'
            },
            'AUTO_UPDATE': {
                'type': 'boolean',
                'description': 'Auto-update ComfyUI on container start',
                'default': comfyui.get('auto_update', False),
                'x-env-var': 'AUTO_UPDATE',
                'x-category': 'Advanced',
                'x-visibility': 'advanced',
                'x-template-path': 'comfyui.auto_update'
            }
        }

        return properties

    def _migrate_searxng_config(self) -> Dict:
        """Migrate SearXNG configuration"""
        searxng = self.blueprint.get('searxng', {})

        properties = {
            'SEARXNG_BASE_URL': {
                'type': 'string',
                'description': 'External base URL for SearXNG',
                'default': searxng.get('base_url', 'https://search.blueprint.tail8dd1.ts.net'),
                'x-env-var': 'SEARXNG_BASE_URL',
                'x-category': 'General',
                'x-visibility': 'exposed',
                'x-template-path': 'searxng.base_url'
            },
            'SEARXNG_REDIS_URL': {
                'type': 'string',
                'description': 'Redis connection for rate limiting',
                'default': searxng.get('redis_url', 'redis://searxng-redis:6379/0'),
                'x-env-var': 'SEARXNG_REDIS_URL',
                'x-category': 'Advanced',
                'x-visibility': 'expert',
                'x-template-path': 'searxng.redis_url',
                'x-requires-field': 'searxng_redis.infrastructure.container_name'
            }
        }

        return properties

    def _migrate_postgres_config(self, service: Dict) -> Dict:
        """Migrate PostgreSQL configuration"""
        db_user = service.get('db_user', 'postgres')
        db_name = service.get('db_name', 'postgres')

        properties = {
            'POSTGRES_USER': {
                'type': 'string',
                'description': 'Database user',
                'default': db_user,
                'x-env-var': 'POSTGRES_USER',
                'x-category': 'Advanced',
                'x-visibility': 'expert'
            },
            'POSTGRES_DB': {
                'type': 'string',
                'description': 'Database name',
                'default': db_name,
                'x-env-var': 'POSTGRES_DB',
                'x-category': 'Advanced',
                'x-visibility': 'expert'
            }
        }

        return properties


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Migrate blueprint-config.json to topology.json",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s blueprint-config.json topology.json
  %(prog)s blueprint-config.json --output migrated-topology.json
        """
    )

    parser.add_argument(
        'blueprint',
        help='Path to blueprint-config.json'
    )

    parser.add_argument(
        'output',
        nargs='?',
        default='topology.json',
        help='Output path for topology.json (default: topology.json)'
    )

    args = parser.parse_args()

    # Load blueprint
    try:
        with open(args.blueprint, 'r') as f:
            blueprint = json.load(f)
    except FileNotFoundError:
        print(f"Error: Blueprint file not found: {args.blueprint}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON: {e}")
        sys.exit(1)

    # Migrate
    print(f"Migrating {args.blueprint} to {args.output}...")
    migrator = BlueprintMigrator(blueprint)
    topology = migrator.migrate()

    # Write output
    with open(args.output, 'w') as f:
        json.dump(topology, f, indent=2)

    print(f"✅ Migration complete!")
    print(f"   Services: {len(topology['topology']['services'])}")
    print(f"   Output: {args.output}")


if __name__ == '__main__':
    main()
