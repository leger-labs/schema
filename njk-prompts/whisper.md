# Claude Code Prompt: Convert Whisper Service

## Task
Convert whisper speech-to-text service to Nunjucks and add to appstore.

## Context

**Your completed examples to reference:**
- `oct-projects/njk/base-container.njk` - Template inheritance pattern
- `oct-projects/njk/macros.njk` - Reusable components  
- `oct-projects/njk/litellm.container.njk` - Similar service example
- `oct-projects/njk/openwebui.caddy.njk` - Caddy route pattern

**Service info from blueprint-config.json:**
```json
"whisper": {
  "hostname": "whisper",
  "container_name": "whisper",
  "port": 8000,
  "published_port": 8765,
  "bind": "127.0.0.1",
  "image": "docker.io/fedirz/faster-whisper-server:latest-cpu",
  "external_subdomain": "whisper",
  "enabled_by": ["openwebui.features.speech_to_text"],
  "websocket": false,
  "description": "Whisper Speech-to-Text Service",
  "volume": "whisper-cache.volume"
}
```

## Files to Convert

1. **Source:** `home/dot_config/containers/systemd/whisper.container.tmpl`
   **Output:** `leger-run/appstore/whisper/whisper.container.njk`

2. **Source:** `home/dot_config/containers/systemd/whisper.caddy.tmpl` (if exists)
   **Output:** `leger-run/appstore/whisper/whisper.caddy.njk`

## Conversion Steps

### Step 1: Run Automated Conversion

```bash
cd ~/oct-projects/njk
./convert-to-nunjucks.sh ~/home/dot_config/containers/systemd/whisper.container.tmpl
```

Review the output whisper.container.njk file.

### Step 2: Apply Template Inheritance

Transform to extend base template:

```nunjucks
{% extends "base-container.njk" %}

{% set service = infrastructure.services.whisper %}
{% set description = service.description %}
{% set image = service.image %}
{% set container_name = service.container_name %}
{% set port = service.port %}
{% set published_port = service.published_port %}
{% set bind = service.bind %}
```

### Step 3: Add Conditional Enabling

This service is conditional based on feature flag:

```nunjucks
{% if openwebui.features.speech_to_text %}
{# Service content here #}
{% endif %}
```

### Step 4: Use Macros

```nunjucks
{% import "macros.njk" as m %}

{# In volumes block #}
{% block volumes %}
{{ m.volumeMount(service.volume, "/root/.cache/huggingface") }}
{% endblock %}

{# In health check block #}
{% block health_check %}
{{ m.healthCheck(service.port, "/health") }}
{% endblock %}
```

### Step 5: Create Caddy Route

Pattern from openwebui.caddy.njk:

```nunjucks
{% set service = infrastructure.services.whisper %}
{% if service.enabled and service.external_subdomain %}

https://{{ service.external_subdomain }}.{{ tailscale.full_hostname }} {
    reverse_proxy {{ service.hostname }}:{{ service.port }} {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    
    log {
        output file /var/log/caddy/whisper.log
        level ERROR
    }
}

{% endif %}
```

## Deliverables

Create in `leger-run/appstore/whisper/`:

1. **whisper.container.njk** - Converted container quadlet
2. **whisper.caddy.njk** - Caddy reverse proxy route
3. **README.md** - Brief documentation:
   ```markdown
   # Whisper Speech-to-Text
   
   OpenAI-compatible speech-to-text service using faster-whisper.
   
   ## Dependencies
   - Network: llm.network
   - Volume: whisper-cache.volume
   - Enabled by: openwebui.features.speech_to_text
   
   ## Endpoints
   - Internal: http://whisper:8000
   - External: https://whisper.blueprint.tail8dd1.ts.net
   - Published: 127.0.0.1:8765
   
   ## Config from blueprint-config.json
   See whisper section for model settings.
   ```

## Validation

```bash
cd ~/repos/appstore

# Test rendering
nunjucks-cli whisper/whisper.container.njk -p reference/blueprint-config.json

# Check output is valid Quadlet
```

## Commit

```bash
git add whisper/
git commit -m "Add whisper speech-to-text service

- Convert from Go templates to Nunjucks
- Conditional enabling via feature flag
- OpenAI-compatible API endpoints"
```

---

**Start by reading the source .tmpl file and showing current structure.**
