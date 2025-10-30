# Claude Code Prompt: Convert Remaining Services

## 1. Tika (Document Extraction)

### Service Info
```json
"tika": {
  "hostname": "tika",
  "container_name": "tika",
  "port": 9998,
  "published_port": null,
  "image": "docker.io/apache/tika:latest-full",
  "enabled_by": ["openwebui.providers.content_extraction == 'tika'"],
  "websocket": false,
  "description": "Apache Tika Content Extraction",
  "heap_size": "8g"
}
```

### Files
- `tika.container.tmpl` → `appstore/tika/tika.container.njk`

### Key Points
- **Conditional:** `openwebui.providers.content_extraction == 'tika'`
- **No published port:** Internal only
- **No Caddy route:** Internal service
- **Heap size:** Environment variable JAVA_OPTS

---

## 2. Qdrant (Vector Database)

### Service Info
```json
"qdrant": {
  "hostname": "qdrant",
  "container_name": "qdrant",
  "port": 6333,
  "grpc_port": 6334,
  "published_port": 6333,
  "image": "docker.io/qdrant/qdrant:latest",
  "external_subdomain": "qdrant",
  "enabled_by": ["openwebui.providers.vector_db == 'qdrant'"],
  "websocket": false,
  "description": "Qdrant Vector Database",
  "volume": "qdrant.volume"
}
```

### Files
- `qdrant.container.tmpl` → `appstore/qdrant/qdrant.container.njk`
- `qdrant.caddy.tmpl` → `appstore/qdrant/qdrant.caddy.njk`

### Key Points
- **Conditional:** `openwebui.providers.vector_db == 'qdrant'`
- **Two ports:** HTTP (6333) + gRPC (6334)
- **Published port:** Dashboard accessible
- **External access:** Via Caddy

---

## 3. Cockpit (System Management)

### Service Info
```json
"cockpit": {
  "hostname": "blueprint",
  "container_name": "cockpit-ws",
  "port": 9090,
  "published_port": 9090,
  "bind": "127.0.0.1",
  "image": "quay.io/cockpit/ws:latest",
  "external_subdomain": "",
  "enabled": true,
  "websocket": true,
  "description": "System Management Dashboard"
}
```

### Files
- `cockpit.container.tmpl` → `appstore/cockpit/cockpit.container.njk`
- `cockpit.caddy.tmpl` → `appstore/cockpit/cockpit.caddy.njk` (if exists)

### Key Points
- **Always enabled:** No conditional
- **Root domain:** external_subdomain is empty (goes to root)
- **WebSocket:** Required for real-time terminal
- **Host interaction:** May need special privileges

---

## 4. MCP (Model Context Protocol)

### Service Info
```json
"mcp": {
  "hostname": "mcp",
  "container_name": "mcp",
  "port": 8000,
  "published_port": null,
  "image": "ghcr.io/open-webui/mcpo:latest",
  "enabled": true,
  "websocket": false,
  "description": "Model Context Protocol Server",
  "config_file": "mcp/config.json"
}
```

### Files
- `mcp.container.tmpl` → `appstore/mcp/mcp.container.njk`

### Key Points
- **Always enabled:** No conditional
- **Internal only:** No published port
- **Config file:** Needs config.json mounted

---

## Conversion Order

1. **Tika** - Simplest (no caddy, no deps)
2. **Qdrant** - Moderate (conditional, dual ports)
3. **MCP** - Simple (internal service)
4. **Cockpit** - Complex (WebSocket, system access)

---

**Use whisper/edgetts as templates for these.**
