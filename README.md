# Blueprint LLM Infrastructure Stack

A comprehensive, Nunjucks-templated collection of Podman Quadlet configurations for running a complete LLM infrastructure stack.

## 🎯 Overview

This repository provides production-ready Podman Quadlet configurations for deploying a full-featured LLM infrastructure stack with:

- **🤖 LLM Proxy** - LiteLLM for unified API access to 100+ providers
- **💬 Chat Interface** - Open WebUI with RAG, voice I/O, and image generation
- **🔍 Web Search** - SearXNG privacy-respecting metasearch
- **📊 Vector Database** - Qdrant for embeddings and semantic search
- **🎨 Image Generation** - ComfyUI for Stable Diffusion workflows
- **🔒 Secure Access** - Caddy reverse proxy with Tailscale HTTPS
- **📈 System Management** - Cockpit web interface
- **🔄 Dynamic Routing** - Llama-Swap for local model management

All services are:
- ✅ **Templated** - Nunjucks templates with JSON configuration
- ✅ **Isolated** - Each service has dedicated database/cache instances
- ✅ **Networked** - Connected via `llm.network` (10.89.0.0/24)
- ✅ **Production-Ready** - Health checks, logging, automatic restart
- ✅ **Documented** - Comprehensive README for each service

---

## 📁 Repository Structure

```
njk/
├── README.md                     # This file
├── blueprint-config.json         # Central configuration (SINGLE SOURCE OF TRUTH)
├── macros.njk                    # Reusable component library
├── base-container.njk            # Base template for containers
├── llm.network.njk               # Shared network definition
│
├── caddy/                        # Reverse proxy
│   ├── caddy.container.njk
│   ├── Caddyfile.njk
│   ├── caddy-config.volume
│   ├── caddy-data.volume
│   └── README.md
│
├── openwebui/                    # Chat interface
│   ├── openwebui.container.njk
│   ├── openwebui.env.njk
│   ├── openwebui.volume
│   ├── postgres/
│   ├── redis/
│   └── README.md
│
├── litellm/                      # LLM proxy
│   ├── litellm.container.njk
│   ├── litellm.yaml.njk
│   ├── postgres/
│   ├── redis/
│   └── README.md
│
├── searxng/                      # Web search
│   ├── searxng.container.njk
│   ├── searxng-settings.yml.njk
│   ├── redis/
│   └── README.md
│
├── qdrant/                       # Vector database
│   ├── qdrant.container.njk
│   ├── qdrant.volume
│   └── README.md
│
├── jupyter/                      # Code interpreter
│   ├── jupyter.container.njk
│   ├── jupyter.volume
│   └── README.md
│
├── tika/                         # Document extraction
│   ├── tika.container.njk
│   └── README.md
│
├── whisper/                      # Speech-to-text
│   ├── whisper.container.njk
│   ├── whisper-cache.volume
│   └── README.md
│
├── edgetts/                      # Text-to-speech
│   ├── edgetts.container.njk
│   ├── edgetts-cache.volume
│   └── README.md
│
├── cockpit/                      # System management
│   ├── cockpit.container.njk
│   ├── cockpit.conf.njk
│   └── README.md
│
├── llama-swap/                   # Local LLM router
│   ├── llama-swap.container.njk
│   ├── llama-swap-config.yaml.njk
│   ├── llama-swap.volume
│   └── README.md
│
├── mcp-context-forge/            # MCP gateway
│   ├── mcp-context-forge.container.njk
│   ├── postgres/
│   └── mcp-context-forge-README.md
│
├── comfyui.container.njk         # Image generation
├── comfyui.volume.njk
├── comfyui-models.volume.njk
├── comfyui-README.md
│
├── Documentation/                # Migration & reference docs
│   ├── INDEX.md
│   ├── STATE-OF-MIGRATION.md
│   ├── MIGRATION-SUMMARY.md
│   ├── QUICK-REFERENCE.md
│   ├── MIGRATION-COMPLETE.md
│   └── FULL-PLAN.md
│
├── njk-schema-*/                 # JSON schema validation
├── model-store/                  # Model configurations
└── release-catalog.json          # Release information
```

---

## 🚀 Quick Start

### Prerequisites

- **OS:** Linux (tested on Fedora/RHEL/Ubuntu)
- **Podman:** 4.0+ with systemd support
- **Tailscale:** (optional) for external HTTPS access
- **Storage:** ~50GB for models and data

### 1. Clone Repository

```bash
git clone <repository-url>
cd njk/
```

### 2. Configure

Edit `blueprint-config.json` with your settings:

```json
{
  "user": {
    "name": "your-username",
    "email": "your@email.com"
  },
  "tailscale": {
    "hostname": "your-hostname",
    "tailnet": "your-tailnet.ts.net"
  },
  "llm_providers": {
    "anthropic": {
      "enabled": true,
      "api_key": "${ANTHROPIC_API_KEY}"
    },
    "openai": {
      "enabled": true,
      "api_key": "${OPENAI_API_KEY}"
    }
  }
}
```

### 3. Render Templates

```bash
# Install Nunjucks renderer (Node.js required)
npm install -g nunjucks-cli

# Render all templates
nunjucks blueprint-config.json --path . --out ~/.config/containers/systemd/
```

### 4. Deploy Services

```bash
# Reload systemd to pick up new quadlets
systemctl --user daemon-reload

# Enable and start core services
systemctl --user enable --now llm.network.service
systemctl --user enable --now caddy.service
systemctl --user enable --now litellm.service
systemctl --user enable --now openwebui.service

# Check status
systemctl --user status openwebui.service
```

### 5. Access Services

- **Open WebUI:** https://ai.your-hostname.your-tailnet.ts.net
- **LiteLLM:** https://llm.your-hostname.your-tailnet.ts.net
- **Cockpit:** https://cockpit.your-hostname.your-tailnet.ts.net
- **Qdrant:** https://qdrant.your-hostname.your-tailnet.ts.net

*(Or via localhost if not using Tailscale)*

---

## 📚 Documentation

### Service Documentation

Each service directory contains a comprehensive README:

| Service | Description | README |
|---------|-------------|---------|
| **Caddy** | Reverse proxy with Tailscale HTTPS | [caddy/README.md](caddy/README.md) |
| **Open WebUI** | Chat interface with RAG | [openwebui/README.md](openwebui/README.md) |
| **LiteLLM** | Unified LLM proxy | [litellm/README.md](litellm/README.md) |
| **SearXNG** | Privacy-respecting search | [searxng/README.md](searxng/README.md) |
| **Qdrant** | Vector database | [qdrant/README.md](qdrant/README.md) |
| **Jupyter** | Code interpreter | [jupyter/README.md](jupyter/README.md) |
| **Tika** | Document extraction | [tika/README.md](tika/README.md) |
| **Whisper** | Speech-to-text | [whisper/README.md](whisper/README.md) |
| **EdgeTTS** | Text-to-speech | [edgetts/README.md](edgetts/README.md) |
| **Cockpit** | System management | [cockpit/README.md](cockpit/README.md) |
| **Llama-Swap** | Local model router | [llama-swap/README.md](llama-swap/README.md) |
| **MCP Context Forge** | MCP gateway | [mcp-context-forge/mcp-context-forge-README.md](mcp-context-forge/mcp-context-forge-README.md) |
| **ComfyUI** | Image generation | [comfyui-README.md](comfyui-README.md) |

### Migration Documentation

- **[INDEX.md](INDEX.md)** - Complete file navigation guide
- **[STATE-OF-MIGRATION.md](STATE-OF-MIGRATION.md)** - Current architecture overview
- **[MIGRATION-SUMMARY.md](MIGRATION-SUMMARY.md)** - Technical deep dive
- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Syntax cheat sheet
- **[MIGRATION-COMPLETE.md](MIGRATION-COMPLETE.md)** - Completion report

---

## 🏗️ Architecture

### Network Topology

All services connect to `llm.network` (10.89.0.0/24):

```
┌─────────────────────────────────────────────────────────────┐
│                        llm.network                           │
│                       (10.89.0.0/24)                         │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │  Caddy   │   │ LiteLLM  │   │ OpenWebUI│   │ SearXNG  │ │
│  │  :80/443 │   │  :4000   │   │  :8080   │   │  :8080   │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘ │
│                        │              │              │       │
│                   ┌────┴────┐    ┌────┴────┐    ┌────┴────┐ │
│                   │PostgreSQL│   │PostgreSQL│   │  Redis  │ │
│                   │  :5432   │   │  :5432   │   │  :6379  │ │
│                   └──────────┘   └──────────┘   └──────────┘ │
│                                       │                       │
│                                  ┌────┴────┐                 │
│                                  │  Redis  │                 │
│                                  │  :6379  │                 │
│                                  └──────────┘                │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │  Qdrant  │   │ Jupyter  │   │  Tika    │   │ Whisper  │ │
│  │  :6333   │   │  :8888   │   │  :9998   │   │  :9000   │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                    ┌─────┴─────┐
                    │ Tailscale │
                    │   HTTPS   │
                    └───────────┘
```

### Service Dependencies

- **Open WebUI** depends on:
  - LiteLLM (LLM proxy)
  - PostgreSQL (user data, conversations)
  - Redis (sessions, caching)
  - Qdrant (vector search)
  - SearXNG (web search)
  - Tika (document parsing)

- **LiteLLM** depends on:
  - PostgreSQL (request logging)
  - Redis (response caching)

- **SearXNG** depends on:
  - Redis (caching)

### Data Flow

1. **User Request** → Caddy (HTTPS) → Open WebUI
2. **LLM Request** → Open WebUI → LiteLLM → Provider API
3. **Document Upload** → Tika (extract) → Embeddings → Qdrant
4. **Web Search** → SearXNG → Multiple search engines
5. **Image Generation** → ComfyUI → Stable Diffusion

---

## ⚙️ Configuration

### Single Source of Truth

All configuration is managed via `blueprint-config.json`:

```json
{
  "infrastructure": {
    "network": {
      "name": "llm",
      "subnet": "10.89.0.0/24"
    },
    "services": {
      "openwebui": {
        "enabled": true,
        "port": 8080,
        "published_port": 3000,
        "external_subdomain": "ai"
      }
    }
  },
  "llm_providers": {
    "anthropic": {
      "enabled": true,
      "models": ["claude-3-5-sonnet-20241022"]
    }
  }
}
```

### Template Rendering

Templates use Nunjucks syntax:

```nunjucks
{% for service_name, service in infrastructure.services %}
{% if service.enabled %}
# Service: {{ service_name }}
Port={{ service.port }}
{% endif %}
{% endfor %}
```

### Environment Variables

Secrets are loaded from environment variables:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export TAILSCALE_OAUTH_CLIENT_ID="..."
```

---

## 🛠️ Advanced Features

### Template Inheritance

Services can extend base templates:

```nunjucks
{% extends "base-container.njk" %}

{% block service_header %}
Description=My Custom Service
{% endblock %}
```

### Macro Library

20+ reusable components in `macros.njk`:

```nunjucks
{% import "macros.njk" as m %}
{{ m.publishPort(service) }}
{{ m.healthCheck(4000, "/health") }}
{{ m.databaseURL(db_service) }}
```

### Conditional Rendering

Enable/disable features via configuration:

```nunjucks
{% if openwebui.features.rag_enabled %}
ENABLE_RAG=true
VECTOR_DB=qdrant
{% endif %}
```

---

## 🔒 Security

### Network Isolation

- Services communicate on isolated `llm.network`
- No direct external access to databases
- All external traffic through Caddy reverse proxy

### Authentication

- **Caddy:** Tailscale HTTPS with MagicDNS
- **Open WebUI:** User accounts with hashed passwords
- **Cockpit:** System user authentication
- **MCP Context Forge:** JWT with SSO support

### Secrets Management

- Environment variables for API keys
- Never commit secrets to version control
- Use `.env` files excluded from git

### Production Checklist

- [ ] Change all default passwords
- [ ] Enable HTTPS via Tailscale or Let's Encrypt
- [ ] Set secure session cookies
- [ ] Regular database backups
- [ ] Monitor logs for suspicious activity
- [ ] Keep images updated with `AutoUpdate=registry`

---

## 📊 Monitoring

### Service Status

```bash
# View all services
systemctl --user list-units --type=service | grep llm

# Check specific service
systemctl --user status openwebui.service
```

### Logs

```bash
# Real-time logs
journalctl --user -u openwebui.service -f

# Last 100 lines
journalctl --user -u openwebui.service -n 100
```

### Health Checks

All services include health checks:

```bash
curl http://localhost:3000/health     # Open WebUI
curl http://localhost:4000/health     # LiteLLM
curl http://localhost:6333/health     # Qdrant
```

### Cockpit Dashboard

Access system monitoring at:
- **Local:** http://localhost:9090
- **External:** https://cockpit.your-hostname.ts.net

---

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check dependencies
systemctl --user status <service>-postgres.service
systemctl --user status <service>-redis.service

# Check logs
journalctl --user -u <service>.service -n 100

# Verify network
podman network inspect llm.network
```

### Cannot Access via Tailscale

```bash
# Check Tailscale status
tailscale status

# Verify Caddy is running
systemctl --user status caddy.service

# Test local access first
curl http://localhost:3000
```

### Database Connection Errors

```bash
# Connect to PostgreSQL
podman exec -it <service>-postgres psql -U <user> -d <database>

# Check Redis
podman exec -it <service>-redis redis-cli ping
```

### Out of Disk Space

```bash
# Check volume usage
podman volume ls
podman system df

# Cleanup unused images
podman image prune -a

# Remove unused volumes (⚠️ DELETES DATA)
podman volume prune
```

---

## 📈 Performance Tuning

### Resource Allocation

Podman automatically manages resources. For specific limits, edit quadlet files:

```ini
[Container]
Memory=4G
CPUs=2.0
```

### Caching

- **LiteLLM:** Redis cache reduces API costs
- **SearXNG:** Redis cache speeds up searches
- **Open WebUI:** Redis for session management

### Database Optimization

PostgreSQL tuning in container environment:

```bash
# Increase shared_buffers for better performance
Environment=POSTGRES_SHARED_BUFFERS=256MB
Environment=POSTGRES_MAX_CONNECTIONS=100
```

---

## 🚀 Deployment

### Local Development

```bash
# Deploy all services
systemctl --user enable --now llm.network.service
systemctl --user enable --now $(systemctl --user list-unit-files | grep llm | awk '{print $1}')
```

### Production Deployment

1. **Configure Tailscale** for external access
2. **Set secure passwords** in blueprint-config.json
3. **Enable AutoUpdate** for automatic image updates
4. **Set up backups** for PostgreSQL volumes
5. **Monitor logs** via Cockpit or journalctl

### Backup Strategy

```bash
# Backup PostgreSQL databases
for service in openwebui litellm; do
  podman exec -t ${service}-postgres pg_dumpall -U ${service} > backup-${service}-$(date +%Y%m%d).sql
done

# Backup volumes
podman volume export <volume-name> > backup-volume.tar
```

---

## 🤝 Contributing

### Adding New Services

1. Create service directory: `mkdir njk/newservice/`
2. Create quadlet template: `newservice.container.njk`
3. Add configuration to `blueprint-config.json`
4. Create README: `newservice/README.md`
5. Test rendering and deployment

### Template Best Practices

- Use `macros.njk` for common patterns
- Extend `base-container.njk` when possible
- Document all configuration options
- Include health checks
- Add service to `blueprint-config.json`

---

## 📜 License

This repository is provided as-is for infrastructure deployment. Individual services maintain their respective licenses.

---

## 🙏 Acknowledgments

Built with:
- **[Podman](https://podman.io/)** - Container engine
- **[Nunjucks](https://mozilla.github.io/nunjucks/)** - Template engine
- **[Open WebUI](https://github.com/open-webui/open-webui)** - Chat interface
- **[LiteLLM](https://github.com/BerriAI/litellm)** - LLM proxy
- **[Caddy](https://caddyserver.com/)** - Web server
- **[Tailscale](https://tailscale.com/)** - Secure networking

And many other open-source projects!

---

## 📞 Support

For issues with specific services, see their respective READMEs.

For template or configuration issues, see the documentation:
- [INDEX.md](INDEX.md) - File navigation
- [QUICK-REFERENCE.md](QUICK-REFERENCE.md) - Syntax reference
- [STATE-OF-MIGRATION.md](STATE-OF-MIGRATION.md) - Architecture overview

---

**🚀 Built with Podman + Nunjucks + LLMs**

**📅 Last Updated:** 2025-10-25
