# Schema Issues and Recommendations - Agent 3

## Executive Summary

Agent 3 audited the templates for **caddy**, **cockpit**, **comfyui**, and **edgetts** services. This document identifies inconsistencies, missing fields, validation concerns, and recommendations for improving the schema specification.

---

## 1. Inconsistencies Found

### 1.1. Volume Configuration Inconsistency

**Issue**: ComfyUI references volume fields that don't exist in the standard infrastructure pattern.

**Evidence**:
```njk
# From comfyui.container.njk:34-37
{{ m.volumeMount(service.volume, service.workspace) }}
{{ m.volumeMount(service.models_volume, service.workspace + "/models") }}
```

**Problem**:
- Templates expect `service.volume`, `service.models_volume`, and `service.workspace`
- These fields are not part of the standard infrastructure pattern
- Other services use simple volume file names (e.g., `edgetts-cache.volume`)

**Impact**: Schema doesn't define where these values come from.

**Recommendation**:
- Option A: Add volume configuration to provider_config (service-specific)
- Option B: Create a separate `volumes` section in schema
- Option C: Hardcode volume names in templates (current implicit approach)

---

### 1.2. ComfyUI Caddy Conditional Uses Wrong Path

**Issue**: ComfyUI's Caddy configuration references `openwebui.features.image_generation` instead of global `features.image_generation`.

**Evidence**:
```njk
# From comfyui.caddy.njk:2
{% if service.enabled_by and openwebui.features.image_generation and service.external_subdomain %}
```

**Problem**:
- Creates coupling between ComfyUI and OpenWebUI services
- Should use global feature flag, not service-specific path

**Impact**: Architectural coupling between independent services.

**Recommendation**: Change to:
```njk
{% if service.enabled_by and features.image_generation and service.external_subdomain %}
```

---

### 1.3. EdgeTTS Scope Confusion

**Issue**: System prompt says "Excluded from v0.0.1: edgetts (ICEBOX)" but complete templates exist.

**Evidence**:
- Full template set exists: edgetts.container.njk, edgetts.caddy.njk, README.md
- release-catalog.json includes EdgeTTS with version info
- All templates are production-ready

**Problem**: Unclear whether EdgeTTS should be included in v0.0.1 or deferred to v0.1.0.

**Impact**: Scope creep or missing functionality depending on interpretation.

**Recommendation**:
- Either: Include EdgeTTS in v0.0.1 (templates are ready)
- Or: Remove EdgeTTS templates and defer to v0.1.0
- Document decision clearly in release notes

---

## 2. Missing Fields

### 2.1. Infrastructure Fields Not Documented

**Missing Required Fields**:
- `description` - Used by all services but not in infrastructure specification
- `websocket` - Referenced in macros for WebSocket-enabled services (comfyui)

**Evidence**:
```njk
# From cockpit.container.njk:14
Description={{ infrastructure.services.cockpit.description }}

# From macros.njk:148-151
{% if service.websocket %}
# WebSocket support
header_up Connection {>Connection}
header_up Upgrade {>Upgrade}
{% endif %}
```

**Impact**: Schema doesn't validate these required fields.

**Recommendation**: Add to infrastructure pattern:
```json
{
  "description": {
    "type": "string",
    "description": "Human-readable service description for systemd unit"
  },
  "websocket": {
    "type": "boolean",
    "default": false,
    "description": "Whether service requires WebSocket support"
  }
}
```

---

### 2.2. Volume Mount Paths Missing

**Issue**: Templates reference volume mount paths not defined in schema.

**Evidence**:
```njk
# From comfyui.container.njk:44
Environment=WORKSPACE={{ comfyui.workspace }}
```

**Problem**: `comfyui.workspace` is used but not defined in provider_config.

**Impact**: Template expects field that isn't validated by schema.

**Recommendation**: Add to provider_config:
```json
{
  "comfyui_workspace": {
    "type": "string",
    "default": "/workspace"
  }
}
```

---

### 2.3. Image Field Confusion

**Issue**: Templates reference `service.image` but images should always come from release-catalog.json.

**Evidence**:
```njk
# From comfyui.container.njk:16
Image={{ service.image }}
```

**Problem**: Unclear whether `infrastructure.services.{service}.image` should exist or if all templates should use catalog pattern.

**Impact**: Inconsistent image version management.

**Recommendation**:
- Remove `image` from infrastructure specification
- All templates should use:
  ```njk
  {% set catalog = (readFile('../release-catalog.json') | fromJson) -%}
  {% set service_def = catalog.services.{service_name} -%}
  Image={{ service_def.image }}
  ```

---

## 3. Validation Concerns

### 3.1. Missing Pattern Constraints

**Fields Needing Validation**:

1. **bind_address**: Should validate IP address format
   ```json
   {
     "pattern": "^(\\d{1,3}\\.){3}\\d{1,3}$"
   }
   ```

2. **external_subdomain**: Should validate subdomain format
   ```json
   {
     "pattern": "^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$"
   }
   ```

3. **container_name**: Should validate container naming rules
   ```json
   {
     "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_.-]*$"
   }
   ```

**Impact**: Invalid values could cause deployment failures.

**Recommendation**: Add pattern constraints to infrastructure schema.

---

### 3.2. Missing Range Constraints

**Fields Needing Min/Max**:

1. **edgetts_speed**: Already identified (0.5 - 2.0) ✓
2. **Port numbers**: Should validate port range
   ```json
   {
     "minimum": 1,
     "maximum": 65535
   }
   ```

3. **Timeout values**: Should have reasonable limits
   ```json
   {
     "minimum": 10,
     "maximum": 3600
   }
   ```

**Impact**: Invalid values could cause service failures.

**Recommendation**: Add numeric constraints to all applicable fields.

---

### 3.3. Missing Enum Constraints

**Fields That Should Be Enums**:

1. **edgetts_voice**: Currently open string, but limited set of voices exist
   - Could enumerate popular voices
   - Or keep as string with examples (current approach) ✓

2. **comfyui_log_level**: Already identified ✓

3. **edgetts_response_format**: Already identified ✓

**Impact**: Minor - users could enter invalid values.

**Recommendation**: Current approach (examples for voices, enums for others) is acceptable.

---

## 4. Special Cases to Document

### 4.1. Caddy's 0.0.0.0 Bind Address

**Issue**: Caddy requires `bind_address: "0.0.0.0"` instead of standard `"127.0.0.1"`.

**Reason**: Tailscale needs to access Caddy from external network interfaces.

**Documentation Needed**:
```json
{
  "caddy": {
    "properties": {
      "bind_address": {
        "default": "0.0.0.0",
        "description": "Must be 0.0.0.0 for Tailscale access (not 127.0.0.1)"
      }
    }
  }
}
```

---

### 4.2. Cockpit's 'host' Hostname

**Issue**: Cockpit uses `hostname: "host"` which doesn't represent a container hostname.

**Reason**: Cockpit represents the host system in the dashboard.

**Documentation Needed**:
```json
{
  "cockpit": {
    "properties": {
      "hostname": {
        "default": "host",
        "description": "Special value 'host' represents the actual host system (not container hostname)"
      }
    }
  }
}
```

---

### 4.3. Cockpit's Privileged Mode Requirement

**Issue**: Cockpit requires privileged mode and special security options.

**Evidence**:
```njk
# From cockpit.container.njk:59-65
PodmanArgs=--privileged
PodmanArgs=--pid=host
PodmanArgs=--security-opt=label=disable
```

**Documentation Needed**: Add to service notes that some services require elevated privileges.

---

### 4.4. Caddy's Dynamic Service Discovery

**Issue**: Caddy iterates through all services to generate routes.

**Evidence**:
```njk
# From caddy.container.njk:26-31
{% for name, service in infrastructure.services %}
{%- if service.enabled and service.external_subdomain %}
After={{ service.container_name }}.service
Wants={{ service.container_name }}.service
{% endif -%}
{% endfor %}
```

**Documentation Needed**: Explain that Caddy has soft dependencies on all web-accessible services.

---

## 5. Recommendations

### 5.1. Standardize Volume Configuration

**Current State**: Inconsistent approach to volume definitions.

**Recommendation**: Add explicit volume configuration to schema:

**Option A - In provider_config**:
```json
{
  "comfyui_workspace_volume": {
    "type": "string",
    "default": "comfyui-workspace"
  },
  "comfyui_models_volume": {
    "type": "string",
    "default": "comfyui-models"
  }
}
```

**Option B - New volumes section** (preferred):
```json
{
  "volumes": {
    "comfyui": {
      "workspace": {
        "name": "comfyui-workspace",
        "mount_path": "/workspace"
      },
      "models": {
        "name": "comfyui-models",
        "mount_path": "/workspace/models"
      }
    }
  }
}
```

**Option C - Keep implicit** (current):
- Hardcode volume names in templates
- Don't expose in schema
- Simpler but less flexible

---

### 5.2. Add WebSocket Flag to Infrastructure

**Recommendation**: Add `websocket` boolean to infrastructure pattern.

**Rationale**:
- Multiple services need WebSocket support (openwebui, comfyui, jupyter)
- Caddy macros already check for this flag
- Should be standardized infrastructure field

**Implementation**:
```json
{
  "infrastructure": {
    "properties": {
      "service_name": {
        "properties": {
          "websocket": {
            "type": "boolean",
            "default": false
          }
        }
      }
    }
  }
}
```

---

### 5.3. Clarify Image Source

**Recommendation**: Document that all images come from release-catalog.json, not schema.

**Rationale**:
- Prevents schema bloat
- Single source of truth for versions
- Easier version updates

**Implementation**:
- Remove any `image` fields from infrastructure
- Document release-catalog.json as authoritative source
- Show template pattern in docs

---

### 5.4. Add Description Field as Required

**Recommendation**: Make `description` a required infrastructure field.

**Rationale**: All services use it for systemd unit descriptions.

**Implementation**:
```json
{
  "infrastructure": {
    "properties": {
      "service_name": {
        "required": ["container_name", "hostname", "port", "description"],
        "properties": {
          "description": {
            "type": "string",
            "description": "Service description for systemd unit"
          }
        }
      }
    }
  }
}
```

---

### 5.5. Document Service Categories

**Recommendation**: Add service categorization to schema.

**Categories Identified**:
1. **Core Infrastructure**: caddy, network
2. **System Management**: cockpit
3. **User-Facing Services**: openwebui, litellm
4. **Provider Services**: comfyui, edgetts, qdrant, searxng
5. **Supporting Services**: postgres, redis, tika, whisper

**Implementation**:
```json
{
  "x-service-categories": {
    "core": ["caddy", "network"],
    "management": ["cockpit"],
    "primary": ["openwebui", "litellm"],
    "providers": ["comfyui", "edgetts", "qdrant", "searxng", "jupyter"],
    "support": ["postgres", "redis", "tika", "whisper"]
  }
}
```

---

### 5.6. Improve Provider Field Naming

**Current Pattern**: `{provider_name}_{field_name}`

**Issue**: Creates many top-level fields in provider_config.

**Alternative**: Nested structure (future consideration):
```json
{
  "provider_config": {
    "comfyui": {
      "workspace": "/workspace",
      "auto_update": false
    },
    "edgetts": {
      "speed": 1.0,
      "voice": "en-US-AriaNeural"
    }
  }
}
```

**Recommendation**: Keep flat structure for v0.0.1 (easier RJSF forms), consider nested for v0.1.0.

---

## 6. Technical Debt

### 6.1. Hardcoded Values in Templates

**Items Hardcoded**:
1. Caddy ports (80, 443, 443/udp) - **Intentional**, should stay hardcoded
2. Health check intervals (30s, 5s, etc.) - **Could** be advanced params
3. Volume mount paths - **Should** be in schema
4. Log retention (50mb, 3 files) - **Could** be advanced params

**Recommendation**: Only expose truly useful tuning parameters to avoid schema bloat.

---

### 6.2. Template Duplication

**Pattern**: Many services have similar Caddy configurations.

**Example**: cockpit.caddy.njk and edgetts.caddy.njk both use `m.reverseProxy()` macro.

**Current State**: Acceptable - macros handle most duplication.

**Recommendation**: No action needed, macro approach is clean.

---

### 6.3. Conditional Logic Complexity

**Issue**: Some conditionals span multiple concerns.

**Example**:
```njk
{% if service.enabled_by and openwebui.features.image_generation and service.external_subdomain %}
```

**Problem**: Mixes service enablement, feature flags, and infrastructure config.

**Recommendation**: Simplify to single responsibility where possible.

---

## 7. Questions for Consolidation Agent (Agent 4)

1. **EdgeTTS Scope**: Include in v0.0.1 or defer to v0.1.0?

2. **Volume Configuration**: Which approach (A/B/C from 5.1)?

3. **Image Field**: Remove from infrastructure or keep as override option?

4. **Service Categories**: Worth adding to schema for organization?

5. **Nested vs Flat**: Keep flat provider_config or nest by provider?

6. **Health Check Params**: Expose as advanced tuning or keep hardcoded?

7. **ComfyUI/OpenWebUI Coupling**: How to handle feature flag dependencies between services?

---

## 8. Summary

### Issues by Severity

**Critical** (breaks validation):
- Missing `description` field in infrastructure
- Volume fields referenced but not defined

**High** (architectural issues):
- ComfyUI uses `openwebui.features.image_generation` (wrong path)
- EdgeTTS scope ambiguity

**Medium** (nice to have):
- Missing pattern/range validation
- WebSocket flag not standardized

**Low** (documentation):
- Special cases not documented
- Service categories not defined

### Effort Estimate

- **Fix Critical Issues**: 1-2 hours
- **Fix High Issues**: 2-3 hours
- **Add Validation**: 2-4 hours
- **Documentation**: 1-2 hours

**Total**: 6-11 hours of schema work

---

## Agent 3 Sign-off

All issues identified have been documented with:
- ✓ Evidence from templates
- ✓ Impact analysis
- ✓ Specific recommendations
- ✓ Implementation examples

Ready for Agent 4 consolidation and conflict resolution.
