# Migration from blueprint-config.json to Topology Schema v2.0

## Overview

This document compares the existing `blueprint-config.json` structure with the new multi-service topology schema and provides a migration path.

---

## Key Differences

### 1. Structure

**Before (blueprint-config.json)**:
```json
{
  "infrastructure": {
    "services": {
      "litellm": {
        "hostname": "litellm",
        "port": 4000,
        "image": "...",
        "requires": ["litellm_postgres"]
      }
    }
  },
  "litellm": {
    "database_url": "...",
    "master_key": "${LITELLM_MASTER_KEY}"
  }
}
```

**After (topology.json)**:
```json
{
  "topology": {
    "services": {
      "litellm": {
        "infrastructure": {
          "image": "...",
          "port": 4000,
          "requires": ["litellm_postgres"]
        },
        "configuration": {
          "type": "object",
          "properties": {
            "LITELLM_MASTER_KEY": {
              "type": "string",
              "x-env-var": "LITELLM_MASTER_KEY",
              "x-secret-ref": "secrets.api_keys.litellm_master"
            }
          }
        }
      }
    }
  }
}
```

**Changes**:
- ✅ Infrastructure and configuration colocated per service
- ✅ Configuration becomes a typed schema with validation
- ✅ Secret references formalized with `x-secret-ref`
- ✅ Environment variable mapping explicit with `x-env-var`

---

### 2. Conditional Service Enablement

**Before**:
```json
{
  "infrastructure": {
    "services": {
      "searxng": {
        "enabled_by": ["openwebui.providers.web_search_engine == 'searxng'"]
      }
    }
  }
}
```

**After**:
```json
{
  "searxng": {
    "infrastructure": {
      "enabled_by": [
        "openwebui.configuration.ENABLE_WEB_SEARCH == true",
        "openwebui.configuration.WEB_SEARCH_ENGINE == 'searxng'"
      ]
    }
  }
}
```

**Changes**:
- ✅ Explicit path: `service.configuration.FIELD`
- ✅ Multiple conditions (logical OR)
- ✅ Validated against actual configuration schema

---

### 3. Configuration Metadata

**Before**: No metadata, flat environment variables
```json
{
  "openwebui": {
    "features": {
      "web_search": true,
      "image_generation": false
    }
  }
}
```

**After**: Rich metadata for UI generation, validation, documentation
```json
{
  "ENABLE_WEB_SEARCH": {
    "type": "boolean",
    "description": "Enable web search functionality",
    "default": true,
    "x-env-var": "ENABLE_WEB_SEARCH",
    "x-category": "Features",
    "x-display-order": 1,
    "x-visibility": "exposed",
    "x-enables-services": ["searxng", "searxng_redis"],
    "x-provider-fields": ["WEB_SEARCH_ENGINE"],
    "x-rationale": "Allows AI to search the web for current information"
  }
}
```

**New Capabilities**:
- ✅ UI generation (categories, order, visibility)
- ✅ Service enablement tracking (`x-enables-services`)
- ✅ Provider field cascades (`x-provider-fields`)
- ✅ Documentation embedded (`x-rationale`)
- ✅ Validation rules (type, enum, depends-on)

---

### 4. Cross-Service Relationships

**Before**: Implicit, hard to validate
```json
{
  "openwebui": {
    "general": {
      "database_url": "postgresql://openwebui@openwebui-postgres:5432/openwebui"
    }
  }
}
```

**After**: Explicit with validation
```json
{
  "DATABASE_URL": {
    "type": "string",
    "default": "postgresql://openwebui@openwebui-postgres:5432/openwebui",
    "x-requires-field": "openwebui_postgres.infrastructure.container_name",
    "x-rationale": "Auto-generated from infrastructure configuration"
  }
}
```

**Benefits**:
- ✅ Validation ensures referenced service exists
- ✅ Changes to container name propagate automatically
- ✅ Clear dependency tracking

---

### 5. Secret Management

**Before**: Inline environment variable references
```json
{
  "litellm": {
    "master_key": "${LITELLM_MASTER_KEY}"
  }
}
```

**After**: Typed secret references
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

```json
{
  "secrets": {
    "api_keys": {
      "litellm_master": "${LITELLM_MASTER_KEY}"
    }
  }
}
```

**Benefits**:
- ✅ Centralized secret catalog
- ✅ UI knows to mask sensitive fields
- ✅ Validation ensures secret exists
- ✅ Encryption integration points clear

---

## Migration Strategy

### Phase 1: Preserve Infrastructure (Week 1)

**Goal**: Move existing infrastructure config to new structure without changes

**Steps**:
1. Create `topology.services.*.infrastructure` from `blueprint-config.infrastructure.services.*`
2. Preserve all existing fields: `image`, `port`, `requires`, `enabled_by`, etc.
3. Validate no regressions in generated quadlets

**Example Migration Script**:
```python
def migrate_infrastructure(blueprint):
    topology = {
        "schema_version": "2.0.0",
        "topology": {
            "network": blueprint["infrastructure"]["network"],
            "services": {}
        }
    }

    for service_name, service_data in blueprint["infrastructure"]["services"].items():
        topology["topology"]["services"][service_name] = {
            "infrastructure": service_data
        }

    return topology
```

### Phase 2: Add Configuration Schema (Week 2)

**Goal**: Convert flat config to typed schema with basic metadata

**Steps**:
1. For each top-level config key (e.g., `blueprint["litellm"]`), create `configuration.properties`
2. Add types: `string`, `boolean`, `integer`, `object`, `array`
3. Add `x-env-var` mappings
4. Set defaults from existing values

**Example**:
```python
def migrate_config_field(field_name, field_value):
    field_type = type(field_value).__name__
    if field_type == "bool":
        field_type = "boolean"
    elif field_type == "int":
        field_type = "integer"
    elif field_type == "dict":
        field_type = "object"
    elif field_type == "list":
        field_type = "array"

    return {
        "type": field_type,
        "default": field_value,
        "x-env-var": field_name.upper(),
        "description": f"TODO: Add description for {field_name}"
    }
```

### Phase 3: Enrich Metadata (Week 3-4)

**Goal**: Add UI, validation, and documentation metadata

**Steps**:
1. Add `x-category`, `x-display-order` for UI grouping
2. Add `x-visibility` (exposed, advanced, expert)
3. Add `x-depends-on` for conditional fields
4. Add `x-provider-fields` for provider cascades
5. Add `x-enables-services` for feature flags
6. Add `x-rationale` for documentation

**Manual Review Required**: This step requires domain knowledge

### Phase 4: Validate and Test (Week 5)

**Goal**: Ensure topology is valid and generates correct quadlets

**Steps**:
1. Run JSON Schema validation
2. Run topology-level validation (circular deps, field refs)
3. Generate quadlets and compare with existing ones
4. Test service enablement conditions
5. Validate secret references

### Phase 5: Deploy (Week 6)

**Goal**: Switch to topology-based generation

**Steps**:
1. Update Nunjucks templates to read from topology.json
2. Update CI/CD to use new validation
3. Deprecate blueprint-config.json
4. Update documentation

---

## Migration Checklist

### Infrastructure Migration

- [ ] Network configuration preserved
- [ ] All services migrated to `topology.services.*`
- [ ] `requires` dependencies intact
- [ ] `enabled_by` conditions updated to new path format
- [ ] Port configurations preserved
- [ ] Volume configurations preserved
- [ ] Health checks preserved
- [ ] Container names unchanged
- [ ] Generated quadlets match existing ones

### Configuration Migration

- [ ] All top-level config sections converted to `configuration.properties`
- [ ] Field types specified
- [ ] Defaults preserved
- [ ] `x-env-var` mappings added
- [ ] Descriptions added (can be TODO initially)

### Metadata Enrichment

- [ ] Fields grouped into categories
- [ ] Display order assigned
- [ ] Visibility levels set (exposed/advanced/expert/hidden)
- [ ] Sensitive fields marked with `x-sensitive`
- [ ] Secret references added (`x-secret-ref`)
- [ ] Provider fields identified (`x-provider-fields`)
- [ ] Service enablement tracked (`x-enables-services`, `x-affects-services`)
- [ ] Cross-service dependencies mapped (`x-requires-field`)
- [ ] Rationale documented (`x-rationale`)

### Validation

- [ ] JSON Schema validation passes
- [ ] No circular dependencies
- [ ] All `enabled_by` conditions reference valid fields
- [ ] All `x-requires-field` references exist
- [ ] All `x-secret-ref` references exist
- [ ] No port conflicts
- [ ] All required fields have defaults or are marked required
- [ ] Generated quadlets validated

### Testing

- [ ] Unit tests for validator
- [ ] Integration tests for generator
- [ ] Smoke tests for common configurations
- [ ] Edge cases tested (all services enabled, minimal config, etc.)

---

## Comparison: Before and After

### Example: OpenWebUI Service

**Before (blueprint-config.json)** - ~50 lines, split across file:
```json
{
  "infrastructure": {
    "services": {
      "openwebui": {
        "hostname": "openwebui",
        "container_name": "openwebui",
        "port": 8080,
        "published_port": 3000,
        "image": "ghcr.io/open-webui/open-webui:main",
        "requires": ["openwebui_postgres", "openwebui_redis", "litellm"],
        "enabled": true
      }
    }
  },
  "openwebui": {
    "features": {
      "web_search": true
    },
    "providers": {
      "web_search_engine": "searxng"
    },
    "general": {
      "webui_name": "Leger AI",
      "webui_auth": false
    }
  }
}
```

**After (topology.json)** - ~120 lines, colocated, rich metadata:
```json
{
  "openwebui": {
    "infrastructure": {
      "image": "ghcr.io/open-webui/open-webui:0.6.34",
      "container_name": "openwebui",
      "hostname": "openwebui",
      "port": 8080,
      "published_port": 3000,
      "network": "llm.network",
      "requires": ["openwebui_postgres", "openwebui_redis", "litellm"],
      "enabled": true,
      "websocket": true,
      "external_subdomain": "ai",
      "description": "Open WebUI Chat Interface",
      "volumes": [
        {
          "name": "openwebui.volume",
          "mount_path": "/app/backend/data",
          "selinux_label": "Z"
        }
      ],
      "healthcheck": {
        "cmd": "curl -f http://localhost:8080/health || exit 1",
        "interval": "30s",
        "timeout": "5s",
        "retries": 3,
        "start_period": "10s"
      }
    },
    "configuration": {
      "type": "object",
      "properties": {
        "WEBUI_NAME": {
          "type": "string",
          "description": "Main WebUI display name",
          "default": "Open WebUI",
          "x-env-var": "WEBUI_NAME",
          "x-category": "General",
          "x-display-order": 1,
          "x-visibility": "exposed",
          "x-template-path": "openwebui.general.webui_name",
          "x-rationale": "Sets the branding for the web interface"
        },
        "ENABLE_WEB_SEARCH": {
          "type": "boolean",
          "description": "Enable web search functionality",
          "default": true,
          "x-env-var": "ENABLE_WEB_SEARCH",
          "x-category": "Features",
          "x-display-order": 1,
          "x-visibility": "exposed",
          "x-template-path": "openwebui.features.web_search",
          "x-enables-services": ["searxng", "searxng_redis"],
          "x-provider-fields": ["WEB_SEARCH_ENGINE"],
          "x-rationale": "Allows AI to search the web for current information"
        },
        "WEB_SEARCH_ENGINE": {
          "type": "string",
          "description": "Web search provider",
          "enum": ["searxng", "tavily", "brave"],
          "default": "searxng",
          "x-env-var": "WEB_SEARCH_ENGINE",
          "x-category": "Providers",
          "x-display-order": 1,
          "x-visibility": "exposed",
          "x-depends-on": {
            "ENABLE_WEB_SEARCH": true
          },
          "x-template-path": "openwebui.providers.web_search_engine",
          "x-affects-services": {
            "searxng": "searxng",
            "tavily": null,
            "brave": null
          },
          "x-provider-fields": {
            "searxng": ["SEARXNG_QUERY_URL"],
            "tavily": ["TAVILY_API_KEY"],
            "brave": ["BRAVE_SEARCH_API_KEY"]
          }
        }
      },
      "required": ["WEBUI_NAME", "DATABASE_URL", "OPENAI_API_BASE_URL"]
    }
  }
}
```

**Trade-offs**:
- ❌ More verbose (50 → 120 lines)
- ✅ Self-documenting
- ✅ UI can be generated automatically
- ✅ Validation is comprehensive
- ✅ Enables advanced features (conditional fields, service cascades)
- ✅ Single source of truth

---

## Benefits Summary

| Aspect | blueprint-config.json | topology.json v2.0 |
|--------|----------------------|-------------------|
| **Structure** | Infrastructure + separate config | Colocated per service |
| **Validation** | Manual/implicit | Multi-level, automatic |
| **UI Generation** | Manual | Automatic from metadata |
| **Documentation** | External | Embedded (x-rationale) |
| **Secret Management** | Inline env vars | Typed references |
| **Cross-Service Deps** | Implicit | Explicit + validated |
| **Conditional Logic** | Basic | Advanced (depends-on, provider-fields) |
| **Service Enablement** | Static | Dynamic (feature flags) |
| **State Tracking** | None | Possible (configured vs default) |
| **Migration Path** | N/A | Gradual, backward-compatible |

---

## Recommended Timeline

**Week 1**: Infrastructure migration + validation
**Week 2**: Configuration schema + basic metadata
**Week 3-4**: Enrich metadata (UI, rationale, providers)
**Week 5**: Testing + quadlet generation
**Week 6**: Deploy + deprecate old schema

**Total**: 6 weeks for complete migration

**Minimal Viable Migration**: Week 1-2 (infrastructure + config schema) provides immediate validation benefits
