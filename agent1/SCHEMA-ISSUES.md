# Schema Issues and Recommendations - Agent 1

## Executive Summary

This document identifies inconsistencies, gaps, and recommendations discovered during the template audit of openwebui, qdrant, searxng, tika, and whisper services for Leger v0.0.1.

**Key Findings:**
- 7 major architectural issues identified
- 12 missing fields discovered
- 8 validation concerns documented
- 15 recommendations provided

---

## Critical Issues

### Issue 1: Inconsistent Configuration Nesting

**Severity:** HIGH

**Description:**
OpenWebUI templates access configuration through deeply nested paths that don't align with the flat provider_config structure recommended in the specification.

**Current State:**
```javascript
// Templates access:
openwebui.vector_db_config.qdrant.uri
openwebui.rag_embedding_config.openai.api_key
openwebui.content_extraction_config.tika.server_url
openwebui.web_search_config.searxng.query_url
openwebui.audio_config.stt.openai.base_url
```

**Recommended State:**
```javascript
// Flattened:
provider_config.qdrant_uri
provider_config.rag_embedding_openai_api_key
provider_config.tika_server_url
provider_config.searxng_query_url
provider_config.whisper_base_url
```

**Impact:**
- Templates would need significant refactoring
- OR schema must accommodate nested structure
- Increases complexity of x-depends-on logic

**Recommendation:**
Accept the nested structure in schema since it provides logical grouping. Document the pattern clearly in the template contract.

---

### Issue 2: Secret Management Pattern Inconsistency

**Severity:** MEDIUM

**Description:**
Secrets are accessed through multiple different paths:
1. `secrets.{secret_name}` (recommended pattern)
2. `openwebui.general.{secret_name}` (general config)
3. `{service}.{config_section}.{provider}.api_key` (provider-specific)

**Examples:**
```javascript
// Pattern 1 (recommended):
secrets.searxng_secret_key

// Pattern 2 (general config):
openwebui.general.openai_api_key
openwebui.general.webui_secret_key

// Pattern 3 (nested provider config):
openwebui.rag_embedding_config.openai.api_key
openwebui.audio_config.stt.openai.api_key
```

**Impact:**
- Confusing for users
- Difficult to validate
- CLI secret injection logic becomes complex

**Recommendation:**
1. Move ALL secrets to `secrets.*` section
2. Update templates to reference `secrets.{name}`
3. Use consistent {TEMPLATE} pointer format

**Migration Path:**
```json
{
  "secrets": {
    "openwebui_secret_key": "{OPENWEBUI_SECRET_KEY}",
    "litellm_api_key": "{LITELLM_API_KEY}",
    "rag_embedding_api_key": "{RAG_EMBEDDING_API_KEY}",
    "searxng_secret": "{SEARXNG_SECRET_KEY}",
    "tavily_api_key": "{TAVILY_API_KEY}"
  }
}
```

---

### Issue 3: Missing Infrastructure Defaults

**Severity:** MEDIUM

**Description:**
Several infrastructure fields are referenced in templates but lack documented defaults:

**Missing Fields:**
1. `openwebui_postgres.db_name` - Referenced but not in schema
2. `openwebui_postgres.db_user` - Referenced but not in schema
3. `searxng_redis.volume` - Referenced but not in schema
4. `tika.heap_size` - Has default in template ("2g") but not documented

**Impact:**
- User-config.json validation will fail
- Templates may receive undefined values
- Unclear what defaults are expected

**Recommendation:**
Add all infrastructure fields to schema with explicit defaults. See SCHEMA-ADDITIONS.json for complete list.

---

### Issue 4: Dynamic URL Construction Not Documented

**Severity:** MEDIUM

**Description:**
Templates construct URLs dynamically using patterns not documented in schema:

**Patterns Found:**
```javascript
// Database URL pattern:
postgresql://{db_user}@{hostname}:{port}/{db_name}

// Redis URL pattern:
redis://{hostname}:{port}/{database_number}

// HTTP endpoint pattern:
http://{hostname}:{port}{path}

// Tailscale HTTPS pattern:
https://{subdomain}.{tailscale.full_hostname}
```

**Examples from Templates:**
```nunjucks
DATABASE_URL=postgresql://openwebui@openwebui-postgres:5432/openwebui
REDIS_URL=redis://openwebui-redis:6379/2
WEBSOCKET_REDIS_URL=redis://openwebui-redis:6379/3
QDRANT_URI=http://qdrant:6333
SEARXNG_BASE_URL=https://search.{{ tailscale.full_hostname }}
```

**Impact:**
- Schema doesn't document these patterns
- Resolution engine must understand URL construction
- Templates may construct URLs inconsistently

**Recommendation:**
Document URL construction patterns in schema or provide URL construction utilities in resolution engine.

---

### Issue 5: Auxiliary Service Dependencies Not Captured

**Severity:** LOW

**Description:**
Some services have implicit auxiliary services (postgres, redis) that are always deployed together but aren't captured in schema dependency logic.

**Service Groups Identified:**
```json
{
  "openwebui_group": ["openwebui", "openwebui_postgres", "openwebui_redis"],
  "searxng_group": ["searxng", "searxng_redis"]
}
```

**Current x-affects-services Logic:**
```json
{
  "providers.vector_db": {
    "qdrant": ["qdrant"]  // Only lists main service
  }
}
```

**Missing:**
When openwebui is enabled, openwebui_postgres and openwebui_redis should auto-enable but aren't listed in x-affects-services.

**Impact:**
- Incomplete service enablement
- Startup order may be incorrect
- Users might manually enable dependencies

**Recommendation:**
Add service group concept or expand x-affects-services to include auxiliary services:
```json
{
  "base_services.openwebui": {
    "true": ["openwebui", "openwebui_postgres", "openwebui_redis"]
  }
}
```

---

### Issue 6: External Subdomain Nullable Pattern

**Severity:** LOW

**Description:**
Not all services have `external_subdomain` field:
- **With subdomain:** openwebui, qdrant, searxng, whisper
- **Without subdomain (internal only):** tika, all postgres/redis services

**Current Schema:**
All have `external_subdomain` with default values, but internal services should have `null`.

**Impact:**
- May generate unnecessary Caddy routes for internal services
- Unclear which services are externally accessible

**Recommendation:**
Make `external_subdomain` nullable and set to `null` for internal-only services:
```json
{
  "tika": {
    "external_subdomain": {
      "type": ["string", "null"],
      "default": null
    }
  }
}
```

---

### Issue 7: Redis Database Number Not Configurable

**Severity:** LOW

**Description:**
Templates hardcode Redis database numbers:
```nunjucks
REDIS_URL=redis://openwebui-redis:6379/2
WEBSOCKET_REDIS_URL=redis://openwebui-redis:6379/3
```

**Impact:**
- Cannot configure which Redis database to use
- Potential conflicts if multiple services use same Redis instance
- Not documented in schema

**Recommendation:**
Add redis database configuration to infrastructure:
```json
{
  "openwebui": {
    "redis_db_cache": {"type": "integer", "default": 2},
    "redis_db_websocket": {"type": "integer", "default": 3}
  }
}
```

---

## Missing Fields

### 1. SearXNG Engine Configuration

**Templates Reference:**
```nunjucks
{% for engine in searxng.engines %}
  - name: {{ engine.name }}
    disabled: {{ not engine.enabled | lower }}
{% endfor %}
```

**Missing from Schema:**
```json
{
  "searxng_engines": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "enabled": {"type": "boolean"}
      }
    },
    "default": [
      {"name": "google", "enabled": true},
      {"name": "duckduckgo", "enabled": true},
      {"name": "bing", "enabled": true}
    ]
  }
}
```

---

### 2. OpenWebUI General Configuration

**Templates Reference Multiple Fields:**
```nunjucks
DATABASE_URL={{ openwebui.general.database_url }}
WEBUI_NAME={{ openwebui.general.webui_name }}
CUSTOM_NAME={{ openwebui.general.custom_name }}
WEBUI_AUTH={{ openwebui.general.webui_auth }}
ENABLE_SIGNUP={{ openwebui.general.enable_signup }}
DEFAULT_USER_ROLE={{ openwebui.general.default_user_role }}
GLOBAL_LOG_LEVEL={{ openwebui.general.log_level }}
```

**Missing from Schema:**
All `openwebui.general.*` fields need to be defined with defaults.

---

### 3. Task Models Configuration

**Templates Reference:**
```nunjucks
TASK_MODEL_TITLE={{ openwebui.general.task_models.title_generation }}
TASK_MODEL_TAGS={{ openwebui.general.task_models.tags_generation }}
TASK_MODEL_QUERY={{ openwebui.general.task_models.query_generation }}
```

**Missing from Schema:**
```json
{
  "task_models": {
    "type": "object",
    "properties": {
      "title_generation": {"type": "string", "default": ""},
      "tags_generation": {"type": "string", "default": ""},
      "query_generation": {"type": "string", "default": ""}
    }
  }
}
```

---

### 4. Service Timeout Configuration

**Templates Reference:**
```nunjucks
{{ m.serviceSection(timeout=openwebui.service.timeout_start_sec) }}
```

**Missing from Schema:**
Service-specific timeout configuration for all services.

---

### 5. Whisper Cache Directory

**Templates Reference:**
```nunjucks
Volume={{ whisper.cache_dir }}:/root/.cache/huggingface:Z
```

**Missing from Schema:**
Host path for model cache directory.

---

### 6. Qdrant gRPC Port

**Templates Don't Expose:**
Qdrant uses port 6334 for gRPC but it's not published in container template. May need to add if gRPC is preferred.

---

### 7. Tailscale Configuration

**Templates Reference:**
```nunjucks
https://{{ service.external_subdomain }}.{{ tailscale.full_hostname }}
```

**Missing from Schema:**
```json
{
  "tailscale": {
    "type": "object",
    "properties": {
      "full_hostname": {
        "type": "string",
        "description": "Full Tailscale hostname (e.g., hostname.tailnet.ts.net)"
      }
    }
  }
}
```

**Note:** This might be external configuration passed at render time, not in user-config.json.

---

## Validation Concerns

### 1. Port Conflicts

**Issue:** No validation that published_port values don't conflict.

**Recommendation:**
Add uniqueness constraint or validation logic in resolution engine.

---

### 2. Heap Size Pattern

**Issue:** `tika.heap_size` should validate format.

**Recommendation:**
```json
{
  "pattern": "^[0-9]+[mg]$"
}
```

---

### 3. Enum Values

**Missing Enums:**
- `whisper_model`: ["tiny", "base", "small", "medium", "large"]
- `whisper_compute_type`: ["int8", "float16", "float32"]
- `whisper_device`: ["auto", "cpu", "cuda"]
- `searxng_safe_search`: [0, 1, 2]
- `searxng_autocomplete`: ["google", "duckduckgo", "wikipedia", ""]

---

### 4. URL Format Validation

**Issue:** Many URL fields lack `format: "uri"` validation.

**Recommendation:**
Add format validation to all URL fields:
- `qdrant_url`
- `tika_server_url`
- `searxng_query_url`
- `searxng_base_url`

---

### 5. Minimum/Maximum Constraints

**Missing Constraints:**
```json
{
  "rag_top_k": {"minimum": 1, "maximum": 50},
  "chunk_size": {"minimum": 100, "maximum": 10000},
  "chunk_overlap": {"minimum": 0, "maximum": 1000},
  "whisper_beam_size": {"minimum": 1, "maximum": 10},
  "searxng_max_page": {"minimum": 1, "maximum": 50}
}
```

---

### 6. Required Fields

**Issue:** Schema should mark which fields are required vs optional.

**Recommendation:**
```json
{
  "required": ["infrastructure", "features", "providers"]
}
```

---

### 7. Conditional Requirements

**Issue:** Some fields are required when features are enabled.

**Example:**
If `features.rag == true`, then `providers.vector_db` should be required.

**Recommendation:**
Use JSON Schema `if/then` conditions or document in x-depends-on logic.

---

### 8. Default Value Consistency

**Issue:** Some defaults are empty strings, some are null, some are omitted.

**Recommendation:**
Standardize: Use `null` for optional unset values, empty string for optional text fields, and omit default if required.

---

## Template Inconsistencies

### 1. Macro Usage Variation

**Issue:** Some templates use macros consistently, others inline logic.

**Example:**
```nunjucks
// Good (using macro):
{{ m.publishPort(infrastructure.services.whisper) }}

// Inconsistent (manual):
PublishPort={{ service.published_port }}:{{ service.port }}
```

**Recommendation:**
Standardize on macro usage across all templates.

---

### 2. Health Check Variations

**Issue:** Different health check patterns across services.

**Examples:**
```nunjucks
// Wget-based:
{{ m.healthCheckWget(port, "/health") }}

// TCP-based:
timeout 3s bash -c ':> /dev/tcp/127.0.0.1/6333'

// Redis-specific:
{{ m.redisHealthCheck() }}
```

**Recommendation:**
Document health check patterns in macro library documentation.

---

### 3. Comment Styles

**Issue:** Mix of decorative comments and simple comments.

**Recommendation:**
Standardize on consistent comment style.

---

## Recommendations Summary

### Priority 1 (Critical)

1. **Flatten or Document Nested Config Structure**
   - Decide: Flatten provider_config OR accept nested structure
   - Document chosen pattern in specification
   - Update x-depends-on logic accordingly

2. **Standardize Secret Management**
   - Move all secrets to `secrets.*` section
   - Update templates to use consistent pattern
   - Document {TEMPLATE} pointer replacement

3. **Complete Infrastructure Defaults**
   - Add all missing infrastructure fields
   - Document all defaults explicitly
   - Include auxiliary services (postgres, redis)

### Priority 2 (Important)

4. **Document URL Construction Patterns**
   - Add URL pattern documentation to schema
   - Consider providing URL builder utilities
   - Validate URL formats

5. **Add Service Group Concept**
   - Define which services are always deployed together
   - Update x-affects-services to include groups
   - Ensure correct startup order

6. **Add Missing Provider Config Fields**
   - Complete all provider-specific configurations
   - Add SearXNG engine array
   - Add task model configuration

### Priority 3 (Nice to Have)

7. **Add Validation Constraints**
   - Enum values for all constrained fields
   - Pattern validation for formatted strings
   - Min/max for numeric fields
   - Format validation for URLs

8. **Make External Subdomain Nullable**
   - Set to null for internal-only services
   - Update Caddy template generation logic
   - Clear documentation of which services are external

9. **Add Redis Database Configuration**
   - Allow configuration of Redis database numbers
   - Document database usage per service
   - Prevent conflicts

10. **Standardize Template Patterns**
    - Consistent macro usage
    - Consistent comment styles
    - Consistent health check patterns

### Priority 4 (Future Enhancements)

11. **Add Tailscale Configuration**
    - Document whether it's in user-config or external
    - Define structure if included
    - Handle case when Tailscale not used

12. **Port Conflict Detection**
    - Validate no port conflicts in user-config
    - Resolution engine should check
    - Provide helpful error messages

13. **Conditional Field Requirements**
    - Use JSON Schema if/then logic
    - Document in x-depends-on
    - Validate at form submission

14. **Add More Validation**
    - Hostname patterns
    - Volume name patterns
    - Container name patterns

15. **Template Testing**
    - Create test user-config.json examples
    - Validate templates render correctly
    - Ensure all paths resolve

---

## Questions for Other Agents

### For Agent 2 (jupyter, llama-swap):

1. Does Jupyter configuration follow same patterns as OpenWebUI?
2. Are there additional provider_config fields for code execution?
3. Does llama-swap have similar nested config structure?

### For Agent 3 (litellm, caddy, cockpit, mcp-context-forge, comfyui):

1. Does LiteLLM have similar nested provider configs?
2. How does Caddy configuration integrate with service external_subdomain?
3. Are there additional global configuration patterns we should adopt?

### For Agent 4 (Consolidation):

1. Should we flatten all provider_config or accept nesting?
2. Should secrets be centralized or distributed?
3. What's the final pattern for x-depends-on with nested configs?
4. How should service groups be represented?

---

## Conclusion

The template audit reveals a well-structured system with some inconsistencies that should be addressed before v0.0.1 release. Most issues are resolvable through:

1. Clear documentation of accepted patterns
2. Completion of missing fields
3. Addition of validation constraints
4. Standardization of template patterns

**Next Steps:**
1. Review recommendations with all agents
2. Make architectural decisions on critical issues
3. Complete schema with all fields
4. Update templates for consistency
5. Create comprehensive test cases

---

**Document prepared by:** Agent 1
**Date:** 2025-10-31
**Services covered:** openwebui, qdrant, searxng, tika, whisper
