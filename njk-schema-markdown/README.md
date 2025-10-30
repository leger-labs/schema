# Multi-Service Topology Schema v2.0

## Overview

This schema system provides a **dual-layer architecture** for defining container-based service topologies that combines:

1. **Infrastructure Layer**: Deployment concerns (containers, networking, dependencies)
2. **Configuration Layer**: Runtime concerns (environment variables, feature flags, provider selection)

The schema enables **declarative service management** where:
- Selecting a provider automatically enables related services
- Feature flags cascade to enable/disable infrastructure
- Cross-service dependencies are validated before deployment
- Configuration changes trigger appropriate service lifecycle events

## Key Concepts

### Dual-Layer Architecture

Every service definition contains two sections:

```json
{
  "service_name": {
    "infrastructure": {
      "image": "...",
      "port": 8080,
      "requires": ["dependency1", "dependency2"],
      "enabled_by": ["condition1", "condition2"]
    },
    "configuration": {
      "type": "object",
      "properties": {
        "FIELD_NAME": {
          "type": "string",
          "x-env-var": "FIELD_NAME",
          "x-category": "General"
        }
      }
    }
  }
}
```

**Infrastructure** handles:
- Container image and networking
- Service dependencies (`requires`)
- Conditional enablement (`enabled_by`)
- Volumes and health checks

**Configuration** handles:
- Environment variables
- Feature flags and provider selection
- Field visibility and validation
- Secret references

### Provider-Driven Architecture

The most powerful pattern is **provider-driven service enablement**:

```json
{
  "VECTOR_DB": {
    "type": "string",
    "enum": ["pgvector", "qdrant", "chromadb"],
    "x-affects-services": {
      "pgvector": null,        // Uses existing postgres
      "qdrant": "qdrant",      // Enables qdrant service
      "chromadb": "chromadb"   // Enables chromadb service
    },
    "x-provider-fields": {
      "qdrant": ["QDRANT_URL", "QDRANT_API_KEY"],
      "chromadb": ["CHROMA_HTTP_HOST"]
    }
  }
}
```

When `VECTOR_DB` is set to `"qdrant"`:
1. The `qdrant` service is automatically enabled
2. Fields `QDRANT_URL` and `QDRANT_API_KEY` become visible
3. Service dependencies are validated

### Feature Flag Cascades

Boolean features create dependency trees:

```json
{
  "ENABLE_WEB_SEARCH": {
    "type": "boolean",
    "x-enables-services": ["searxng", "searxng_redis"],
    "x-provider-fields": ["WEB_SEARCH_ENGINE"]
  }
}
```

This creates:
```
ENABLE_WEB_SEARCH = true
  ↓
  Reveals: WEB_SEARCH_ENGINE field
  Enables: searxng + searxng_redis services (if engine = "searxng")
```

### Cross-Service Field References

Fields can reference other services' configuration:

```json
{
  "OPENAI_API_BASE_URL": {
    "type": "string",
    "default": "http://litellm:4000/v1",
    "x-requires-field": "litellm.infrastructure.container_name",
    "x-rationale": "Auto-generated from LiteLLM service configuration"
  }
}
```

This ensures:
- The referenced field exists
- The value is synchronized from the source
- Changes propagate correctly

## Metadata Extensions (x-*)

### UI Generation

```json
{
  "x-category": "Features",           // Group in UI
  "x-display-order": 1,               // Sort order within category
  "x-visibility": "exposed",          // exposed|advanced|expert|hidden
  "x-depends-on": {                   // Show only when condition met
    "ENABLE_WEB_SEARCH": true
  }
}
```

### Validation

```json
{
  "x-provider-fields": {              // Fields for each provider
    "searxng": ["SEARXNG_QUERY_URL"],
    "tavily": ["TAVILY_API_KEY"]
  },
  "x-requires-field": "other.service.field",  // Cross-service dependency
  "x-sensitive": true                 // Mask in UI, encrypt in storage
}
```

### Service Enablement

```json
{
  "x-enables-services": ["searxng", "searxng_redis"],
  "x-affects-services": {
    "choice_a": "service_a",
    "choice_b": null                  // null = no service change
  }
}
```

### Documentation

```json
{
  "x-rationale": "Why this field exists and when to change it",
  "x-default-handling": "preloaded",  // preloaded|unset|user-configured
  "x-template-path": "path.in.chezmoi.yaml"
}
```

### Secret Management

```json
{
  "x-sensitive": true,
  "x-secret-ref": "secrets.api_keys.litellm_master",
  "x-template-path": "litellm.master_key"
}
```

## Common Patterns

### Pattern 1: Database Service

```json
{
  "service_postgres": {
    "infrastructure": {
      "image": "docker.io/postgres:16",
      "container_name": "service-postgres",
      "port": 5432,
      "published_port": null,           // Internal only
      "network": "llm.network",
      "healthcheck": {
        "cmd": "pg_isready -U dbuser"
      }
    },
    "configuration": {
      "type": "object",
      "properties": {
        "POSTGRES_USER": {"type": "string", "default": "dbuser"},
        "POSTGRES_DB": {"type": "string", "default": "dbname"}
      }
    }
  }
}
```

### Pattern 2: Conditional Service Enablement

```json
{
  "searxng": {
    "infrastructure": {
      "enabled_by": [
        "openwebui.configuration.ENABLE_WEB_SEARCH == true",
        "openwebui.configuration.WEB_SEARCH_ENGINE == 'searxng'"
      ],
      "requires": ["searxng_redis"]
    }
  }
}
```

The service starts when **ANY** condition in `enabled_by` is true (logical OR).

### Pattern 3: Provider Selection with Auto-Enablement

```json
{
  "VECTOR_DB": {
    "type": "string",
    "enum": ["pgvector", "qdrant"],
    "x-affects-services": {
      "pgvector": null,
      "qdrant": "qdrant"
    },
    "x-provider-fields": {
      "qdrant": ["QDRANT_URL", "QDRANT_API_KEY"]
    }
  },
  "QDRANT_URL": {
    "type": "string",
    "x-depends-on": {"VECTOR_DB": "qdrant"},
    "x-requires-field": "qdrant.infrastructure.container_name"
  }
}
```

### Pattern 4: Secret References

```json
{
  "LITELLM_MASTER_KEY": {
    "type": "string",
    "x-sensitive": true,
    "x-secret-ref": "secrets.api_keys.litellm_master",
    "x-template-path": "litellm.master_key"
  }
}
```

Points to:
```json
{
  "secrets": {
    "api_keys": {
      "litellm_master": "sk-litellm-local"
    }
  }
}
```

### Pattern 5: Cross-Service Configuration Sync

```json
{
  "OPENAI_API_KEY": {
    "type": "string",
    "x-requires-field": "litellm.configuration.LITELLM_MASTER_KEY",
    "x-rationale": "Must match LiteLLM's master key for authentication"
  }
}
```

## Validation Levels

The schema supports **four validation levels**:

### 1. Field Level
- Type checking
- Pattern matching
- Enum validation
- Range validation

### 2. Service Level
- Required fields
- Dependency existence
- Port uniqueness
- Container name uniqueness

### 3. Topology Level
- No circular dependencies
- Valid enablement expressions
- Cross-service field references
- Provider field consistency

### 4. Runtime Level
- Dependency health checks
- Port availability
- Service state transitions

See `validation-rules.json` for complete specifications.

## Usage Examples

### Example 1: Adding a New Service

```json
{
  "myservice": {
    "infrastructure": {
      "image": "docker.io/myservice:latest",
      "container_name": "myservice",
      "port": 8080,
      "published_port": 8080,
      "network": "llm.network",
      "requires": ["myservice_postgres"],
      "enabled": true,
      "healthcheck": {
        "cmd": "curl -f http://localhost:8080/health || exit 1"
      }
    },
    "configuration": {
      "type": "object",
      "properties": {
        "DATABASE_URL": {
          "type": "string",
          "default": "postgresql://user@myservice-postgres:5432/db",
          "x-env-var": "DATABASE_URL",
          "x-requires-field": "myservice_postgres.infrastructure.container_name"
        }
      }
    }
  }
}
```

### Example 2: Feature Flag with Cascade

```json
{
  "openwebui": {
    "configuration": {
      "properties": {
        "ENABLE_SPEECH_TO_TEXT": {
          "type": "boolean",
          "x-enables-services": ["whisper"],
          "x-provider-fields": ["STT_ENGINE"]
        },
        "STT_ENGINE": {
          "type": "string",
          "enum": ["whisper", "deepgram"],
          "x-depends-on": {"ENABLE_SPEECH_TO_TEXT": true},
          "x-affects-services": {
            "whisper": "whisper",
            "deepgram": null
          }
        }
      }
    }
  }
}
```

### Example 3: Conditional Service

```json
{
  "tika": {
    "infrastructure": {
      "image": "docker.io/apache/tika:latest-full",
      "container_name": "tika",
      "port": 9998,
      "published_port": null,
      "enabled_by": ["openwebui.configuration.CONTENT_EXTRACTION == 'tika'"]
    }
  }
}
```

## Schema Files

This implementation includes:

1. **topology-schema.json**: JSON Schema definition for validation
2. **topology.json**: Example topology with OpenWebUI, LiteLLM, SearXNG, Qdrant, ComfyUI
3. **validation-rules.json**: Extended validation rules and algorithms
4. **README.md**: This documentation

## Migration from blueprint-config.json

The new schema **enriches** the existing `blueprint-config.json` with:

1. **Configuration metadata**: Each service gets a `configuration` section
2. **Cross-service relationships**: `x-requires-field`, `x-affects-services`
3. **UI hints**: `x-category`, `x-display-order`, `x-visibility`
4. **Validation rules**: `x-depends-on`, `x-provider-fields`
5. **Documentation**: `x-rationale`, `description`

The infrastructure section remains compatible:
- `infrastructure.services` → `topology.services.*.infrastructure`
- Field names and types preserved
- Adds conditional enablement (`enabled_by`)

## Next Steps

### Phase 1: Schema Definition ✅
- [x] Create topology-schema.json
- [x] Create example topology.json
- [x] Define validation rules

### Phase 2: Validation & Generation
- [ ] Build JSON Schema validator
- [ ] Implement topology-level validation (circular dependencies, field references)
- [ ] Generate Nunjucks templates from topology
- [ ] Generate UI forms from configuration metadata
- [ ] Generate documentation from descriptions

### Phase 3: State Management
- [ ] Track "configured vs default" state
- [ ] Enable diff-based updates
- [ ] Generate migration paths for version changes
- [ ] Implement conditional service lifecycle

### Phase 4: Integration
- [ ] Migrate blueprint-config.json to new schema
- [ ] Update Nunjucks templates to use new metadata
- [ ] Build UI for configuration management
- [ ] Implement secret encryption/storage

## Benefits

✅ **Single Source of Truth**: One schema generates quadlets, UI, docs
✅ **Type Safety**: Full validation at field, service, and topology levels
✅ **Automatic Service Management**: Feature flags → services
✅ **Provider Flexibility**: Easy to add new providers
✅ **Documentation**: Embedded rationale and descriptions
✅ **State Tracking**: Know what's configured vs default
✅ **Validation**: Catch errors before deployment

## Adoption Strategy

You can **gradually adopt** this schema:

1. **Start with metadata**: Add `x-*` fields to existing configs
2. **Add configuration layer**: Define environment variables with rich metadata
3. **Implement validation**: Start with field-level, progress to topology
4. **Build generators**: Create quadlets from schema
5. **Enable UI**: Generate configuration forms
6. **Manage state**: Track configuration changes over time

The schema is **backward compatible** with existing infrastructure definitions.
