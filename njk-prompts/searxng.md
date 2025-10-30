# Claude Code Prompt: Convert SearXNG Service

## Task
Convert searxng meta search engine (+ redis) to Nunjucks and add to appstore.

## Services Info

### searxng-redis (satellite service)
```json
"searxng_redis": {
  "hostname": "searxng-redis",
  "container_name": "searxng-redis",
  "port": 6379,
  "published_port": null,
  "image": "docker.io/redis:latest",
  "volume": "searxng-redis.volume",
  "enabled_by": ["openwebui.providers.web_search_engine == 'searxng'"]
}
```

### searxng (main service)
```json
"searxng": {
  "hostname": "searxng",
  "container_name": "searxng",
  "port": 8080,
  "published_port": 8888,
  "image": "docker.io/searxng/searxng:latest",
  "external_subdomain": "search",
  "enabled_by": ["openwebui.providers.web_search_engine == 'searxng'"],
  "requires": ["searxng_redis"],
  "websocket": false,
  "description": "SearXNG Meta Search Engine",
  "volume": "searxng.volume"
}
```

## Files

1. `searxng-redis.container.tmpl` → `appstore/searxng/searxng-redis.container.njk`
2. `searxng.container.tmpl` → `appstore/searxng/searxng.container.njk`
3. `searxng.caddy.tmpl` → `appstore/searxng/searxng.caddy.njk`
4. `searxng/settings.yml.tmpl` → `appstore/searxng/settings.yml.njk`

## Key Points

### Conditional Enabling
Both services use same condition:
```nunjucks
{% if openwebui.providers.web_search_engine == 'searxng' %}
```

### Dependencies
searxng depends on searxng-redis:
```nunjucks
{% block dependencies %}
After={{ infrastructure.services.searxng_redis.container_name }}.service
{% endblock %}
```

### Settings File
Generate from `searxng` config section:

```nunjucks
use_default_settings: true

server:
  secret_key: "{{ secrets.searxng_secret | default('changeme') }}"
  
redis:
  url: {{ searxng.redis_url }}

search:
  safe_search: {{ searxng.safe_search }}
  autocomplete: "{{ searxng.autocomplete }}"

engines:
{% for engine in searxng.engines %}
  - name: {{ engine.name }}
    disabled: {{ not engine.enabled | lower }}
{% endfor %}
```

## Satellite Pattern

This demonstrates your heuristic: searxng gets its own redis, isolated from other services.

---

**Four files: redis + main + caddy + settings.**
