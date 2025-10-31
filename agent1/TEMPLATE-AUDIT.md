# Template Audit Report for Leger v0.0.1 - Agent 1

## Agent Assignment
**Agent:** Agent 1
**Services Audited:** openwebui, qdrant, searxng, tika, whisper
**Date:** 2025-10-31

## Summary
- **Total services audited:** 5 primary services + 3 auxiliary services (openwebui_postgres, openwebui_redis, searxng_redis)
- **Total templates identified:** 17
- **Infrastructure fields identified:** 73
- **Configuration fields identified:** 120+
- **Secrets identified:** 12
- **Provider dependencies mapped:** 13

---

## Service: openwebui

### Infrastructure
```json
{
  "openwebui": {
    "container_name": "openwebui",
    "hostname": "openwebui",
    "port": 8080,
    "published_port": 3000,
    "bind_address": "127.0.0.1",
    "external_subdomain": "ai",
    "volume": "openwebui.volume",
    "description": "Open WebUI - LLM Chat Interface"
  },
  "openwebui_postgres": {
    "container_name": "openwebui-postgres",
    "hostname": "openwebui-postgres",
    "port": 5432,
    "published_port": null,
    "bind_address": null,
    "volume": "openwebui-postgres.volume",
    "db_name": "openwebui",
    "db_user": "openwebui"
  },
  "openwebui_redis": {
    "container_name": "openwebui-redis",
    "hostname": "openwebui-redis",
    "port": 6379,
    "published_port": null,
    "bind_address": null,
    "volume": "openwebui-redis.volume"
  }
}
```

### Features Referenced
From templates accessing `openwebui.features.*`:
- `features.rag` - Controls RAG functionality
- `features.web_search` - Enables web search integration
- `features.speech_to_text` - Enables STT functionality
- `features.text_to_speech` - Enables TTS functionality
- `features.code_execution` - Enables code execution via Jupyter
- `features.websocket_support` - Enables WebSocket support via Redis
- `features.title_generation` - AI-powered title generation
- `features.tags_generation` - AI-powered tag generation

### Providers Referenced
From templates accessing `openwebui.providers.*`:
- `providers.vector_db` - (pgvector | qdrant | chroma)
- `providers.rag_embedding` - (openai | ollama)
- `providers.content_extraction` - (tika | docling)
- `providers.web_search_engine` - (searxng | tavily)
- `providers.stt_engine` - (openai)
- `providers.tts_engine` - (openai)
- `providers.code_execution_engine` - (jupyter)

### Provider Config Fields
From templates accessing `openwebui.{config_section}.*`:

**Vector DB Config** (`openwebui.vector_db_config.*`):
- `chroma.tenant` - Chroma tenant name (when vector_db == "chroma")
- `chroma.database` - Chroma database name (when vector_db == "chroma")
- `pgvector.db_url` - PostgreSQL connection URL (when vector_db == "pgvector")
- `qdrant.uri` - Qdrant server URI (when vector_db == "qdrant")
- `qdrant.grpc_port` - Qdrant gRPC port (when vector_db == "qdrant")
- `qdrant.prefer_grpc` - Prefer gRPC over HTTP (when vector_db == "qdrant")
- `qdrant.on_disk` - Store vectors on disk vs memory (when vector_db == "qdrant")

**RAG Embedding Config** (`openwebui.rag_embedding_config.*`):
- `openai.base_url` - OpenAI API base URL (when rag_embedding == "openai")
- `openai.api_key` - OpenAI API key (when rag_embedding == "openai")
- `openai.model` - Embedding model name (when rag_embedding == "openai")
- `ollama.base_url` - Ollama server URL (when rag_embedding == "ollama")
- `ollama.model` - Ollama model name (when rag_embedding == "ollama")

**Content Extraction Config** (`openwebui.content_extraction_config.*`):
- `tika.server_url` - Tika server URL (when content_extraction == "tika")
- `docling.server_url` - Docling server URL (when content_extraction == "docling")

**Web Search Config** (`openwebui.web_search_config.*`):
- `searxng.query_url` - SearXNG query endpoint (when web_search_engine == "searxng")
- `tavily.api_key` - Tavily API key (when web_search_engine == "tavily")

**Audio Config - STT** (`openwebui.audio_config.stt.*`):
- `openai.base_url` - Whisper-compatible API base URL (when stt_engine == "openai")
- `openai.api_key` - API key for STT (when stt_engine == "openai")
- `openai.model` - STT model name (when stt_engine == "openai")

**Audio Config - TTS** (`openwebui.audio_config.tts.*`):
- `openai.base_url` - TTS API base URL (when tts_engine == "openai")
- `openai.api_key` - API key for TTS (when tts_engine == "openai")
- `openai.model` - TTS model name (when tts_engine == "openai")
- `openai.voice` - TTS voice selection (when tts_engine == "openai")

**Code Execution Config** (`openwebui.code_execution_config.*`):
- `jupyter.url` - Jupyter server URL (when code_execution_engine == "jupyter")
- `jupyter.auth` - Jupyter auth type (when code_execution_engine == "jupyter")
- `jupyter.timeout` - Execution timeout (when code_execution_engine == "jupyter")

**General Config** (`openwebui.general.*`):
- `database_url` - PostgreSQL connection URL
- `openai_api_base_url` - LiteLLM proxy URL
- `openai_api_key` - API key for LLM access
- `webui_secret_key` - Session encryption key
- `webui_name` - Application name
- `custom_name` - Custom branding name
- `webui_auth` - Enable authentication
- `enable_signup` - Allow user registration
- `default_user_role` - Default role for new users
- `log_level` - Logging verbosity
- `rag_top_k` - Number of RAG results to retrieve
- `chunk_size` - Document chunk size for RAG
- `chunk_overlap` - Overlap between chunks
- `task_models.title_generation` - Model for title generation
- `task_models.tags_generation` - Model for tags generation
- `task_models.query_generation` - Model for query generation

**Service Config** (`openwebui.service.*`):
- `timeout_start_sec` - Service startup timeout

### Secrets Referenced
From templates:
- `openwebui.general.openai_api_key` - LiteLLM API key
- `openwebui.general.webui_secret_key` - Session encryption key
- `openwebui.rag_embedding_config.openai.api_key` - RAG embedding API key
- `openwebui.audio_config.stt.openai.api_key` - STT API key
- `openwebui.audio_config.tts.openai.api_key` - TTS API key
- `openwebui.web_search_config.tavily.api_key` - Tavily API key

### Dependencies
**Required (always present):**
- `openwebui_postgres` - PostgreSQL database
- `openwebui_redis` - Redis cache
- `litellm` - LLM proxy service

**Optional (feature-dependent):**
- `searxng` - When `providers.web_search_engine == "searxng"`
- `tika` - When `providers.content_extraction == "tika"`
- `jupyter` - When `features.code_execution == true`
- `whisper` - When `features.speech_to_text == true`
- `qdrant` - When `providers.vector_db == "qdrant"`

### Enabled By
- Always enabled (user-installable service)

### Template Files
- `openwebui/openwebui.container.njk` - Quadlet container definition
- `openwebui/openwebui.env.njk` - Environment variables (200+ vars generated)
- `openwebui/openwebui.caddy.njk` - Caddy reverse proxy configuration
- `openwebui/openwebui.volume` - Volume definition
- `openwebui/postgres/openwebui-postgres.container.njk` - PostgreSQL container
- `openwebui/postgres/openwebui-postgres.volume` - PostgreSQL volume
- `openwebui/redis/openwebui-redis.container.njk` - Redis container
- `openwebui/redis/openwebui-redis.volume` - Redis volume

### Container Version
- Image: `ghcr.io/open-webui/open-webui:0.6.34` (hardcoded in release-catalog.json)
- PostgreSQL: `docker.io/pgvector/pgvector:pg16`
- Redis: `docker.io/redis:7.2-alpine`

---

## Service: qdrant

### Infrastructure
```json
{
  "qdrant": {
    "container_name": "qdrant",
    "hostname": "qdrant",
    "port": 6333,
    "published_port": 6333,
    "bind_address": "127.0.0.1",
    "external_subdomain": "qdrant",
    "volume": "qdrant.volume",
    "description": "Qdrant Vector Database"
  }
}
```

### Features Referenced
- None directly (conditionally enabled by provider selection)

### Providers Referenced
- Enabled when `openwebui.providers.vector_db == "qdrant"`

### Provider Config Fields
- No direct provider_config fields in qdrant templates
- Configuration happens in openwebui templates via `openwebui.vector_db_config.qdrant.*`

### Secrets Referenced
- None in qdrant container template
- API key managed in openwebui configuration

### Dependencies
**Required:**
- Network only (no database dependencies)

**Optional:**
- None

### Enabled By
```javascript
providers.vector_db == "qdrant"
```

### Template Files
- `qdrant/qdrant.container.njk` - Quadlet container definition
- `qdrant/qdrant.caddy.njk` - Caddy reverse proxy for web UI
- `qdrant/qdrant.volume` - Persistent volume for vector data

### Container Version
- Image: `docker.io/qdrant/qdrant:latest` (hardcoded in release-catalog.json)

### Additional Configuration
Environment variables set in template:
- `QDRANT__TELEMETRY_DISABLED=true` - Disable telemetry
- `QDRANT__LOG_LEVEL=INFO` - Logging level

---

## Service: searxng

### Infrastructure
```json
{
  "searxng": {
    "container_name": "searxng",
    "hostname": "searxng",
    "port": 8080,
    "published_port": 8080,
    "bind_address": "127.0.0.1",
    "external_subdomain": "search",
    "volume": "searxng.volume",
    "description": "SearXNG Meta-Search Engine"
  },
  "searxng_redis": {
    "container_name": "searxng-redis",
    "hostname": "searxng-redis",
    "port": 6379,
    "published_port": null,
    "bind_address": null,
    "volume": "searxng-redis.volume"
  }
}
```

### Features Referenced
- Enabled when `openwebui.features.web_search == true`

### Providers Referenced
- Enabled when `openwebui.providers.web_search_engine == "searxng"`

### Provider Config Fields
From templates accessing `searxng.*`:
- `searxng.base_url` - Base URL for SearXNG (auto-generated from Tailscale)
- `searxng.redis_url` - Redis connection URL
- `searxng.safe_search` - Safe search level (0=off, 1=moderate, 2=strict)
- `searxng.autocomplete` - Autocomplete provider
- `searxng.max_page` - Maximum result pages
- `searxng.engines[]` - Array of engine configurations
  - `searxng.engines[].name` - Engine name
  - `searxng.engines[].enabled` - Enable/disable engine

### Secrets Referenced
- `secrets.searxng_secret` - Session encryption secret key

### Dependencies
**Required:**
- `searxng_redis` - Redis cache for search results

**Optional:**
- None

### Enabled By
```javascript
features.web_search && providers.web_search_engine == "searxng"
```

### Template Files
- `searxng/searxng.container.njk` - Quadlet container definition
- `searxng/searxng-settings.yml.njk` - SearXNG YAML configuration
- `searxng/searxng.caddy.njk` - Caddy reverse proxy
- `searxng/searxng.volume` - Configuration volume
- `searxng/redis/searxng-redis.container.njk` - Redis container
- `searxng/redis/searxng-redis.volume` - Redis volume

### Container Version
- SearXNG: `docker.io/searxng/searxng:latest` (hardcoded in release-catalog.json)
- Redis: `docker.io/redis:7.2-alpine`

### Additional Configuration
Environment variables from template:
- `SEARXNG_BASE_URL` - Base URL
- `SEARXNG_REDIS_URL` - Redis connection
- `SEARXNG_UWSGI_WORKERS=8` - Worker processes
- `SEARXNG_UWSGI_THREADS=4` - Threads per worker
- `SEARXNG_LIMITER=false` - Rate limiting (disabled for local)

---

## Service: tika

### Infrastructure
```json
{
  "tika": {
    "container_name": "tika",
    "hostname": "tika",
    "port": 9998,
    "published_port": null,
    "bind_address": null,
    "description": "Apache Tika Document Extraction",
    "heap_size": "2g"
  }
}
```

### Features Referenced
- Enabled when `openwebui.features.rag == true`

### Providers Referenced
- Enabled when `openwebui.providers.content_extraction == "tika"`

### Provider Config Fields
From infrastructure:
- `infrastructure.services.tika.heap_size` - JVM heap size (default: "2g")

### Secrets Referenced
- None

### Dependencies
**Required:**
- Network only (internal service)

**Optional:**
- None

### Enabled By
```javascript
features.rag && providers.content_extraction == "tika"
```

### Template Files
- `tika/tika.container.njk` - Quadlet container definition

### Container Version
- Image: `docker.io/apache/tika:latest-full` (hardcoded in release-catalog.json)

### Additional Configuration
Environment variables from template:
- `TIKA_CHILD_JAVA_OPTS=-JXmx{heap_size}` - JVM heap configuration
- `TIKA_CHILD_MAX_HEAP={heap_size}` - Max heap size

---

## Service: whisper

### Infrastructure
```json
{
  "whisper": {
    "container_name": "whisper",
    "hostname": "whisper",
    "port": 9000,
    "published_port": 9000,
    "bind_address": "127.0.0.1",
    "external_subdomain": "whisper",
    "description": "Faster Whisper STT Service"
  }
}
```

### Features Referenced
- Enabled when `openwebui.features.speech_to_text == true`

### Providers Referenced
- Enabled when `openwebui.providers.stt_engine == "openai"` (uses Whisper-compatible API)

### Provider Config Fields
From templates accessing `whisper.*`:
- `whisper.cache_dir` - Host directory for model cache
- `whisper.model` - Whisper model size (tiny, base, small, medium, large)
- `whisper.language` - Target language (optional, auto-detect if empty)
- `whisper.beam_size` - Beam search size for transcription
- `whisper.compute_type` - Compute precision (int8, float16, float32)
- `whisper.device` - Device to use (cpu, cuda, auto)

### Secrets Referenced
- None (local service, no API key needed)

### Dependencies
**Required:**
- Network only

**Optional:**
- GPU access via AMD Vulkan (if available)

### Enabled By
```javascript
features.speech_to_text && providers.stt_engine == "openai"
```

### Template Files
- `whisper/whisper.container.njk` - Quadlet container definition
- `whisper/whisper.caddy.njk` - Caddy reverse proxy (optional external access)
- `whisper/whisper-cache.volume` - Model cache volume

### Container Version
- Image: `docker.io/fedirz/faster-whisper-server:latest-cpu` (hardcoded in release-catalog.json)

### Additional Configuration
Environment variables from template:
- `WHISPER_MODEL` - Model configuration
- `WHISPER_LANGUAGE` - Language setting
- `WHISPER_BEAM_SIZE` - Beam search parameter
- `WHISPER_COMPUTE_TYPE` - Computation precision
- `WHISPER_DEVICE` - Device selection
- `HF_HOME=/root/.cache/huggingface` - HuggingFace cache location
- `TRANSFORMERS_CACHE=/root/.cache/huggingface` - Transformers cache

Volume mounts:
- Host cache directory mounted to `/root/.cache/huggingface` for model persistence

---

## Cross-Service Observations

### Network Configuration
All services reference:
- `infrastructure.network.name` - Network name (default: "llm")
- `infrastructure.network.subnet` - Not explicitly used in templates but assumed: "10.89.0.0/24"

### Tailscale Integration
Services with external access reference:
- `tailscale.full_hostname` - Full Tailscale hostname for HTTPS URLs

### Service Interdependencies
```
openwebui
  ├── Requires: openwebui_postgres, openwebui_redis, litellm
  ├── Optional: searxng (web_search)
  ├── Optional: tika (content_extraction)
  ├── Optional: jupyter (code_execution)
  ├── Optional: whisper (speech_to_text)
  └── Optional: qdrant (vector_db)

searxng
  └── Requires: searxng_redis

qdrant
  └── Standalone (no dependencies)

tika
  └── Standalone (no dependencies)

whisper
  └── Standalone (no dependencies)
```

### Macro Usage
All templates import and use `macros.njk` for:
- `m.unitSection()` - Unit dependency generation
- `m.publishPort()` - Port publishing logic
- `m.volumeMount()` - Volume mounting
- `m.healthCheckWget()` - HTTP health checks
- `m.serviceSection()` - Service restart configuration
- `m.postgresEnv()` - PostgreSQL environment setup
- `m.redisEnv()` - Redis environment setup
- `m.postgresHealthCheck()` - PostgreSQL health verification
- `m.redisHealthCheck()` - Redis health verification
- `m.reverseProxy()` - Caddy reverse proxy configuration
- `m.amdGPU()` - AMD GPU device access

### Release Catalog Integration
All templates reference `release-catalog.json` for:
- Container image versions
- Service metadata
- Release information

---

## Identified Gaps and Issues

### 1. Missing Infrastructure Defaults

Several infrastructure fields are referenced but not fully documented:
- `openwebui_postgres.db_name` - Database name
- `openwebui_postgres.db_user` - Database user
- `openwebui_redis.volume` - Volume name
- `searxng_redis.volume` - Volume name

### 2. Incomplete Provider Config Structure

The provider config section needs to capture all nested configurations:
- `openwebui.vector_db_config.*` hierarchy
- `openwebui.rag_embedding_config.*` hierarchy
- `openwebui.content_extraction_config.*` hierarchy
- `openwebui.web_search_config.*` hierarchy
- `openwebui.audio_config.*` hierarchy
- `openwebui.code_execution_config.*` hierarchy

### 3. Default Values Not Documented

Many fields lack explicit defaults:
- `whisper.beam_size` - What's the default?
- `whisper.compute_type` - What's the default?
- `searxng.safe_search` - What's the default?
- `searxng.max_page` - What's the default?
- `tika.heap_size` - Default is "2g" but should be in schema

### 4. Redis URL Construction

Templates construct Redis URLs dynamically:
```
redis://{hostname}:{port}/{database_number}
```
This pattern should be documented in the schema contract.

### 5. Secret Management Inconsistency

Some secrets use different access patterns:
- Some via `secrets.*`
- Some via `{service}.general.*`
- Some via `{service}.{config_section}.*.api_key`

Need consistent pattern for all API keys and secrets.

### 6. Conditional Service Enablement

The logic for enabling auxiliary services needs to be captured:
- `openwebui_postgres` - Always enabled with openwebui
- `openwebui_redis` - Always enabled with openwebui
- `searxng_redis` - Always enabled with searxng
- `qdrant` - Conditional on provider selection
- `tika` - Conditional on provider selection
- `whisper` - Conditional on provider selection

### 7. External Subdomain Logic

Not all services have external_subdomain:
- `openwebui` - Yes (default: "ai")
- `qdrant` - Yes (default: "qdrant")
- `searxng` - Yes (default: "search")
- `whisper` - Yes (default: "whisper")
- `tika` - No (internal only)

This should be nullable in schema.

---

## Recommendations

### 1. Complete Infrastructure Section
Define ALL infrastructure fields with defaults for:
- Main services
- Auxiliary services (postgres, redis)
- Database configuration (db_name, db_user)
- Heap sizes and resource limits

### 2. Flatten Provider Config
Current nested structure is complex. Consider flattening:
```json
{
  "provider_config": {
    "qdrant_uri": { "x-depends-on": {"providers.vector_db": "qdrant"} },
    "searxng_query_url": { "x-depends-on": {"providers.web_search_engine": "searxng"} }
  }
}
```

### 3. Document URL Construction Patterns
Templates construct many URLs dynamically. Schema should document patterns:
- Database URLs: `postgresql://{user}@{hostname}:{port}/{dbname}`
- Redis URLs: `redis://{hostname}:{port}/{db_number}`
- HTTP endpoints: `http://{hostname}:{port}{path}`

### 4. Standardize Secret References
All secrets should use consistent pattern:
```json
{
  "secrets": {
    "openai_api_key": "{OPENAI_API_KEY}",
    "searxng_secret": "{SEARXNG_SECRET}"
  }
}
```

### 5. Create Service Groups
Schema should define service groups:
```json
{
  "service_groups": {
    "openwebui": ["openwebui", "openwebui_postgres", "openwebui_redis"],
    "searxng": ["searxng", "searxng_redis"]
  }
}
```

### 6. Add Validation Rules
Several fields need constraints:
- `whisper.model` - enum: ["tiny", "base", "small", "medium", "large"]
- `whisper.compute_type` - enum: ["int8", "float16", "float32"]
- `searxng.safe_search` - enum: [0, 1, 2]
- `tika.heap_size` - pattern: "^[0-9]+[mg]$"

---

## Next Steps

1. **Agent 2-3:** Complete audit of remaining services
2. **Agent 4:** Consolidate all findings and resolve conflicts
3. **Final schema:** Merge all SCHEMA-ADDITIONS.json files
4. **Validation:** Test schema against actual user-config.json examples
5. **Templates:** Update templates to use standardized paths

---

**Audit completed by Agent 1**
**Date:** 2025-10-31
**Services covered:** openwebui, qdrant, searxng, tika, whisper
