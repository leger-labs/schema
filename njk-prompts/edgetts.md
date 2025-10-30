# Claude Code Prompt: Convert EdgeTTS Service

## Task
Convert edgetts text-to-speech service to Nunjucks and add to appstore.

## Service Info

```json
"edgetts": {
  "hostname": "edgetts",
  "container_name": "edgetts",
  "port": 5050,
  "published_port": 5050,
  "bind": "127.0.0.1",
  "image": "ghcr.io/traefik/parakeet:latest",
  "external_subdomain": "tts",
  "enabled_by": ["openwebui.features.text_to_speech"],
  "websocket": false,
  "description": "Edge-TTS Text-to-Speech Service",
  "volume": "edgetts-cache.volume"
}
```

## Files

1. `home/dot_config/containers/systemd/edgetts.container.tmpl` → `appstore/edgetts/edgetts.container.njk`
2. `home/dot_config/containers/systemd/edgetts.caddy.tmpl` → `appstore/edgetts/edgetts.caddy.njk`

## Key Points

- **Conditional:** Enabled by `openwebui.features.text_to_speech`
- **No WebSocket:** Simple HTTP reverse proxy
- **Voice config:** References `edgetts.models.tts-1` from blueprint-config.json
- **Cache volume:** Store voice synthesis cache

## Pattern

Same as whisper - extend base template, use macros, conditional enabling.

## Validation

Should render OpenAI-compatible TTS endpoint at http://edgetts:5050/v1

---

**Convert following whisper pattern.**
