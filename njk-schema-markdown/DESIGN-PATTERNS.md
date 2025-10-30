# Design Patterns for Multi-Service Topology Schema

## Core Principles

### 1. **Colocate Infrastructure and Configuration**

✅ **DO**: Keep service deployment and runtime config together

```json
{
  "myservice": {
    "infrastructure": { /* deployment */ },
    "configuration": { /* runtime */ }
  }
}
```

❌ **DON'T**: Separate into different files

```json
// services.json
{"myservice": {"image": "..."}}

// config.json
{"myservice": {"ENV_VAR": "..."}}
```

**Why**: Single source of truth, easier to reason about dependencies

---

### 2. **Use Provider Fields for Dynamic Configuration**

✅ **DO**: Link provider selection to field visibility

```json
{
  "VECTOR_DB": {
    "enum": ["pgvector", "qdrant", "chromadb"],
    "x-provider-fields": {
      "qdrant": ["QDRANT_URL", "QDRANT_API_KEY"],
      "chromadb": ["CHROMA_HTTP_HOST", "CHROMA_HTTP_PORT"]
    }
  }
}
```

❌ **DON'T**: Show all provider fields simultaneously

```json
{
  "QDRANT_URL": {"type": "string"},
  "CHROMA_HTTP_HOST": {"type": "string"},
  "MILVUS_URI": {"type": "string"}
}
```

**Why**: Reduces cognitive load, prevents invalid configurations

---

### 3. **Explicit Over Implicit**

✅ **DO**: Declare all dependencies explicitly

```json
{
  "infrastructure": {
    "requires": ["myservice_postgres", "myservice_redis"],
    "enabled_by": ["openwebui.configuration.ENABLE_FEATURE == true"]
  }
}
```

❌ **DON'T**: Rely on implicit dependencies

```json
{
  "infrastructure": {
    // Assumes postgres is running...
  }
}
```

**Why**: Enables validation, prevents runtime failures

---

## Pattern Catalog

### Pattern 1: Feature Flag with Service Cascade

**Use Case**: Enabling a feature should automatically start required services

```json
{
  "openwebui": {
    "configuration": {
      "properties": {
        "ENABLE_WEB_SEARCH": {
          "type": "boolean",
          "default": false,
          "x-enables-services": ["searxng", "searxng_redis"],
          "x-provider-fields": ["WEB_SEARCH_ENGINE"]
        },
        "WEB_SEARCH_ENGINE": {
          "type": "string",
          "enum": ["searxng", "tavily", "brave"],
          "x-depends-on": {"ENABLE_WEB_SEARCH": true},
          "x-affects-services": {
            "searxng": "searxng",
            "tavily": null,
            "brave": null
          }
        }
      }
    }
  },
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

**Flow**:
1. User enables `ENABLE_WEB_SEARCH`
2. Field `WEB_SEARCH_ENGINE` becomes visible
3. If set to `"searxng"`, services `searxng` and `searxng_redis` start
4. Validation ensures redis starts before searxng

---

### Pattern 2: Database Per Service

**Use Case**: Each main service gets dedicated PostgreSQL/Redis instances

```json
{
  "litellm": {
    "infrastructure": {
      "requires": ["litellm_postgres", "litellm_redis"]
    },
    "configuration": {
      "properties": {
        "DATABASE_URL": {
          "type": "string",
          "default": "postgresql://litellm@litellm-postgres:5432/litellm",
          "x-requires-field": "litellm_postgres.infrastructure.container_name"
        },
        "REDIS_URL": {
          "type": "string",
          "default": "redis://litellm-redis:6379/0",
          "x-requires-field": "litellm_redis.infrastructure.container_name"
        }
      }
    }
  },
  "litellm_postgres": {
    "infrastructure": {
      "image": "docker.io/postgres:16",
      "container_name": "litellm-postgres",
      "port": 5432,
      "published_port": null  // Internal only
    }
  },
  "litellm_redis": {
    "infrastructure": {
      "image": "docker.io/redis:7.2-alpine",
      "container_name": "litellm-redis",
      "port": 6379,
      "published_port": null
    }
  }
}
```

**Benefits**:
- Service isolation
- Independent scaling
- No port conflicts
- Clear naming (`litellm-postgres` vs `openwebui-postgres`)

---

### Pattern 3: Secret Reference Pattern

**Use Case**: Sensitive configuration should reference encrypted storage

```json
{
  "configuration": {
    "properties": {
      "LITELLM_MASTER_KEY": {
        "type": "string",
        "x-sensitive": true,
        "x-secret-ref": "secrets.api_keys.litellm_master",
        "x-template-path": "litellm.master_key"
      }
    }
  }
}
```

```json
{
  "secrets": {
    "api_keys": {
      "litellm_master": "${LITELLM_MASTER_KEY}"  // From env or encrypted storage
    }
  }
}
```

**Implementation**:
- Generator reads from `secrets.api_keys.litellm_master`
- Value injected as environment variable
- UI masks field input
- Chezmoi encrypts value in `.chezmoi.yaml.tmpl`

---

### Pattern 4: Cross-Service Configuration Sync

**Use Case**: Field value must match another service's configuration

```json
{
  "openwebui": {
    "configuration": {
      "properties": {
        "OPENAI_API_KEY": {
          "type": "string",
          "x-requires-field": "litellm.configuration.LITELLM_MASTER_KEY",
          "x-rationale": "Must match LiteLLM's master key for authentication"
        }
      }
    }
  },
  "litellm": {
    "configuration": {
      "properties": {
        "LITELLM_MASTER_KEY": {
          "type": "string",
          "x-secret-ref": "secrets.api_keys.litellm_master"
        }
      }
    }
  }
}
```

**Validation**:
- Ensures both fields reference the same secret
- Warns if values diverge
- Auto-sync when source changes

---

### Pattern 5: Conditional Auxiliary Service

**Use Case**: Service is only needed when specific provider is selected

```json
{
  "openwebui": {
    "configuration": {
      "properties": {
        "CONTENT_EXTRACTION": {
          "type": "string",
          "enum": ["tika", "unstructured", "none"],
          "x-affects-services": {
            "tika": "tika",
            "unstructured": "unstructured",
            "none": null
          }
        }
      }
    }
  },
  "tika": {
    "infrastructure": {
      "image": "docker.io/apache/tika:latest-full",
      "enabled_by": ["openwebui.configuration.CONTENT_EXTRACTION == 'tika'"],
      "port": 9998,
      "published_port": null
    }
  }
}
```

**Benefits**:
- Resource efficiency (only run what's needed)
- Clear dependency relationship
- Automatic lifecycle management

---

### Pattern 6: Multi-Condition Enablement (Logical OR)

**Use Case**: Service starts if ANY condition is true

```json
{
  "qdrant": {
    "infrastructure": {
      "enabled_by": [
        "openwebui.configuration.VECTOR_DB == 'qdrant'",
        "litellm.configuration.CACHE_TYPE == 'qdrant'",
        "myapp.configuration.ENABLE_QDRANT == true"
      ]
    }
  }
}
```

**Semantics**: `enabled_by` is a logical **OR** (any condition triggers enablement)

---

### Pattern 7: Configuration Categories with Display Order

**Use Case**: Organize 100+ config vars into logical groups

```json
{
  "configuration": {
    "properties": {
      "WEBUI_NAME": {
        "x-category": "General",
        "x-display-order": 1
      },
      "WEBUI_AUTH": {
        "x-category": "Security",
        "x-display-order": 1
      },
      "LOG_LEVEL": {
        "x-category": "Advanced",
        "x-display-order": 10,
        "x-visibility": "advanced"
      },
      "INTERNAL_DEBUG_MODE": {
        "x-category": "Expert",
        "x-display-order": 99,
        "x-visibility": "expert"
      }
    }
  }
}
```

**UI Rendering**:
```
[General]
  1. WEBUI_NAME
  2. ...

[Security]
  1. WEBUI_AUTH
  2. ...

[Advanced] (collapsed by default)
  10. LOG_LEVEL
  ...

[Expert] (hidden unless "Show expert settings" enabled)
  99. INTERNAL_DEBUG_MODE
```

---

### Pattern 8: Provider-Specific Subfields

**Use Case**: Different providers require different configuration

```json
{
  "STT_ENGINE": {
    "enum": ["openai", "whisper", "deepgram"],
    "x-provider-fields": {
      "openai": ["OPENAI_API_KEY", "STT_OPENAI_MODEL"],
      "whisper": ["WHISPER_MODEL_SIZE", "WHISPER_DEVICE"],
      "deepgram": ["DEEPGRAM_API_KEY", "DEEPGRAM_MODEL"]
    }
  },
  "WHISPER_MODEL_SIZE": {
    "type": "string",
    "enum": ["tiny", "base", "small", "medium", "large"],
    "x-depends-on": {"STT_ENGINE": "whisper"},
    "x-visibility": "exposed"
  },
  "DEEPGRAM_API_KEY": {
    "type": "string",
    "x-depends-on": {"STT_ENGINE": "deepgram"},
    "x-sensitive": true,
    "x-secret-ref": "secrets.audio_providers.deepgram"
  }
}
```

**Flow**:
1. User selects `STT_ENGINE = "whisper"`
2. `WHISPER_MODEL_SIZE` and `WHISPER_DEVICE` become visible
3. Other provider fields remain hidden
4. Validation ensures whisper-specific fields are populated

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Shared Auxiliary Services

**DON'T**:
```json
{
  "postgres": {
    "infrastructure": {
      "enabled": true  // Shared by all services
    }
  }
}
```

**WHY**: Port conflicts, coupling, no isolation

**DO**:
```json
{
  "litellm_postgres": { /* dedicated */ },
  "openwebui_postgres": { /* dedicated */ }
}
```

---

### ❌ Anti-Pattern 2: Hardcoded Values

**DON'T**:
```json
{
  "DATABASE_URL": {
    "type": "string",
    "default": "postgresql://user@localhost:5432/db"  // HARDCODED
  }
}
```

**DO**:
```json
{
  "DATABASE_URL": {
    "type": "string",
    "default": "postgresql://litellm@litellm-postgres:5432/litellm",
    "x-requires-field": "litellm_postgres.infrastructure.container_name",
    "x-template-path": "litellm.database_url"
  }
}
```

---

### ❌ Anti-Pattern 3: Missing Dependencies

**DON'T**:
```json
{
  "openwebui": {
    "infrastructure": {
      "enabled": true
      // Missing: requires postgres and redis
    }
  }
}
```

**DO**:
```json
{
  "openwebui": {
    "infrastructure": {
      "enabled": true,
      "requires": ["openwebui_postgres", "openwebui_redis", "litellm"]
    }
  }
}
```

---

### ❌ Anti-Pattern 4: Publishing Internal Ports

**DON'T**:
```json
{
  "myservice_postgres": {
    "infrastructure": {
      "port": 5432,
      "published_port": 5432  // Exposed to host unnecessarily
    }
  }
}
```

**DO**:
```json
{
  "myservice_postgres": {
    "infrastructure": {
      "port": 5432,
      "published_port": null  // Internal-only
    }
  }
}
```

**WHY**: Security, port conflicts, complexity

---

## Best Practices

### 1. **Always Provide Rationale**

```json
{
  "DROP_PARAMS": {
    "type": "boolean",
    "default": true,
    "x-rationale": "Improves compatibility with different model providers by silently dropping unsupported parameters instead of erroring"
  }
}
```

### 2. **Use Semantic Naming**

✅ Good:
- `openwebui_postgres` (clear ownership)
- `litellm_redis` (dedicated instance)

❌ Bad:
- `postgres1` (unclear purpose)
- `redis` (which service?)

### 3. **Mark Sensitive Fields**

```json
{
  "API_KEY": {
    "type": "string",
    "x-sensitive": true,
    "x-secret-ref": "secrets.api_keys.provider",
    "x-visibility": "exposed"  // Show field, but mask input
  }
}
```

### 4. **Validate Early, Fail Fast**

Run validation **before** generating quadlets:
1. Field-level (types, enums)
2. Service-level (dependencies, ports)
3. Topology-level (circular deps, field refs)

### 5. **Version Your Schema**

```json
{
  "schema_version": "2.0.0",
  "release": {
    "version": "v1.0.0",
    "template_sha": "abc123"
  }
}
```

Track breaking changes:
- `2.0.0` → `2.1.0`: Add field (backward compatible)
- `2.1.0` → `3.0.0`: Remove field (breaking change)

### 6. **Document Default Handling**

```json
{
  "FIELD": {
    "default": "value",
    "x-default-handling": "preloaded",  // or "unset", "user-configured"
    "x-rationale": "Preloaded from verified defaults, override only if needed"
  }
}
```

**States**:
- `preloaded`: Default is known-good, user hasn't changed
- `unset`: No default, user must configure
- `user-configured`: User has overridden default

---

## Summary

### Key Takeaways

1. **Dual-layer architecture** (infrastructure + configuration) = single source of truth
2. **Provider fields** reveal configuration dynamically
3. **Feature flags** cascade to enable/disable services
4. **Cross-service references** (`x-requires-field`) ensure consistency
5. **Validation** prevents invalid configurations before deployment

### Pattern Selection Guide

| Scenario | Pattern |
|----------|---------|
| Feature toggles service | Feature Flag Cascade (#1) |
| Service needs database | Database Per Service (#2) |
| API keys, passwords | Secret Reference (#3) |
| Sync between services | Cross-Service Sync (#4) |
| Optional provider | Conditional Auxiliary (#5) |
| Multiple enablement triggers | Multi-Condition OR (#6) |
| 100+ config vars | Categories + Display Order (#7) |
| Provider-specific config | Provider Subfields (#8) |

### Next Steps

1. ✅ Define schema with these patterns
2. ✅ Validate topology
3. ⏭️ Generate quadlets
4. ⏭️ Build UI
5. ⏭️ Manage state
