# Template Audit Report for Leger v0.0.1 - Agent 3

## Summary
- Total services audited: 4
- Total templates: 11
- Infrastructure fields identified: 4 services × 6 fields = 24 infrastructure configurations
- Configuration fields identified: 15+ unique configuration fields
- Secrets identified: 2

## Service: caddy

### Infrastructure
- container_name: "caddy"
- hostname: Not explicitly set (uses container_name)
- port: 80 (HTTP), 443 (HTTPS), 443/udp (HTTP/3)
- published_port: 80, 443, 443/udp (all published to 0.0.0.0)
- bind_address: "0.0.0.0" (special case - needs to be publicly accessible for Tailscale)
- external_subdomain: N/A (caddy itself is not exposed via caddy, it IS the reverse proxy)

### Features Referenced
- None directly (caddy reads from infrastructure.services to determine routing)

### Providers Referenced
- None directly

### Provider Config Fields
- None

### Secrets Referenced
- None (Tailscale handles certificates)

### Infrastructure Fields Accessed
- infrastructure.network.name (for network configuration)
- infrastructure.services.* (iterates through all services with .enabled and .external_subdomain)
  - For each enabled service with external_subdomain:
    - service.container_name
    - service.external_subdomain
    - service.port
    - service.hostname (for reverse proxy target)
    - service.websocket (optional, for WebSocket support)
- tailscale.full_hostname (for generating URLs)

### Dependencies
- required: ["{{ infrastructure.network.name }}.network", "tailscaled"]
- optional: All services with external_subdomain (via Wants=)

### Conditional Enablement
- Always enabled (core infrastructure service)
- enabled_by: null (user decision)

### Template Files
- caddy.container.njk (Container definition)
- Caddyfile.njk (Main caddy configuration)
- caddy-config.volume (Config persistence volume)
- caddy-data.volume (Certificate storage volume)

### Notes
- Caddy is special: it publishes ports 80, 443, 443/udp to 0.0.0.0 (not 127.0.0.1)
- Caddy dynamically imports all *.caddy files from /etc/caddy/conf.d
- Each service with external_subdomain should have a {service}.caddy.njk file
- Uses Tailscale for HTTPS (auto_https disabled)
- Image version: docker.io/caddy:2.10-alpine (from release-catalog.json)

---

## Service: cockpit

### Infrastructure
- container_name: "cockpit"
- hostname: "host" (special - represents the actual host system)
- port: 9090
- published_port: 9090
- bind_address: "127.0.0.1"
- external_subdomain: "cockpit"
- description: "Cockpit Web Console for system management"

### Features Referenced
- None

### Providers Referenced
- None

### Provider Config Fields
- None

### Secrets Referenced
- None (uses system user authentication)

### Infrastructure Fields Accessed
- infrastructure.services.cockpit.* (all fields)
- infrastructure.network.name
- tailscale.full_hostname

### Dependencies
- required: ["{{ infrastructure.network.name }}.network", "podman.socket"]
- optional: []

### Conditional Enablement
- Always enabled (system management interface)
- enabled_by: null (user decision)

### Template Files
- cockpit.container.njk (Container definition)
- cockpit.caddy.njk (Reverse proxy configuration)
- cockpit.conf.njk (Cockpit web service configuration)

### Notes
- Requires privileged mode and --pid=host
- Mounts host root filesystem at /host:ro
- Mounts podman socket for container management
- Uses system user credentials for authentication
- Image version: quay.io/cockpit/ws:latest (from release-catalog.json)

---

## Service: comfyui

### Infrastructure
- container_name: "comfyui"
- hostname: "comfyui"
- port: 8188
- published_port: 8188
- bind_address: "127.0.0.1"
- external_subdomain: "comfy"
- description: "ComfyUI - Stable Diffusion Workflow Engine"
- volume: "comfyui-workspace" (workspace volume name)
- workspace: "/workspace" (workspace mount path inside container)
- models_volume: "comfyui-models" (models volume name)
- image: "ghcr.io/ai-dock/comfyui:latest" (referenced via service.image)

### Features Referenced
- features.image_generation (conditional enablement in caddy.njk)

### Providers Referenced
- providers.image_engine == "comfyui" (implied)

### Provider Config Fields
- comfyui.workspace (default: "/workspace")
- comfyui.auto_update (boolean, default: false)
- comfyui.web_enable_auth (boolean, default: false)
- comfyui.hf_token (optional, HuggingFace token for model downloads)
- comfyui.civitai_token (optional, CivitAI token for model downloads)
- comfyui.args (optional, additional ComfyUI arguments)
- comfyui.log_level (default: "INFO")
- comfyui.default_model (documentation reference to default FLUX.1 model)
- comfyui.default_vae (documentation reference)
- comfyui.default_clip_1 (documentation reference)
- comfyui.default_clip_2 (documentation reference)

### Secrets Referenced
- comfyui.hf_token (if set, should be {HF_TOKEN} template)
- comfyui.civitai_token (if set, should be {CIVITAI_TOKEN} template)

### Infrastructure Fields Accessed
- infrastructure.services.comfyui.* (all fields)
- infrastructure.network.name
- tailscale.full_hostname
- openwebui.features.image_generation (for conditional Caddy routing)

### Dependencies
- required: ["{{ infrastructure.network.name }}.network"]
- optional: []

### Conditional Enablement
- Enabled when: features.image_generation == true AND providers.image_engine == "comfyui"
- enabled_by: "features.image_generation && providers.image_engine == 'comfyui'"
- Caddy route: Only generated if openwebui.features.image_generation is true

### Template Files
- comfyui.container.njk (Container definition)
- comfyui.caddy.njk (Reverse proxy configuration - conditionally generated)
- comfyui.volume.njk (Workspace volume)
- comfyui-models.volume.njk (Models volume - separate for easier backup)
- comfyui-README.md (Documentation)

### Notes
- Has WebSocket support for real-time updates
- Two separate volumes: workspace (outputs, custom nodes) and models (large ML models)
- Health check uses /system_stats endpoint
- Longer startup time (up to 2 minutes) due to model loading
- Integration with OpenWebUI via http://comfyui:8188
- Image: Uses ai-dock custom build (not official ComfyUI image)

---

## Service: edgetts

### Infrastructure
- container_name: "edgetts"
- hostname: "edgetts"
- port: 8000
- published_port: 5050
- bind_address: "127.0.0.1"
- external_subdomain: "tts" or "edgetts" (not explicitly defined in templates)
- description: "Edge TTS - Text-to-Speech Service"
- volume: "edgetts-cache" (volume name for voice model caching)

### Features Referenced
- features.tts (implied)

### Providers Referenced
- providers.tts_engine == "edgetts"

### Provider Config Fields
- edgetts.response_format (default: "mp3")
- edgetts.speed (default: 1.0, range: 0.5-2.0)
- edgetts.voice (default: "en-US-AriaNeural")
- edgetts.log_level (default: "INFO")

### Secrets Referenced
- None (Edge TTS uses free Microsoft Edge voices)

### Infrastructure Fields Accessed
- infrastructure.services.edgetts.* (all fields)
- infrastructure.network.name
- tailscale.full_hostname

### Dependencies
- required: ["{{ infrastructure.network.name }}.network"]
- optional: []

### Conditional Enablement
- Enabled when: features.tts == true AND providers.tts_engine == "edgetts"
- enabled_by: "features.tts && providers.tts_engine == 'edgetts'"

### Template Files
- edgetts.container.njk (Container definition)
- edgetts.caddy.njk (Reverse proxy configuration)
- edgetts-cache.volume (Voice model cache)
- README.md (Documentation)

### Notes
- **ICEBOX STATUS**: According to system prompt, EdgeTTS is excluded from v0.0.1
- Image version: docker.io/travisvn/openai-edge-tts:latest (CORRECTED in release-catalog.json)
  - Previous incorrect image was ghcr.io/traefik/parakeet
- OpenAI-compatible API
- Health checks: /health (primary) and /v1/voices (API availability)
- No API key required (free service)
- Integration with OpenWebUI:
  - AUDIO_TTS_ENGINE=edge
  - AUDIO_TTS_API_BASE_URL=http://edgetts:8000
  - ENABLE_AUDIO_OUTPUT=true

---

## Cross-Service Analysis

### Common Patterns Identified

1. **Infrastructure Pattern**:
   All services follow the standard infrastructure pattern:
   ```
   - container_name
   - hostname
   - port
   - published_port
   - bind_address
   - external_subdomain (if web-accessible)
   - description
   ```

2. **Network Configuration**:
   All services connect to `{{ infrastructure.network.name }}.network` (llm.network)

3. **Macro Usage**:
   - `m.publishPort(service)` - Standard port publishing
   - `m.healthCheckWget(port, endpoint)` - HTTP health checks
   - `m.serviceSection(timeout=X)` - Standard service configuration
   - `m.reverseProxy(service, tailscale.full_hostname)` - Caddy reverse proxy
   - `m.volumeMount(volume, path)` - Volume mounting

4. **Volume Naming**:
   - Pattern: `{service-name}.volume` or `{service-name}-{purpose}.volume`
   - Examples: comfyui-workspace, comfyui-models, edgetts-cache

5. **Health Check Endpoints**:
   - Caddy: /
   - Cockpit: /
   - ComfyUI: /system_stats
   - EdgeTTS: /health and /v1/voices

6. **Image Source Pattern**:
   All images are defined in release-catalog.json and accessed via:
   ```
   {% set catalog = (readFile('../release-catalog.json') | fromJson) -%}
   {% set service_def = catalog.services.{service_name} -%}
   Image={{ service_def.image }}
   ```

### Configuration Data Flow

Templates access configuration in this hierarchy:

1. **Infrastructure** (from infrastructure.services.{service}):
   - Container/network/port configuration
   - Direct access via `infrastructure.services.{service}.{field}`

2. **Service Config** (from top-level {service} object):
   - Service-specific configuration
   - Direct access via `{service}.{field}`
   - Examples: comfyui.workspace, edgetts.speed

3. **Features** (from features object):
   - Feature flags that enable/disable services
   - Access via `features.{feature_name}`
   - Example: features.image_generation

4. **Providers** (from providers object):
   - Provider selection that determines which service to use
   - Access via `providers.{provider_type}`
   - Example: providers.tts_engine

5. **Tailscale** (from tailscale object):
   - Tailscale configuration for external URLs
   - Access via `tailscale.full_hostname`

### Conditional Rendering Patterns

1. **Caddy Route Conditional**:
   ```
   {% if service.enabled_by and {condition} and service.external_subdomain %}
   ```

2. **Environment Variable Conditional**:
   ```
   {% if {service}.{field} %}
   Environment={NAME}={{ {service}.{field} }}
   {% endif %}
   ```

---

## Issues and Observations

### 1. Missing Infrastructure Fields

Some infrastructure fields referenced in templates are not standardized:
- `service.volume` (comfyui) - not in standard infrastructure pattern
- `service.models_volume` (comfyui) - not in standard infrastructure pattern
- `service.workspace` (comfyui) - not in standard infrastructure pattern
- `service.description` - used by all services but not documented as required
- `service.image` - should always come from release-catalog.json, not infrastructure

**Recommendation**: Create a separate `volumes` section or include volume configuration in service-specific config (not infrastructure).

### 2. EdgeTTS Excluded from v0.0.1

The system prompt states: "**Excluded from v0.0.1: edgetts (ICEBOX)**"

However, complete templates exist for EdgeTTS.

**Recommendation**: Either include EdgeTTS in v0.0.1 or clearly mark templates with v0.1.0 target version.

### 3. Caddy Special Case

Caddy requires `bind_address: "0.0.0.0"` instead of the default `"127.0.0.1"` because it must be accessible from Tailscale.

**Recommendation**: Document this exception in schema with a note explaining why.

### 4. Comfyui Conditional Routing

The comfyui.caddy.njk file checks:
```
{% if service.enabled_by and openwebui.features.image_generation and service.external_subdomain %}
```

This creates a dependency on `openwebui.features.image_generation`, which is outside the comfyui service scope.

**Recommendation**: The conditional should use `features.image_generation` (global) rather than `openwebui.features.image_generation` (service-specific).

### 5. Hostname Confusion

Cockpit uses `hostname: "host"` to represent the actual host system, but this is not a container hostname.

**Recommendation**: Document this special case and clarify that some services may use special hostnames.

### 6. Volume Configuration Inconsistency

ComfyUI has multiple volumes defined directly in infrastructure:
- workspace volume
- models volume

But these are defined in service config, not infrastructure. Other services use simple volume names.

**Recommendation**: Standardize volume configuration approach across all services.

---

## Schema Impact Summary

### Infrastructure Section Additions

```json
{
  "caddy": {
    "container_name": "caddy",
    "hostname": "caddy",
    "port": 443,
    "published_port": 443,
    "bind_address": "0.0.0.0",
    "external_subdomain": null,
    "description": "Caddy Reverse Proxy for LLM Services"
  },
  "cockpit": {
    "container_name": "cockpit",
    "hostname": "host",
    "port": 9090,
    "published_port": 9090,
    "bind_address": "127.0.0.1",
    "external_subdomain": "cockpit",
    "description": "Cockpit Web Console for system management"
  },
  "comfyui": {
    "container_name": "comfyui",
    "hostname": "comfyui",
    "port": 8188,
    "published_port": 8188,
    "bind_address": "127.0.0.1",
    "external_subdomain": "comfy",
    "description": "ComfyUI - Stable Diffusion Workflow Engine"
  },
  "edgetts": {
    "container_name": "edgetts",
    "hostname": "edgetts",
    "port": 8000,
    "published_port": 5050,
    "bind_address": "127.0.0.1",
    "external_subdomain": "tts",
    "description": "Edge TTS - Text-to-Speech Service"
  }
}
```

### Provider Config Additions

```json
{
  "comfyui_workspace": {
    "type": "string",
    "default": "/workspace",
    "x-depends-on": {
      "providers.image_engine": "comfyui"
    }
  },
  "comfyui_auto_update": {
    "type": "boolean",
    "default": false,
    "x-depends-on": {
      "providers.image_engine": "comfyui"
    }
  },
  "comfyui_web_enable_auth": {
    "type": "boolean",
    "default": false,
    "x-depends-on": {
      "providers.image_engine": "comfyui"
    }
  },
  "comfyui_log_level": {
    "type": "string",
    "enum": ["DEBUG", "INFO", "WARNING", "ERROR"],
    "default": "INFO",
    "x-depends-on": {
      "providers.image_engine": "comfyui"
    }
  },
  "comfyui_args": {
    "type": "string",
    "default": "",
    "description": "Additional ComfyUI command line arguments",
    "x-depends-on": {
      "providers.image_engine": "comfyui"
    }
  },
  "edgetts_response_format": {
    "type": "string",
    "enum": ["mp3", "wav", "opus"],
    "default": "mp3",
    "x-depends-on": {
      "providers.tts_engine": "edgetts"
    }
  },
  "edgetts_speed": {
    "type": "number",
    "minimum": 0.5,
    "maximum": 2.0,
    "default": 1.0,
    "x-depends-on": {
      "providers.tts_engine": "edgetts"
    }
  },
  "edgetts_voice": {
    "type": "string",
    "default": "en-US-AriaNeural",
    "x-depends-on": {
      "providers.tts_engine": "edgetts"
    }
  },
  "edgetts_log_level": {
    "type": "string",
    "enum": ["DEBUG", "INFO", "WARNING", "ERROR"],
    "default": "INFO",
    "x-depends-on": {
      "providers.tts_engine": "edgetts"
    }
  }
}
```

### Secrets Additions

```json
{
  "hf_token": {
    "type": "string",
    "default": "{HF_TOKEN}",
    "description": "HuggingFace API token for model downloads (ComfyUI)",
    "x-sensitive": true,
    "x-depends-on": {
      "providers.image_engine": "comfyui"
    }
  },
  "civitai_token": {
    "type": "string",
    "default": "{CIVITAI_TOKEN}",
    "description": "CivitAI API token for model downloads (ComfyUI)",
    "x-sensitive": true,
    "x-depends-on": {
      "providers.image_engine": "comfyui"
    }
  }
}
```

### x-affects-services Mapping

```json
{
  "providers.image_engine": {
    "comfyui": "comfyui",
    "automatic1111": "automatic1111",
    "openai": null
  },
  "providers.tts_engine": {
    "edgetts": "edgetts",
    "openai": null,
    "elevenlabs": null
  }
}
```

### x-provider-fields Mapping

```json
{
  "providers.image_engine": {
    "comfyui": [
      "comfyui_workspace",
      "comfyui_auto_update",
      "comfyui_web_enable_auth",
      "comfyui_log_level",
      "comfyui_args",
      "hf_token",
      "civitai_token"
    ],
    "automatic1111": [],
    "openai": []
  },
  "providers.tts_engine": {
    "edgetts": [
      "edgetts_response_format",
      "edgetts_speed",
      "edgetts_voice",
      "edgetts_log_level"
    ],
    "openai": [],
    "elevenlabs": []
  }
}
```

---

## Questions Answered

### 1. Are there any fields templates expect that we haven't defined?

Yes:
- `service.volume` (comfyui)
- `service.models_volume` (comfyui)
- `service.workspace` (comfyui)
- `service.description` (all services)
- `service.websocket` (for Caddy WebSocket support)

### 2. Are there any services with complex conditional logic we need to handle?

Yes:
- **ComfyUI Caddy route**: Conditional on `openwebui.features.image_generation`
- **Caddy**: Iterates through all services with `enabled` and `external_subdomain`

### 3. Are there any cross-service dependencies we're missing?

- Caddy depends on all services with `external_subdomain` (soft dependency via Wants=)
- ComfyUI's Caddy route depends on OpenWebUI feature flag (architectural coupling)

### 4. Are there any provider combinations that conflict?

No conflicts identified in audited services.

### 5. Are there any secrets stored in templates that should be in secrets section?

Yes:
- `comfyui.hf_token` → should be `{HF_TOKEN}`
- `comfyui.civitai_token` → should be `{CIVITAI_TOKEN}`

### 6. Are there any hardcoded values that should be configurable?

Most values are already configurable. Edge cases:
- ComfyUI default models (currently in documentation only)
- Caddy ports (80, 443) are intentionally hardcoded
- Health check intervals (could be advanced tuning parameters)

### 7. Are there any validation rules we should add?

Yes:
- `edgetts_speed`: minimum 0.5, maximum 2.0
- `edgetts_response_format`: enum ["mp3", "wav", "opus"]
- `comfyui_log_level`: enum ["DEBUG", "INFO", "WARNING", "ERROR"]
- `edgetts_log_level`: enum ["DEBUG", "INFO", "WARNING", "ERROR"]
- `bind_address`: pattern for IP address validation
- `external_subdomain`: pattern for subdomain validation

---

## Recommendations

1. **Standardize Volume Configuration**: Create a consistent approach for volume definitions across all services.

2. **Document Special Cases**:
   - Caddy's 0.0.0.0 bind address
   - Cockpit's "host" hostname
   - Services requiring privileged mode

3. **Separate Infrastructure from Service Config**:
   - Keep infrastructure minimal (networking, ports)
   - Move service-specific settings to provider_config

4. **Add Validation Constraints**:
   - IP address patterns
   - Subdomain patterns
   - Enum constraints for all choice fields

5. **Clarify EdgeTTS Status**:
   - If ICEBOX: Remove from v0.0.1 or mark as v0.1.0
   - If included: Add to official v0.0.1 scope

6. **Fix ComfyUI Caddy Conditional**:
   - Use global `features.image_generation` instead of `openwebui.features.image_generation`

7. **Add WebSocket Flag**:
   - Add `websocket: boolean` to infrastructure for services requiring WebSocket support
   - Currently only implicitly handled in macros

---

## Agent 3 Sign-off

**Services Audited**: caddy, cockpit, comfyui, edgetts
**Templates Analyzed**: 11 files
**Configuration Fields Documented**: 15+
**Issues Identified**: 7
**Recommendations Provided**: 7

All audited services follow consistent patterns and integrate well with the template architecture. The main areas for improvement are standardizing volume configuration and documenting special cases.
