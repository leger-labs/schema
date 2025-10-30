# Open WebUI

Modern, feature-rich chat interface for interacting with Large Language Models.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

---

## Overview

Open WebUI provides a ChatGPT-like interface for interacting with LLMs through LiteLLM. It includes support for:
- Multi-model conversations
- Document uploads and RAG (Retrieval-Augmented Generation)
- Image generation
- Voice input/output
- User management and sharing

**Container:** `openwebui`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 8080
**Published Port:** 3000
**Image:** `ghcr.io/open-webui/open-webui:main`
**External URL:** https://ai.blueprint.tail8dd1.ts.net

---

## Features

- 💬 **Multi-Model Chat** - Switch between models mid-conversation
- 📁 **Document Support** - Upload and chat with PDFs, text files, etc.
- 🎨 **Image Generation** - Integrated ComfyUI/AUTOMATIC1111 support
- 🎤 **Voice I/O** - Speech-to-text and text-to-speech
- 🔍 **Web Search** - Integrated SearXNG for web-augmented responses
- 👥 **Multi-User** - User accounts and conversation sharing
- 🔌 **Extensible** - Functions, tools, and custom pipelines
- 📊 **Analytics** - Conversation history and usage tracking

---

## Quick Start

### 1. Verify Dependencies

Open WebUI requires:
- `openwebui-postgres` - PostgreSQL database
- `openwebui-redis` - Redis cache
- `litellm` - LLM proxy service

These are automatically managed via the `requires` field in blueprint-config.json.

### 2. Enable and Start Service

```bash
# Reload systemd
systemctl --user daemon-reload

# Enable the service (and dependencies)
systemctl --user enable openwebui.service

# Start the service
systemctl --user start openwebui.service

# Check status
systemctl --user status openwebui.service
```

### 3. Access Open WebUI

- **Local:** http://localhost:3000
- **Tailscale:** https://ai.blueprint.tail8dd1.ts.net

### 4. Initial Setup

On first access:
1. **Create admin account** - First user becomes admin
2. **Configure models** - Models are auto-discovered from LiteLLM
3. **Set preferences** - Choose default model, theme, etc.

---

## Configuration

### blueprint-config.json

```json
{
  "openwebui": {
    "hostname": "openwebui",
    "port": 8080,
    "published_port": 3000,
    "external_subdomain": "ai",
    "requires": ["openwebui_postgres", "openwebui_redis", "litellm"],
    "enabled": true,
    "websocket": true,
    "env_file": "openwebui/openwebui.env"
  }
}
```

### Database Configuration

PostgreSQL is used for:
- User accounts and authentication
- Conversation history
- Shared chats
- Document embeddings (via pgvector)

**Connection:** Automatically configured via environment variables.

### Redis Configuration

Redis is used for:
- Session management
- Real-time features
- Caching

**Connection:** `redis://openwebui-redis:6379`

---

## Environment Variables

Configuration is managed via `openwebui.env.njk` template, which generates environment variables based on blueprint-config.json settings.

### Core Settings

```bash
# Database
DATABASE_URL=postgresql://openwebui@openwebui-postgres:5432/openwebui

# Redis
REDIS_URL=redis://openwebui-redis:6379

# LiteLLM Integration
OPENAI_API_BASE_URL=http://litellm:4000/v1
OPENAI_API_KEY=sk-1234

# Authentication
WEBUI_AUTH=true
ENABLE_SIGNUP=true
DEFAULT_USER_ROLE=user
```

### Feature Flags

Enable/disable features via blueprint-config.json:

```json
{
  "openwebui": {
    "features": {
      "rag_enabled": true,
      "web_search_enabled": true,
      "image_generation_enabled": true,
      "audio_enabled": true
    }
  }
}
```

### Optional Integrations

#### RAG (Retrieval-Augmented Generation)

```bash
RAG_EMBEDDING_ENGINE=litellm
RAG_EMBEDDING_MODEL=text-embedding-3-small
VECTOR_DB=qdrant
QDRANT_URL=http://qdrant:6333
```

#### Web Search

```bash
RAG_WEB_SEARCH_ENGINE=searxng
SEARXNG_QUERY_URL=http://searxng:8080/search?q=<query>
```

#### Image Generation

```bash
ENABLE_IMAGE_GENERATION=true
IMAGE_GENERATION_ENGINE=comfyui
COMFYUI_BASE_URL=http://comfyui:8188
```

#### Speech

```bash
# Text-to-Speech
AUDIO_TTS_ENGINE=edge
AUDIO_TTS_API_BASE_URL=http://edgetts:8000

# Speech-to-Text
AUDIO_STT_ENGINE=whisper
AUDIO_STT_API_BASE_URL=http://whisper:9000
```

---

## Files

```
openwebui/
├── openwebui.container.njk   # Quadlet container definition
├── openwebui.env.njk         # Environment variable template
├── openwebui.caddy.njk       # Caddy reverse proxy config
├── openwebui.volume          # Data volume
├── postgres/                 # PostgreSQL service
│   ├── openwebui-postgres.container.njk
│   └── openwebui-postgres.volume
├── redis/                    # Redis service
│   ├── openwebui-redis.container.njk
│   └── openwebui-redis.volume
└── README.md                 # This file
```

---

## Troubleshooting

### Check Service Status

```bash
systemctl --user status openwebui.service
```

### View Logs

```bash
# Real-time logs
journalctl --user -u openwebui.service -f

# Recent logs
journalctl --user -u openwebui.service -n 100
```

### Health Check

```bash
curl http://localhost:3000/health
```

### Common Issues

#### Service Won't Start

**Check dependencies:**
```bash
systemctl --user status openwebui-postgres.service
systemctl --user status openwebui-redis.service
systemctl --user status litellm.service
```

**Check database:**
```bash
# Connect to PostgreSQL
podman exec -it openwebui-postgres psql -U openwebui -d openwebui

# List tables
\dt
```

#### Cannot Login / Forgot Password

Reset admin password via database:

```bash
# Connect to database
podman exec -it openwebui-postgres psql -U openwebui -d openwebui

# Update password (hashed)
UPDATE auth_user SET password = 'pbkdf2_sha256$...' WHERE email = 'admin@example.com';
```

Or recreate the database (⚠️ **DELETES ALL DATA**):

```bash
systemctl --user stop openwebui.service openwebui-postgres.service
podman volume rm openwebui-postgres.volume
systemctl --user start openwebui-postgres.service openwebui.service
```

#### Models Not Appearing

**Check LiteLLM connection:**
```bash
# Test LiteLLM API
curl http://localhost:4000/v1/models

# Check Open WebUI can reach LiteLLM
podman exec -it openwebui curl http://litellm:4000/v1/models
```

**Verify environment variables:**
```bash
# View environment
podman exec -it openwebui env | grep OPENAI_API_BASE_URL
```

#### RAG/Document Upload Failures

**Check Qdrant:**
```bash
systemctl --user status qdrant.service

# Test Qdrant connection
curl http://localhost:6333/health
```

**Check embeddings:**
```bash
# Verify embedding model in LiteLLM
curl http://localhost:4000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "text-embedding-3-small", "input": "test"}'
```

#### Web Search Not Working

**Check SearXNG:**
```bash
systemctl --user status searxng.service

# Test search
curl "http://localhost:8888/search?q=test&format=json"
```

---

## Documentation

### Official Resources

- **Official Docs:** https://docs.openwebui.com/
- **GitHub Repository:** https://github.com/open-webui/open-webui
- **Issues/Support:** https://github.com/open-webui/open-webui/issues
- **Community:** https://discord.gg/openwebui

### API Documentation

- **API Endpoint:** http://localhost:3000/api
- **WebSocket:** ws://localhost:3000/ws

### Related Services

- `litellm/` - LLM proxy backend
- `qdrant/` - Vector database for RAG
- `searxng/` - Web search integration
- `comfyui/` - Image generation
- `edgetts/` - Text-to-speech
- `whisper/` - Speech-to-text

---

## Advanced Configuration

### Custom Models

Add custom models via the Admin Panel:
1. Settings → Models
2. Add model with OpenAI-compatible endpoint
3. Configure parameters (temperature, max tokens, etc.)

### Functions and Tools

Create custom functions:
1. Settings → Functions
2. Write Python function code
3. Configure input/output schemas
4. Enable for specific models

### Pipelines

Create custom pipelines for:
- Pre-processing user input
- Post-processing model output
- Custom RAG implementations
- External API integrations

### Theming

Customize appearance:
- Settings → Interface
- Choose theme (light/dark)
- Custom CSS via Admin Panel

---

## Security

### Production Checklist

- [ ] Change default admin password
- [ ] Disable public signup (`ENABLE_SIGNUP=false`)
- [ ] Enable HTTPS via Caddy
- [ ] Set secure session cookies
- [ ] Configure OAuth/SSO if needed
- [ ] Regular database backups
- [ ] Review user permissions

### User Management

Manage users via:
- Admin Panel → Users
- Create, edit, delete users
- Assign roles (admin, user)
- View usage statistics

---

## License

Open WebUI is licensed under the MIT License.

See: https://github.com/open-webui/open-webui/blob/main/LICENSE

---

**Built with Open WebUI + LiteLLM + PostgreSQL + Redis**
