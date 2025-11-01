# LiteLLM Proxy

Unified API gateway for 100+ LLM providers with load balancing, caching, and observability.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Adding Models](#adding-models)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

---

## Overview

LiteLLM acts as a unified proxy for multiple LLM providers, translating all requests to the OpenAI API format. This allows switching between providers without changing client code.

**Container:** `litellm`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 4000
**Published Port:** 4000
**Image:** `ghcr.io/berriai/litellm:main-stable`
**External URL:** https://llm.blueprint.tail8dd1.ts.net

---

## Features

- 🌐 **100+ Providers** - OpenAI, Anthropic, Ollama, AWS Bedrock, Azure, Google, etc.
- 🔄 **Load Balancing** - Distribute requests across multiple API keys/endpoints
- 💾 **Redis Caching** - Cache responses to reduce costs
- 📊 **Database Logging** - PostgreSQL for request tracking and analytics
- 🔑 **Key Management** - Rotate API keys, set budgets and rate limits
- 📈 **Observability** - Prometheus metrics, Langfuse/LangSmith integration
- 🎯 **Fallbacks** - Automatic failover between providers
- 💰 **Budget Control** - Set spend limits per user/key

---

## Quick Start

### 1. Verify Dependencies

LiteLLM requires:
- `litellm-postgres` - PostgreSQL for logging
- `litellm-redis` - Redis for caching

These are automatically managed.

### 2. Configure Models

Edit `litellm/litellm.yaml.njk` or add models via blueprint-config.json:

```json
{
  "llm_providers": {
    "anthropic": {
      "enabled": true,
      "api_key": "${ANTHROPIC_API_KEY}",
      "models": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"]
    },
    "openai": {
      "enabled": true,
      "api_key": "${OPENAI_API_KEY}",
      "models": ["gpt-4o", "gpt-4o-mini"]
    }
  }
}
```

### 3. Enable and Start Service

```bash
# Reload systemd
systemctl --user daemon-reload

# Enable the service
systemctl --user enable litellm.service

# Start the service
systemctl --user start litellm.service

# Check status
systemctl --user status litellm.service
```

### 4. Test API

```bash
# List models
curl http://localhost:4000/v1/models

# Test chat completion
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Configuration

### blueprint-config.json

```json
{
  "litellm": {
    "hostname": "litellm",
    "port": 4000,
    "published_port": 4000,
    "external_subdomain": "llm",
    "requires": ["litellm_postgres", "litellm_redis"],
    "enabled": true,
    "config_file": "litellm/litellm.yaml"
  }
}
```

### litellm.yaml Structure

The configuration file defines:
- **Model list** - All available models
- **Router settings** - Load balancing, fallbacks
- **Caching** - Redis configuration
- **Database** - PostgreSQL logging
- **Budgets** - Spend limits

Example:

```yaml
model_list:
  - model_name: claude-3-5-sonnet-20241022
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: os.environ/ANTHROPIC_API_KEY

router_settings:
  redis_host: litellm-redis
  redis_port: 6379
  num_retries: 3
  timeout: 600
  fallbacks:
    - claude-3-5-sonnet-20241022
    - gpt-4o

litellm_settings:
  success_callback: ["postgres"]
  database_url: postgresql://litellm@litellm-postgres:5432/litellm
  drop_params: true
  set_verbose: false
```

---

## Adding Models

### Via blueprint-config.json

Add models to the providers section:

```json
{
  "llm_providers": {
    "ollama": {
      "enabled": true,
      "base_url": "http://localhost:11434",
      "models": ["llama3.2:latest", "qwen2.5:32b"]
    }
  }
}
```

The Nunjucks template auto-generates litellm.yaml from this configuration.

### Via litellm.yaml Directly

Edit `njk/litellm/litellm.yaml.njk`:

```yaml
model_list:
  - model_name: my-custom-model
    litellm_params:
      model: openai/gpt-4
      api_base: https://custom-endpoint.com/v1
      api_key: os.environ/CUSTOM_API_KEY
```

### Supported Providers

- **Commercial:** OpenAI, Anthropic, Google, Cohere, AI21
- **Cloud:** AWS Bedrock, Azure OpenAI, Google Vertex AI
- **Local:** Ollama, LM Studio, vLLM, LocalAI
- **Open Source:** Hugging Face, Together AI, Groq

Full list: https://docs.litellm.ai/docs/providers

---

## Files

```
litellm/
├── litellm.container.njk     # Quadlet container definition
├── litellm.yaml.njk          # LiteLLM configuration template
├── litellm.caddy.njk         # Caddy reverse proxy config
├── postgres/                 # PostgreSQL service
│   ├── litellm-postgres.container.njk
│   └── litellm-postgres.volume
├── redis/                    # Redis service
│   ├── litellm-redis.container.njk
│   └── litellm-redis.volume
└── README.md                 # This file
```

---

## Troubleshooting

### Check Service Status

```bash
systemctl --user status litellm.service
```

### View Logs

```bash
# Real-time logs
journalctl --user -u litellm.service -f

# Recent logs
journalctl --user -u litellm.service -n 100
```

### Health Check

```bash
curl http://localhost:4000/health
```

### Common Issues

#### Models Not Loading

**Check configuration:**
```bash
# View generated config
cat ~/.config/containers/systemd/litellm/litellm.yaml

# Validate YAML
podman exec -it litellm cat /app/config.yaml
```

**Check API keys:**
```bash
# Verify environment variables
podman exec -it litellm env | grep API_KEY
```

#### Database Connection Errors

**Check PostgreSQL:**
```bash
systemctl --user status litellm-postgres.service

# Connect to database
podman exec -it litellm-postgres psql -U litellm -d litellm

# List tables
\dt
```

#### Redis Connection Errors

**Check Redis:**
```bash
systemctl --user status litellm-redis.service

# Test Redis
podman exec -it litellm-redis redis-cli ping
```

#### Provider API Errors

**Test provider directly:**
```bash
# Test Anthropic
curl https://api.anthropic.com/v1/messages \
  -H "x-api-version: 2023-06-01" \
  -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Debugging

Enable verbose logging:

```yaml
litellm_settings:
  set_verbose: true
```

Restart service and check logs for detailed error messages.

---

## Documentation

### Official Resources

- **Official Docs:** https://docs.litellm.ai/
- **GitHub Repository:** https://github.com/BerriAI/litellm
- **Supported Providers:** https://docs.litellm.ai/docs/providers
- **API Reference:** https://docs.litellm.ai/docs/proxy/api_reference

### API Endpoints

- **Chat Completions:** `POST /v1/chat/completions`
- **Completions:** `POST /v1/completions`
- **Embeddings:** `POST /v1/embeddings`
- **Models:** `GET /v1/models`
- **Health:** `GET /health`

### Related Services

- `openwebui/` - Main LLM chat interface (uses LiteLLM)
- `litellm-postgres` - Request logging database
- `litellm-redis` - Response caching

---

## Advanced Configuration

### Load Balancing

Distribute requests across multiple API keys:

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY_1

  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY_2

router_settings:
  routing_strategy: usage-based-routing  # or least-busy, simple-shuffle
```

### Fallbacks

Automatic failover between providers:

```yaml
router_settings:
  fallbacks:
    - model_name: gpt-4o
      fallbacks: [claude-3-5-sonnet-20241022, gpt-4o-mini]
```

### Budget Control

Set spending limits:

```yaml
general_settings:
  master_key: sk-1234
  budget_duration: 30d
  max_budget: 100.0  # USD
```

### Observability

Integrate with Langfuse:

```yaml
litellm_settings:
  success_callback: ["langfuse"]
  langfuse_public_key: os.environ/LANGFUSE_PUBLIC_KEY
  langfuse_secret_key: os.environ/LANGFUSE_SECRET_KEY
  langfuse_host: https://cloud.langfuse.com
```

---

## License

LiteLLM is licensed under the Apache License 2.0.

See: https://github.com/BerriAI/litellm/blob/main/LICENSE

---

**Built with LiteLLM + PostgreSQL + Redis**
