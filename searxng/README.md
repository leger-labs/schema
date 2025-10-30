# SearXNG

Privacy-respecting metasearch engine that aggregates results from 70+ search engines.

## Overview

SearXNG provides web search capabilities for Open WebUI and other LLM applications, enabling web-augmented responses without tracking or profiling.

**Container:** `searxng`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 8080
**Published Port:** 8888
**Image:** `docker.io/searxng/searxng:latest`
**External URL:** https://search.blueprint.tail8dd1.ts.net

## Features

- 🔍 **70+ Search Engines** - Google, Bing, DuckDuckGo, Wikipedia, etc.
- 🔐 **Privacy-Focused** - No tracking, no profiling
- ⚡ **Fast Results** - Parallel queries to multiple engines
- 🎯 **Category Search** - General, images, videos, news, maps, etc.
- 🔧 **Customizable** - Enable/disable engines, adjust preferences
- 📱 **API Support** - JSON output for integration with LLMs

## Quick Start

### 1. Enable and Start Service

```bash
systemctl --user daemon-reload
systemctl --user enable searxng.service
systemctl --user start searxng.service
systemctl --user status searxng.service
```

### 2. Access SearXNG

- **Local:** http://localhost:8888
- **Tailscale:** https://search.blueprint.tail8dd1.ts.net

### 3. Test Search

```bash
# Web interface
curl "http://localhost:8888/search?q=test"

# JSON API (for LLM integration)
curl "http://localhost:8888/search?q=test&format=json"
```

## Configuration

### blueprint-config.json

```json
{
  "searxng": {
    "hostname": "searxng",
    "port": 8080,
    "published_port": 8888,
    "external_subdomain": "search",
    "requires": ["searxng_redis"],
    "enabled": true
  }
}
```

### Settings

Configuration is managed via `searxng-settings.yml.njk`:

```yaml
general:
  instance_name: "SearXNG"
  enable_metrics: false

search:
  safe_search: 0  # 0=off, 1=moderate, 2=strict
  autocomplete: "google"
  default_lang: "en"

server:
  secret_key: "${SEARXNG_SECRET_KEY}"
  limiter: true
  image_proxy: true

redis:
  url: redis://searxng-redis:6379/0
```

## Integration with Open WebUI

Open WebUI uses SearXNG for web-augmented responses:

```bash
# In openwebui.env
RAG_WEB_SEARCH_ENGINE=searxng
SEARXNG_QUERY_URL=http://searxng:8080/search?q=<query>
ENABLE_RAG_WEB_SEARCH=true
```

## Files

```
searxng/
├── searxng.container.njk         # Quadlet container
├── searxng.volume                # Data volume
├── searxng-settings.yml.njk      # Configuration template
├── searxng.caddy.njk             # Caddy config
├── redis/                        # Redis cache
│   ├── searxng-redis.container.njk
│   └── searxng-redis.volume
└── README.md                     # This file
```

## Troubleshooting

### Check Logs

```bash
journalctl --user -u searxng.service -f
```

### Test Search

```bash
# Test search endpoint
curl "http://localhost:8888/search?q=test&format=json" | jq .

# Check available engines
curl "http://localhost:8888/config" | jq .engines
```

### Common Issues

#### No Results

- Check enabled engines in settings
- Verify network connectivity
- Some engines may be rate-limited

#### Slow Searches

- Reduce number of enabled engines
- Check Redis cache is working
- Increase timeout values

## Documentation

- **Official Docs:** https://docs.searxng.org/
- **GitHub:** https://github.com/searxng/searxng

---

**Built with SearXNG + Redis**
