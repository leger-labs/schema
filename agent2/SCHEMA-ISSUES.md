# Schema Issues and Recommendations
## Agent 2: jupyter, litellm, llama-swap, mcp-context-forge

**Date:** 2025-10-31
**Agent:** Agent 2

---

## Executive Summary

This document outlines issues, inconsistencies, and recommendations discovered during the template audit for jupyter, litellm, llama-swap, and mcp-context-forge services.

### Issue Categories

- **Critical:** 2 issues (require resolution before v0.0.1)
- **High:** 4 issues (should be addressed)
- **Medium:** 6 issues (recommended improvements)
- **Low:** 3 issues (nice to have)

---

## Critical Issues

### 1. Jupyter Custom Image Build Not Documented in Schema

**Severity:** Critical
**Service:** jupyter

**Issue:**
The jupyter template requires a custom Dockerfile to exist at `~/.config/containers/systemd/jupyter/Dockerfile`. The template uses `ExecStartPre` to build this image, but:
- The Dockerfile is not included in the repository
- The schema doesn't document this requirement
- Users will encounter failures if they don't have this file

**Template Reference:**
```nunjucks
# jupyter.container.njk:82-85
ExecStartPre=-/usr/bin/podman build \
  -t localhost/blueprint-jupyter:latest \
  -f %h/.config/containers/systemd/jupyter/Dockerfile \
  %h/.config/containers/systemd/jupyter
```

**Impact:**
- Service won't start without the Dockerfile
- No clear documentation for users
- Custom build process not covered by schema

**Recommendations:**
1. Include the Dockerfile in the repository
2. Document the custom build requirement in schema or deployment docs
3. Consider adding a validation step that checks for the Dockerfile's existence
4. Alternative: Provide a pre-built image on a registry

---

### 2. LiteLLM Database URL Hardcoded in Multiple Locations

**Severity:** Critical
**Service:** litellm

**Issue:**
The database URL is hardcoded in two places:
1. `litellm.container.njk` (line 44): `Environment=DATABASE_URL={{ litellm.database_url }}`
2. `litellm.yaml.njk` (line 101): `database_url: "{{ litellm.database_url }}"`

If these get out of sync, the service will fail. The schema should derive this automatically from infrastructure settings.

**Current Approach:**
```json
{
  "litellm": {
    "database_url": "postgresql://litellm@litellm-postgres:5432/litellm"
  }
}
```

**Recommendation:**
Generate the database URL automatically from infrastructure:
```
DATABASE_URL=postgresql://{{ infrastructure.services.litellm_postgres.db_user }}@{{ infrastructure.services.litellm_postgres.hostname }}:{{ infrastructure.services.litellm_postgres.port }}/{{ infrastructure.services.litellm_postgres.db_name }}
```

This eliminates duplication and ensures consistency.

---

## High Priority Issues

### 3. Local Model Configuration Complexity

**Severity:** High
**Service:** llama-swap

**Issue:**
The `local_inference` configuration section is deeply nested and complex:
- Models defined as object (not array)
- Three separate sections: `models`, `groups`, `defaults`
- Many interdependencies between model definitions and groups

**Example Complexity:**
```json
{
  "local_inference": {
    "models": {
      "llama_3_2_3b": {
        "enabled": true,
        "name": "llama-3.2-3b",
        "group": "light",
        ...
      }
    },
    "groups": {
      "light": {
        "members": ["llama-3.2-3b"],
        "swap": false
      }
    },
    "defaults": { ... }
  }
}
```

**Problems:**
- Model keys (`llama_3_2_3b`) vs model names (`llama-3.2-3b`) create confusion
- Group membership defined in both `model.group` AND `groups.*.members`
- Difficult to validate consistency

**Recommendations:**
1. Simplify to array-based models (like litellm.models)
2. Auto-generate group membership from `model.group`
3. Flatten defaults into model-level with inheritance
4. Consider separating simple cases (1-2 models) from complex swap setups

---

### 4. MCP Context Forge Has 150+ Environment Variables

**Severity:** High
**Service:** mcp-context-forge

**Issue:**
The MCP Context Forge template sets over 150 environment variables. While most have sensible defaults, this creates:
- Very long template (494 lines)
- Difficult to maintain
- Hard to understand what can be customized

**Current Approach:**
All variables defined in template with hardcoded defaults.

**Recommendations:**
1. **Group into feature sets:** Authentication, SSO, Observability, Federation, etc.
2. **Use advanced section:** Move tuning parameters to `advanced.*` in schema
3. **Document essential vs optional:** Clearly mark which settings users need to care about
4. **Consider environment file:** Use EnvironmentFile for non-secret config too
5. **Progressive disclosure:** Hide advanced settings unless explicitly enabled

**Essential Settings (should be in schema):**
- Database choice
- Authentication settings
- Feature toggles (UI, A2A, Federation)
- Admin credentials

**Advanced Settings (can use defaults):**
- Pool sizes, timeouts, cache TTLs
- Password policies
- Compression settings
- Transport configuration

---

### 5. Inconsistent Secret Naming Patterns

**Severity:** High
**Service:** All

**Issue:**
Secret references use inconsistent patterns across services:

**LiteLLM:**
- `secrets.api_keys.litellm_master`
- `secrets.llm_providers.openai`

**MCP Context Forge:**
- Loads from external file with direct env var names
- `JWT_SECRET_KEY`, `ADMIN_PASSWORD`, etc.

**Recommendation:**
Standardize on one pattern:
```json
{
  "secrets": {
    "services": {
      "litellm": {
        "master_key": "{LITELLM_MASTER_KEY}"
      },
      "mcp_context_forge": {
        "jwt_secret": "{JWT_SECRET_KEY}",
        "admin_password": "{ADMIN_PASSWORD}"
      }
    },
    "providers": {
      "openai": {
        "api_key": "{OPENAI_API_KEY}"
      }
    }
  }
}
```

---

### 6. Missing Validation for Model Names vs Groups

**Severity:** High
**Service:** llama-swap

**Issue:**
In `local_inference`, models reference groups and groups reference models, but there's no validation:
- Model has `group: "heavy"`
- Group has `members: ["qwen2.5-32b"]`
- If model.name doesn't match group.members, swap won't work

**Recommendation:**
Add JSON Schema validation:
```json
{
  "allOf": [
    {
      "if": {
        "properties": {
          "group": {"const": "heavy"}
        }
      },
      "then": {
        "// validation that model.name is in groups.heavy.members"
      }
    }
  ]
}
```

Or better: Auto-generate group membership from model.group and remove groups.*.members entirely.

---

## Medium Priority Issues

### 7. Port Conflicts Not Validated

**Severity:** Medium
**Service:** All

**Issue:**
Multiple services can potentially conflict:
- litellm: 4000
- llama-swap: 8000
- mcp-context-forge: 4444
- jupyter: 8888 (internal), 8889 (published)

If user changes ports, no validation ensures uniqueness.

**Recommendation:**
Add schema-level validation to ensure all `published_port` values are unique across services.

---

### 8. No Validation for Required Volumes

**Severity:** Medium
**Service:** All

**Issue:**
Templates reference volumes that must exist, but schema doesn't validate they're defined:
- `jupyter.volume`
- `litellm-postgres.volume`
- `llama-swap.volume`

**Recommendation:**
Add volume definitions to infrastructure section with validation that referenced volumes exist.

---

### 9. Jupyter LITELLM_API_KEY Uses Environment Variable

**Severity:** Medium
**Service:** jupyter

**Issue:**
Template uses `${LITELLM_MASTER_KEY}` directly:
```nunjucks
Environment=LITELLM_API_KEY=${LITELLM_MASTER_KEY}
```

This assumes the environment variable exists at runtime. More consistent would be:
```nunjucks
Environment=LITELLM_API_KEY={{ secrets.api_keys.litellm_master }}
```

Then CLI handles the replacement.

**Recommendation:**
Use template variable instead of runtime environment variable for consistency with other secrets.

---

### 10. llama-swap Podman Socket Security Not Documented

**Severity:** Medium
**Service:** llama-swap

**Issue:**
llama-swap requires:
- Podman socket mount: `/run/user/%U/podman/podman.sock`
- Security option: `--security-opt=label=disable`

This is a significant security consideration (container can spawn other containers) but not documented in schema.

**Recommendation:**
Add security notes to schema documentation:
```json
{
  "llama_swap": {
    "security_notes": "Requires Podman socket access to spawn model containers. Uses label=disable security option."
  }
}
```

---

### 11. MCP Database Choice Not Validated Against Dependencies

**Severity:** Medium
**Service:** mcp-context-forge

**Issue:**
Template allows choosing database:
- `database: "postgresql"` → requires `mcp_context_forge_postgres`
- `database: "sqlite"` → no dependency needed
- `database: "mariadb"` → requires mariadb service (not defined)

But schema doesn't validate that the required service is in `requires` array.

**Recommendation:**
Add conditional validation:
```json
{
  "if": {
    "properties": {"database": {"const": "postgresql"}}
  },
  "then": {
    "properties": {
      "requires": {"contains": {"const": "mcp_context_forge_postgres"}}
    }
  }
}
```

---

### 12. No Default Values for Optional MCP Features

**Severity:** Medium
**Service:** mcp-context-forge

**Issue:**
Many MCP features have boolean toggles but no guidance on recommended defaults:
- `llmchat_enabled`: Should this be true for most users?
- `observability_enabled`: When should this be enabled?
- `redis_enabled`: What's the performance impact?

**Recommendation:**
Add documentation for each feature toggle:
```json
{
  "llmchat_enabled": {
    "type": "boolean",
    "default": false,
    "title": "Enable LLM Chat",
    "description": "Provides built-in chat interface. Only enable if you need chat separate from OpenWebUI.",
    "x-recommended": false
  }
}
```

---

## Low Priority Issues

### 13. Inconsistent Health Check Intervals

**Severity:** Low
**Service:** All

**Issue:**
Health check intervals vary:
- Most services: 30s
- llama-swap: 10s (via template manipulation)
- MCP: 30s

No clear rationale for differences.

**Recommendation:**
Standardize on 30s or document why specific services need different intervals.

---

### 14. Missing Container Version Constraints

**Severity:** Low
**Service:** All

**Issue:**
Templates use `AutoUpdate=registry` but no minimum version constraints. If a breaking change occurs in upstream images, services may fail.

**Recommendation:**
Document tested versions in release-catalog.json (already done) and consider adding version constraints or tests.

---

### 15. No Graceful Degradation for Missing Optional Dependencies

**Severity:** Low
**Service:** jupyter

**Issue:**
Jupyter depends on litellm for AI code completion, but if litellm is down, jupyter fails health check.

**Recommendation:**
Make AI features gracefully degrade if litellm is unavailable. This is more of a template/runtime issue than schema.

---

## Validation Concerns

### Missing JSON Schema Constraints

1. **Port ranges:** No validation that ports are in valid range (1-65535)
2. **URL formats:** Database URLs, API endpoints not validated
3. **Email formats:** Admin emails not validated
4. **Enum completeness:** Some enums may be incomplete (e.g., LLM providers)

### Recommended Validations to Add

```json
{
  "infrastructure.services.*.port": {
    "type": "integer",
    "minimum": 1,
    "maximum": 65535
  },
  "infrastructure.services.mcp_context_forge.admin_email": {
    "type": "string",
    "format": "email"
  },
  "local_inference.models.*.model_uri": {
    "type": "string",
    "pattern": "^(huggingface|ollama|file)://"
  }
}
```

---

## Recommendations for Schema Improvements

### 1. Template Variable Standardization

**Current:** Mix of direct access and nested paths
```nunjucks
{{ infrastructure.services.litellm.hostname }}
{{ service.hostname }}  // when set via {% set %}
```

**Recommendation:**
Standardize on one approach, preferably full paths for clarity.

---

### 2. Service Enablement Logic

**Current:** Implicit based on provider selection

**Recommendation:**
Make explicit in schema:
```json
{
  "x-service-enablement": {
    "jupyter": {
      "enabled_by": "providers.code_execution_engine == 'jupyter' || providers.code_interpreter_engine == 'jupyter'"
    },
    "llama_swap": {
      "enabled_by": "local_inference.models | any(enabled == true)"
    }
  }
}
```

---

### 3. Configuration Complexity Tiers

Separate configuration into tiers:

**Tier 1 - Essential (user must configure):**
- Service enablement
- Basic ports
- Admin credentials

**Tier 2 - Common (recommended to configure):**
- External subdomains
- Database choices
- Feature toggles

**Tier 3 - Advanced (use defaults):**
- Pool sizes, timeouts
- Cache settings
- Security headers

---

### 4. Secret Management Strategy

**Recommendation:**
Clearly document two-phase secret handling:

**Phase 1 - Template Rendering:**
```json
{
  "secrets": {
    "litellm_master_key": "{LITELLM_MASTER_KEY}"
  }
}
```

**Phase 2 - CLI Injection:**
```bash
# CLI reads actual secret and replaces {LITELLM_MASTER_KEY} placeholder
```

This is already the plan, but templates should be consistent about using `{{ secrets.* }}` instead of `${ENV_VAR}`.

---

## Template Quality Assessment

### Strengths

✅ Consistent use of macros (publishPort, volumeMount, healthCheck)
✅ Excellent inline documentation
✅ Template inheritance (base-container.njk)
✅ Comprehensive architecture notes
✅ Well-organized by service

### Areas for Improvement

⚠️ Very long templates (mcp-context-forge: 494 lines)
⚠️ Some duplication (database URLs)
⚠️ Inconsistent secret access patterns
⚠️ Mix of hardcoded and configurable values

---

## Agent 2 Recommendations Summary

### Must Fix (v0.0.1)

1. ✅ Document Jupyter Dockerfile requirement
2. ✅ Auto-generate litellm database URL
3. ✅ Standardize secret access patterns

### Should Fix (v0.0.2)

4. Simplify local_inference configuration
5. Organize MCP variables into feature groups
6. Add port uniqueness validation
7. Document llama-swap security requirements

### Nice to Have (Future)

8. Graceful degradation for optional dependencies
9. Configuration complexity tiers
10. Enhanced JSON Schema validation

---

## Questions for Final Schema Design

1. **Jupyter Dockerfile:** Should this be included in the repo or provided separately?
2. **Local model configuration:** Array or object? Auto-generate groups?
3. **MCP environment variables:** Keep all in template or move some to advanced section?
4. **Secret pattern:** Settle on one consistent approach for all services?
5. **Database URL generation:** Template-level or schema-level derivation?

---

**Agent 2 Analysis Complete**
**Date:** 2025-10-31
**Total Issues Identified:** 15
**Critical:** 2 | **High:** 4 | **Medium:** 6 | **Low:** 3
