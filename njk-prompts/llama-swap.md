# Claude Code Prompt: Convert Llama-Swap Service

## Task
Convert llama-swap local model router to Nunjucks and add to appstore.

## Service Info

```json
"llama_swap": {
  "hostname": "llama-swap",
  "container_name": "llama-swap",
  "port": 8080,
  "published_port": 9292,
  "bind": "127.0.0.1",
  "image": "ghcr.io/mostlygeek/llama-swap:cpu",
  "external_subdomain": "llama-swap",
  "websocket": true,
  "enabled": true,
  "volume": "llama-swap.volume",
  "description": "Local LLM Model Router"
}
```

## Files

1. `llama-swap.container.tmpl` → `appstore/llama-swap/llama-swap.container.njk`
2. `llama-swap.caddy.tmpl` → `appstore/llama-swap/llama-swap.caddy.njk`
3. `llama-swap/config.yml.tmpl` → `appstore/llama-swap/config.yml.njk`

## Config File

The config.yml.njk should generate model definitions from `local_inference.models`:

```nunjucks
models:
{% for key, model in local_inference.models %}
{% if model.enabled and model.group != "embeddings" %}
  - name: {{ model.name }}
    uri: {{ model.model_uri }}
    ctx_size: {{ model.ctx_size }}
    ttl: {{ model.ttl }}
    {% if model.group == "heavy" %}
    swap_group: {{ model.group }}
    {% endif %}
{% endif %}
{% endfor %}
```

## Key Features

- **Model swapping:** Heavy models swap, task models stay loaded
- **WebSocket:** Required for streaming responses
- **Config mount:** Volume mount the generated config.yml

## Volume Block

```nunjucks
{% block volumes %}
{{ m.volumeMount(service.volume, "/data") }}
{{ m.hostMount("%h/.config/llama-swap/config.yml", "/app/config.yml", readonly=true) }}
{% endblock %}
```

---

**Three files total: container + caddy + config.**
