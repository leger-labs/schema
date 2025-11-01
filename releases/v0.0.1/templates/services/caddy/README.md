# Caddy Reverse Proxy

Automatic HTTPS reverse proxy with Tailscale integration for all LLM stack services.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Service Routes](#service-routes)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

---

## Overview

Caddy serves as the central reverse proxy for the entire LLM infrastructure stack. It provides:
- Automatic HTTPS via Tailscale certificates
- Reverse proxy for all web-accessible services
- WebSocket support for real-time services
- Rate limiting and security headers

**Container:** `caddy`
**Network:** `llm.network` (10.89.0.0/24)
**Ports:** HTTP (80), HTTPS (443)
**Image:** `docker.io/caddy:latest`

---

## Features

- 🔒 **Automatic HTTPS** - Tailscale certificates for secure access
- 🌐 **Multi-Service Proxy** - Routes for OpenWebUI, LiteLLM, Jupyter, etc.
- 🔌 **WebSocket Support** - Real-time connections for chat interfaces
- 🛡️ **Security** - Built-in rate limiting and security headers
- 📊 **Auto-Discovery** - Dynamically generates routes from blueprint-config.json
- 🔄 **Auto-Reload** - Configuration updates without service restart

---

## Quick Start

### 1. Verify Configuration

Caddy is configured via `blueprint-config.json`. No manual setup required!

### 2. Enable and Start Service

```bash
# Reload systemd to pick up the quadlet
systemctl --user daemon-reload

# Enable the service
systemctl --user enable caddy.service

# Start the service
systemctl --user start caddy.service

# Check status
systemctl --user status caddy.service
```

### 3. Access Services

Caddy automatically routes to all enabled services:

- **Open WebUI:** https://ai.blueprint.tail8dd1.ts.net
- **LiteLLM:** https://llm.blueprint.tail8dd1.ts.net
- **Jupyter:** https://jupyter.blueprint.tail8dd1.ts.net
- **SearXNG:** https://search.blueprint.tail8dd1.ts.net
- **Qdrant:** https://qdrant.blueprint.tail8dd1.ts.net

*(URLs based on your Tailscale configuration)*

---

## Configuration

### blueprint-config.json

Caddy automatically discovers services from the configuration. Each service with `external_subdomain` gets a route:

```json
{
  "infrastructure": {
    "services": {
      "openwebui": {
        "external_subdomain": "ai",
        "port": 8080,
        "published_port": 3000,
        "websocket": true,
        "enabled": true
      }
    }
  }
}
```

### Caddyfile Generation

The main `Caddyfile.njk` template:
1. Loops through all enabled services
2. Imports service-specific Caddy configurations
3. Generates reverse proxy rules automatically

### Service-Specific Routes

Each service can have its own Caddy configuration file:
- `openwebui.caddy.njk` - Open WebUI route with WebSocket
- `litellm.caddy.njk` - LiteLLM proxy route
- `jupyter.caddy.njk` - Jupyter notebook route
- etc.

---

## Service Routes

### Route Structure

```
https://{subdomain}.{hostname}.{tailnet}
```

Example: `https://ai.blueprint.tail8dd1.ts.net`

### Generated Routes

Routes are automatically generated for services with:
- `enabled: true`
- `external_subdomain` defined
- `published_port` configured

### WebSocket Services

Services with `websocket: true` get special configuration:
- Connection upgrade headers
- Buffering disabled for real-time communication
- Extended timeout settings

---

## Files

```
caddy/
├── caddy.container.njk       # Quadlet container definition
├── Caddyfile.njk             # Main Caddy configuration
├── caddy-config.volume       # Configuration volume
├── caddy-data.volume         # TLS certificate storage
└── README.md                 # This file
```

---

## Troubleshooting

### Check Service Status

```bash
systemctl --user status caddy.service
```

### View Logs

```bash
# Real-time logs
journalctl --user -u caddy.service -f

# Recent logs
journalctl --user -u caddy.service -n 100
```

### Test Configuration

```bash
# Validate Caddyfile
podman exec -it caddy caddy validate --config /etc/caddy/Caddyfile

# Reload configuration
podman exec -it caddy caddy reload --config /etc/caddy/Caddyfile
```

### Common Issues

#### Service Not Accessible

**Check Tailscale is running:**
```bash
tailscale status
```

**Verify DNS:**
```bash
ping ai.blueprint.tail8dd1.ts.net
```

**Check backend service:**
```bash
# Verify service is running
systemctl --user status openwebui.service

# Test backend directly
curl http://localhost:3000
```

#### Certificate Errors

Caddy uses Tailscale HTTPS, which requires:
- Tailscale daemon running
- HTTPS enabled for your tailnet
- Proper DNS resolution

```bash
# Check Tailscale HTTPS status
tailscale cert status blueprint.tail8dd1.ts.net
```

#### WebSocket Connection Failures

Ensure service has `websocket: true` in blueprint-config.json:

```json
{
  "openwebui": {
    "websocket": true
  }
}
```

### View Generated Caddyfile

```bash
# View the rendered configuration
cat ~/.config/containers/systemd/caddy/Caddyfile

# Or inside container
podman exec -it caddy cat /etc/caddy/Caddyfile
```

---

## Documentation

### Caddy Resources

- **Official Docs:** https://caddyserver.com/docs/
- **Caddyfile Syntax:** https://caddyserver.com/docs/caddyfile
- **Tailscale HTTPS:** https://tailscale.com/kb/1153/enabling-https/

### Related Services

All web-accessible services in the stack use Caddy:
- `openwebui/` - Chat interface
- `litellm/` - LLM proxy
- `jupyter/` - Code notebooks
- `searxng/` - Search engine
- `qdrant/` - Vector database UI
- `cockpit/` - System management

### Template Files

- `Caddyfile.njk` - Main configuration template
- `{service}.caddy.njk` - Service-specific routes
- `caddy.container.njk` - Container definition

---

## Advanced Configuration

### Custom Headers

Add custom headers in service-specific `.caddy.njk` files:

```caddy
header {
    X-Custom-Header "value"
    -Server
}
```

### Rate Limiting

Enable rate limiting per service:

```caddy
rate_limit {
    zone dynamic {
        key {remote_host}
        events 100
        window 1m
    }
}
```

### Access Logs

Enable access logging:

```caddy
log {
    output file /var/log/caddy/access.log
    format json
}
```

---

## License

Part of the Blueprint LLM Infrastructure Stack.

---

**Built with Caddy + Tailscale + Podman Quadlets**
