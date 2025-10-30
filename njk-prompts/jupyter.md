# Claude Code Prompt: Convert Jupyter Service

## Task
Convert jupyter code interpreter to Nunjucks and add to appstore.

## Service Info

```json
"jupyter": {
  "hostname": "jupyter",
  "container_name": "jupyter",
  "port": 8888,
  "published_port": 8889,
  "bind": "127.0.0.1",
  "image": "localhost/blueprint-jupyter:latest",
  "external_subdomain": "jupyter",
  "enabled_by": ["openwebui.features.code_execution"],
  "requires": ["litellm"],
  "websocket": true,
  "description": "Blueprint Jupyter Lab - AI Code Interpreter",
  "volume": "jupyter.volume",
  "workspace": "/home/jovyan/blueprint-workspace"
}
```

## Key Differences

- **Custom image:** `localhost/blueprint-jupyter:latest` (you build this)
- **Dependency:** Requires litellm to be running
- **WebSocket:** Enable in Caddy route
- **Workspace:** Custom mount point for notebooks

## Dependencies Block

```nunjucks
{% block dependencies %}
After={{ infrastructure.services.litellm.container_name }}.service
{% endblock %}

{% block wants_dependencies %}
Wants={{ infrastructure.services.litellm.container_name }}.service
{% endblock %}
```

## Caddy Route

Include WebSocket support:

```nunjucks
reverse_proxy {{ service.hostname }}:{{ service.port }} {
    # Standard headers
    header_up Host {host}
    # ... etc
    
    {% if service.websocket %}
    # WebSocket support
    header_up Connection {>Connection}
    header_up Upgrade {>Upgrade}
    {% endif %}
}
```

## Files

1. `jupyter.container.tmpl` → `appstore/jupyter/jupyter.container.njk`
2. `jupyter.caddy.tmpl` → `appstore/jupyter/jupyter.caddy.njk`

---

**Remember: depends on litellm, requires WebSocket, custom image.**
