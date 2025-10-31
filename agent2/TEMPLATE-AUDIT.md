# Template Audit Report for Leger v0.0.1
## Agent 2: jupyter, litellm, llama-swap, mcp-context-forge

**Date:** 2025-10-31
**Agent:** Agent 2
**Status:** Complete

---

## Summary

- **Total services audited:** 7 (4 main + 3 support)
  - Main: jupyter, litellm, llama-swap, mcp-context-forge
  - Support: litellm_postgres, litellm_redis, mcp_context_forge_postgres
- **Total templates:** 16
- **Infrastructure fields identified:** 71
- **Configuration fields identified:** 150+
- **Secrets identified:** 20+

---

## Service: jupyter

### Overview

Interactive Python code interpreter for data analysis, machine learning, and AI experimentation integrated with Open WebUI.

**Image:** `localhost/blueprint-jupyter:latest` (Custom build based on scipy-notebook)
**Version:** 4.4.9

### Infrastructure

```json
{
  "port": 8888,
  "published_port": 8889,
  "bind_address": "127.0.0.1",
  "container_name": "jupyter",
  "hostname": "jupyter",
  "external_subdomain": "jupyter",
  "description": "Jupyter Lab - Interactive code interpreter",
  "volume": "jupyter.volume",
  "requires": ["litellm"]
}
```

### Features Referenced

- None directly (service is enabled based on user choice for code execution feature)

### Providers Referenced

- None directly
- Integrates with **litellm** as LLM provider for notebook-intelligence

### Provider Config Fields

None - configuration is straightforward with no provider choices

### Configuration Fields Accessed

From `infrastructure.services.jupyter`:
- `container_name`
- `hostname`
- `port`
- `published_port`
- `volume`
- `description`
- `requires`
- `external_subdomain`

From `infrastructure.services.litellm`:
- `hostname` (for LITELLM_API_BASE)
- `port` (for LITELLM_API_BASE)

From `infrastructure.network`:
- `name` (for Network directive)

From `tailscale`:
- `full_hostname` (for external URL logging)

### Secrets Referenced

- `LITELLM_MASTER_KEY` (for authenticating with LiteLLM)

### Environment Variables Generated

```bash
JUPYTER_ENABLE_LAB=yes
NB_USER=jovyan
CHOWN_HOME=yes
CHOWN_HOME_OPTS=-R
LITELLM_API_BASE=http://litellm:4000
LITELLM_API_KEY=${LITELLM_MASTER_KEY}
NBI_NOTEBOOK_EXECUTE_TOOL=disabled
```

### Dependencies

**Required:**
- litellm.service (for AI code completion)

**Optional:** None

### Conditional Enablement

**Enabled by:** User selects code execution provider as "jupyter" OR code interpreter provider as "jupyter"

**Expression:**
```
providers.code_execution_engine == "jupyter" || providers.code_interpreter_engine == "jupyter"
```

### Template Files

1. `jupyter/jupyter.container.njk` - Quadlet container definition
2. `jupyter/jupyter.caddy.njk` - Caddy reverse proxy configuration
3. `jupyter/jupyter.volume` - Volume definition

### Special Features

- **Custom Image Build:** Uses ExecStartPre to build custom image with:
  - nb_conda_kernels (multi-environment support)
  - notebook-intelligence (AI code completion via LiteLLM)
- **No Authentication:** Relies on Tailscale security boundary
- **OpenWebUI Integration:** Code Interpreter and Code Execution features

### Notes

- Volume mount: `/home/jovyan/blueprint-workspace` (minimal access for security)
- Health check endpoint: `/api`
- Security: NBI notebook execute tool disabled by default
- Requires custom Dockerfile in `~/.config/containers/systemd/jupyter/Dockerfile`

---

## Service: litellm

### Overview

Unified API gateway for 100+ LLM providers with load balancing, caching, and observability.

**Image:** `ghcr.io/berriai/litellm:main-v1.78.5`
**Version:** 1.78.5

### Infrastructure

```json
{
  "port": 4000,
  "published_port": 4000,
  "bind_address": "127.0.0.1",
  "container_name": "litellm",
  "hostname": "litellm",
  "external_subdomain": "llm",
  "description": "LiteLLM - Unified LLM proxy",
  "requires": ["litellm_postgres", "litellm_redis"]
}
```

### Features Referenced

None directly - acts as central LLM router

### Providers Referenced

From `litellm.models` (cloud providers):
- openai
- anthropic
- gemini
- openrouter
- groq

From `local_inference.models` (local models via llama-swap)

### Provider Config Fields

**From `litellm` section:**
- `models` (array of model definitions)
  - `name`
  - `provider` (openai, anthropic, gemini, openrouter, groq)
  - `enabled`
  - `description`
  - `context_window`
  - `openrouter_model` (when provider == openrouter)
  - `groq_model` (when provider == groq)
- `database_url` (PostgreSQL connection string)
- `drop_params` (default: true)

**From `local_inference` section:**
- `models` (object of local model definitions)
  - `enabled`
  - `name`
  - `display_name`
  - `group` (for filtering embeddings vs chat models)

**From `infrastructure.services.llama_swap`:**
- `hostname` (for local model API base)
- `port` (for local model API base)

**From `infrastructure.services.litellm_redis`:**
- `hostname` (for Redis caching)
- `port` (for Redis caching)

### Configuration Fields Accessed

From `infrastructure.services.litellm`:
- All standard infrastructure fields
- `requires` (for dependencies)

From `infrastructure.services.litellm_postgres`:
- `container_name` (for After/Wants)

From `infrastructure.services.litellm_redis`:
- `container_name` (for After/Wants)
- `hostname` (for REDIS_HOST)
- `port` (for REDIS_PORT)

### Secrets Referenced

- `secrets.api_keys.litellm_master` → `LITELLM_MASTER_KEY`
- `secrets.llm_providers.openai` → `OPENAI_API_KEY`
- `secrets.llm_providers.anthropic` → `ANTHROPIC_API_KEY`
- `secrets.llm_providers.gemini` → `GEMINI_API_KEY`
- `secrets.llm_providers.openrouter` → `OPENROUTER_API_KEY` (optional)
- `secrets.llm_providers.groq` → `GROQ_API_KEY` (optional)

### Environment Variables Generated

```bash
LITELLM_MASTER_KEY={{ secrets.api_keys.litellm_master }}
DATABASE_URL={{ litellm.database_url }}
REDIS_HOST={{ infrastructure.services.litellm_redis.hostname }}
REDIS_PORT={{ infrastructure.services.litellm_redis.port }}
STORE_MODEL_IN_DB=true
USE_AIOHTTP_TRANSPORT=true
OPENAI_API_KEY={{ secrets.llm_providers.openai }}
ANTHROPIC_API_KEY={{ secrets.llm_providers.anthropic }}
GEMINI_API_KEY={{ secrets.llm_providers.gemini }}
```

### Dependencies

**Required:**
- litellm_postgres.service (database for model configs, request logging)
- litellm_redis.service (caching and rate limiting)

**Optional:**
- llama_swap.service (for local models, if enabled)

### Conditional Enablement

**Enabled by:** Always enabled (core service)

**Expression:**
```
true
```

### Template Files

1. `litellm/litellm.container.njk` - Quadlet container definition (extends base-container.njk)
2. `litellm/litellm.caddy.njk` - Caddy reverse proxy configuration
3. `litellm/litellm.yaml.njk` - LiteLLM configuration file (models, settings)
4. `litellm/postgres/litellm-postgres.container.njk` - PostgreSQL database
5. `litellm/postgres/litellm-postgres.volume` - PostgreSQL data volume
6. `litellm/redis/litellm-redis.container.njk` - Redis cache
7. `litellm/redis/litellm-redis.volume` - Redis data volume

### Special Features

- **Template Inheritance:** Uses `{% extends "../base-container.njk" %}`
- **Dynamic Model Configuration:** Generates litellm.yaml from blueprint-config.json
- **Cloud + Local Models:** Supports both cloud APIs and local models via llama-swap
- **Health Check:** Custom endpoint `/health/readiness`

### Configuration File Template

The `litellm.yaml.njk` template generates:

```yaml
model_list:
  # Cloud models (from litellm.models)
  - model_name: claude-3-5-sonnet-20241022
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: os.environ/ANTHROPIC_API_KEY

  # Local models (from local_inference.models via llama-swap)
  - model_name: llama-3.2-3b
    litellm_params:
      model: openai/llama-3.2-3b
      api_base: http://llama-swap:8000/v1
      api_key: "sk-no-key-required"

litellm_settings:
  drop_params: true
  cache: true
  cache_params:
    type: redis
    host: litellm-redis
    port: 6379
    ttl: 3600

general_settings:
  database_url: "postgresql://litellm@litellm-postgres:5432/litellm"
  master_key: os.environ/LITELLM_MASTER_KEY
  store_model_in_db: true
```

### Notes

- Serves as central LLM gateway for all services
- OpenWebUI, Jupyter, and other services connect through LiteLLM
- Volume mount: `litellm.yaml` mounted read-only to `/app/config.yaml`

---

## Service: litellm_postgres

### Overview

PostgreSQL database for LiteLLM request logging, model configurations, and analytics.

**Image:** `docker.io/pgvector/pgvector:pg16`
**Version:** 16 (with pgvector extension)

### Infrastructure

```json
{
  "port": 5432,
  "published_port": null,
  "container_name": "litellm-postgres",
  "hostname": "litellm-postgres",
  "db_name": "litellm",
  "db_user": "litellm",
  "volume": "litellm-postgres.volume"
}
```

### Configuration Fields Accessed

- `infrastructure.network.name`
- `infrastructure.services.litellm_postgres.container_name`
- `infrastructure.services.litellm_postgres.db_name`
- `infrastructure.services.litellm_postgres.db_user`
- `infrastructure.services.litellm_postgres.volume`

### Environment Variables Generated

```bash
POSTGRES_DB=litellm
POSTGRES_USER=litellm
POSTGRES_HOST_AUTH_METHOD=trust  # Internal network only
```

### Dependencies

None (foundational service)

### Template Files

1. `litellm/postgres/litellm-postgres.container.njk`
2. `litellm/postgres/litellm-postgres.volume`

### Notes

- **No password:** Uses `trust` authentication (internal network only)
- **pgvector extension:** Enabled for embedding storage
- Health check: `pg_isready -U litellm`
- Volume: `/var/lib/postgresql/data`

---

## Service: litellm_redis

### Overview

Redis cache for LiteLLM response caching and rate limiting.

**Image:** `docker.io/redis:7.2-alpine`
**Version:** 7.2

### Infrastructure

```json
{
  "port": 6379,
  "published_port": null,
  "container_name": "litellm-redis",
  "hostname": "litellm-redis",
  "volume": "litellm-redis.volume"
}
```

### Configuration Fields Accessed

- `infrastructure.network.name`
- `infrastructure.services.litellm_redis.container_name`
- `infrastructure.services.litellm_redis.volume`

### Environment Variables Generated

None (uses Redis defaults)

### Dependencies

None (foundational service)

### Template Files

1. `litellm/redis/litellm-redis.container.njk`
2. `litellm/redis/litellm-redis.volume`

### Notes

- **No password:** Internal network only
- Health check: `redis-cli ping`
- Volume: `/data`
- Restart policy: `on-failure`

---

## Service: llama-swap

### Overview

Dynamic model router for local LLM inference with automatic model loading/unloading to optimize GPU/RAM usage.

**Image:** `ghcr.io/mostlygeek/llama-swap:cpu`
**Version:** v156 (Aug 2025)

### Infrastructure

```json
{
  "port": 8000,
  "published_port": 8000,
  "bind_address": "127.0.0.1",
  "container_name": "llama-swap",
  "hostname": "llama-swap",
  "external_subdomain": "llama",
  "description": "Llama-Swap - Dynamic local model router",
  "volume": "llama-swap.volume"
}
```

### Features Referenced

None directly

### Providers Referenced

None - manages local models defined in `local_inference`

### Provider Config Fields

**From `local_inference.models` (object of models):**

For each model:
- `enabled` (boolean)
- `name` (string - model identifier for API)
- `display_name` (string - human-readable name)
- `model_uri` (string - ramalama URI like `huggingface://...`)
- `ctx_size` (integer - context window)
- `ttl` (integer - time-to-live in seconds, 0 = never unload)
- `flash_attn` (boolean - flash attention optimization)
- `vulkan_driver` (string - hardware acceleration)
- `group` (string - swap group membership: "heavy", "light", "embeddings")
- `description` (string)
- `ram_required_gb` (number)
- `context_length` (integer)
- `quantization` (string)

**From `local_inference.defaults`:**
- `log_level` (string - default: "info")
- `metrics_max_in_memory` (integer)
- `container_image` (string - ramalama image)
- `ngl` (integer - GPU layers)
- `temp` (float - temperature)
- `threads` (integer - CPU threads)
- `backend` (string - inference backend)
- `cache_reuse` (boolean)
- `health_check_timeout` (integer)
- `start_port` (integer - base port for spawned containers)
- `auto_unload` (boolean)

**From `local_inference.groups` (object of group configs):**

For each group:
- `description` (string)
- `swap` (boolean - enable swap management)
- `members` (array of model names)

### Configuration Fields Accessed

From `infrastructure.services.llama_swap`:
- All standard infrastructure fields
- `port`
- `volume`

From `infrastructure.network`:
- `name` (for spawned ramalama containers)

### Secrets Referenced

None (local inference, no API keys needed)

### Environment Variables Generated

```bash
PODMAN_SOCK=unix:///run/podman/podman.sock
HOME=/root
```

### Dependencies

None (independent service)

### Conditional Enablement

**Enabled by:** When any local model is enabled

**Expression:**
```
local_inference.models | any(model.enabled)
```

### Template Files

1. `llama-swap/llama-swap.container.njk` - Quadlet container definition
2. `llama-swap/llama-swap-config.yaml.njk` - Configuration file (models, swap groups)
3. `llama-swap/llama-swap.caddy.njk` - Caddy reverse proxy configuration
4. `llama-swap/llama-swap.volume` - Data volume

### Special Features

- **Podman Socket Access:** Mounts `/run/user/%U/podman/podman.sock` to spawn ramalama containers
- **RamaLama Cache:** Read-only mount of `${HOME}/.local/share/ramalama` for model files
- **Security:** Uses `--security-opt=label=disable` to allow container spawning
- **Swap Groups:** Heavy models swap to avoid OOM

### Configuration File Template

The `llama-swap-config.yaml.njk` template generates:

```yaml
server:
  host: 0.0.0.0
  port: 8000
  log_level: info

runtime:
  podman_sock: unix:///run/podman/podman.sock
  container_image: quay.io/ramalama/ramalama:latest
  network: llm.network

models:
  - name: llama-3.2-3b
    display_name: "Llama 3.2 3B"
    uri: huggingface://meta-llama/Llama-3.2-3B-Instruct-GGUF/Llama-3.2-3B-Instruct-Q5_K_M.gguf
    ctx_size: 8192
    ngl: 999
    ttl: 0
    group: light
    swap_enabled: false
    port: 11434

swap_groups:
  - name: heavy
    swap_enabled: true
    members: ["qwen2.5-32b", "llama-3.1-70b"]

auto_unload:
  enabled: true
  check_interval: 60
```

### Integration with LiteLLM

LiteLLM template references llama-swap for local models:

```yaml
# In litellm.yaml.njk
- model_name: llama-3.2-3b
  litellm_params:
    model: openai/llama-3.2-3b
    api_base: http://llama-swap:8000/v1
    api_key: "sk-no-key-required"
```

### Notes

- Exposes OpenAI-compatible API at `/v1`
- Health check: `/health`
- Models are spawned on-demand via ramalama
- Swap management prevents OOM for large models

---

## Service: mcp-context-forge

### Overview

Enterprise-ready Model Context Protocol Gateway that federates MCP servers and REST APIs with advanced authentication, observability, and multi-tenancy.

**Image:** `ghcr.io/ibm/mcp-context-forge:0.8.0`
**Version:** 0.8.0

### Infrastructure

```json
{
  "port": 4444,
  "published_port": 4444,
  "bind_address": "127.0.0.1",
  "container_name": "mcp-context-forge",
  "hostname": "mcp-context-forge",
  "external_subdomain": "mcp",
  "description": "MCP Context Forge - Enterprise MCP Gateway",
  "data_dir": "%h/.local/share/mcp-context-forge",
  "config_dir": "%h/.config/mcp-context-forge",
  "requires": ["mcp_context_forge_postgres"],
  "database": "postgresql",
  "environment": "production",
  "log_level": "INFO",
  "admin_email": "admin@example.com",
  "admin_name": "Platform Administrator",
  "auth_required": true,
  "jwt_algorithm": "HS256",
  "secure_cookies": false,
  "catalog_enabled": true,
  "ui_enabled": true,
  "admin_api_enabled": true,
  "redis_enabled": false,
  "federation_enabled": true,
  "a2a_enabled": true,
  "llmchat_enabled": false,
  "observability_enabled": false,
  "llm_provider": "azure_openai",
  "otel_exporter": "otlp",
  "otel_endpoint": null
}
```

### Features Referenced

None directly (service provides infrastructure for MCP protocol)

### Providers Referenced

None directly (MCP servers are registered separately)

### Provider Config Fields

**From `infrastructure.services.mcp_context_forge`:**

**Core Settings:**
- `port` (integer - HTTP server port)
- `data_dir` (string - persistent data location)
- `config_dir` (string - secrets and config files)
- `environment` (string - "development" | "production")
- `log_level` (string - "DEBUG" | "INFO" | "WARNING" | "ERROR")

**Database:**
- `database` (string - "postgresql" | "sqlite" | "mariadb" | "mysql")
- `requires` (array - database service dependencies)

**Authentication:**
- `admin_email` (string)
- `admin_name` (string)
- `auth_required` (boolean)
- `jwt_algorithm` (string - "HS256" | "RS256" | "ES256" etc.)
- `secure_cookies` (boolean - requires HTTPS)

**Features:**
- `catalog_enabled` (boolean - enable MCP server catalog)
- `ui_enabled` (boolean - enable admin UI)
- `admin_api_enabled` (boolean - enable admin API)
- `redis_enabled` (boolean - enable Redis caching)
- `federation_enabled` (boolean - enable gateway federation)
- `a2a_enabled` (boolean - enable agent-to-agent)
- `llmchat_enabled` (boolean - enable built-in LLM chat)
- `observability_enabled` (boolean - enable OpenTelemetry)

**LLM Chat (when enabled):**
- `llm_provider` (string - "azure_openai" | "openai" | "anthropic" | "aws_bedrock" | "ollama")

**Observability (when enabled):**
- `otel_exporter` (string - "otlp" | "jaeger" | "zipkin" | "console")
- `otel_endpoint` (string | null - OpenTelemetry endpoint URL)

**From `infrastructure.services.mcp_context_forge_postgres`:**
- `hostname` (for DATABASE_URL)
- `port` (for DATABASE_URL)
- `db_user` (for DATABASE_URL)
- `db_name` (for DATABASE_URL)

### Configuration Fields Accessed

Extensive environment variable configuration (150+ variables), organized by category:

**Basic Settings:**
- APP_NAME, HOST, PORT, ENVIRONMENT, LOG_LEVEL, LOG_FORMAT

**Database:**
- DATABASE_URL, DB_POOL_SIZE, DB_MAX_OVERFLOW, DB_POOL_TIMEOUT, DB_POOL_RECYCLE

**Authentication:**
- BASIC_AUTH_USER, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_FULL_NAME, AUTH_REQUIRED
- JWT_ALGORITHM, JWT_AUDIENCE, JWT_ISSUER, TOKEN_EXPIRY
- PASSWORD_MIN_LENGTH, PASSWORD_REQUIRE_* (uppercase, lowercase, numbers, special)
- EMAIL_AUTH_ENABLED, MAX_FAILED_LOGIN_ATTEMPTS, ACCOUNT_LOCKOUT_DURATION_MINUTES

**Teams:**
- AUTO_CREATE_PERSONAL_TEAMS, PERSONAL_TEAM_PREFIX, MAX_TEAMS_PER_USER, MAX_MEMBERS_PER_TEAM

**SSO:**
- SSO_ENABLED, SSO_AUTO_CREATE_USERS, SSO_PRESERVE_ADMIN_AUTH
- SSO_GITHUB_ENABLED, SSO_GOOGLE_ENABLED, SSO_KEYCLOAK_ENABLED, etc.

**OAuth:**
- DCR_ENABLED, DCR_AUTO_REGISTER_ON_MISSING_CREDENTIALS, OAUTH_DISCOVERY_ENABLED

**A2A:**
- MCPGATEWAY_A2A_ENABLED, MCPGATEWAY_A2A_MAX_AGENTS, MCPGATEWAY_A2A_DEFAULT_TIMEOUT

**LLM Chat:**
- LLMCHAT_ENABLED, LLM_PROVIDER

**MCP Catalog:**
- MCPGATEWAY_CATALOG_ENABLED, MCPGATEWAY_CATALOG_FILE, MCPGATEWAY_CATALOG_AUTO_HEALTH_CHECK

**UI:**
- MCPGATEWAY_UI_ENABLED, MCPGATEWAY_ADMIN_API_ENABLED, MCPGATEWAY_BULK_IMPORT_ENABLED

**Security:**
- SKIP_SSL_VERIFY, APP_DOMAIN, CORS_ENABLED, SECURE_COOKIES, SECURITY_HEADERS_ENABLED

**Transport:**
- TRANSPORT_TYPE, WEBSOCKET_PING_INTERVAL, SSE_RETRY_TIMEOUT, SSE_KEEPALIVE_ENABLED

**Federation:**
- FEDERATION_ENABLED, FEDERATION_DISCOVERY, FEDERATION_TIMEOUT, FEDERATION_SYNC_INTERVAL

**Observability:**
- OTEL_ENABLE_OBSERVABILITY, OTEL_SERVICE_NAME, OTEL_TRACES_EXPORTER, OTEL_EXPORTER_OTLP_ENDPOINT

**Cache:**
- CACHE_TYPE, REDIS_URL (if redis_enabled), SESSION_TTL, MESSAGE_TTL

### Secrets Referenced

**From `config_dir/secrets.env`:**

Required secrets:
- `JWT_SECRET_KEY` (HMAC JWT signing)
- `ADMIN_PASSWORD` (admin user password)
- `BASIC_AUTH_PASSWORD` (basic auth password)
- `PLATFORM_ADMIN_PASSWORD` (platform admin password)
- `AUTH_ENCRYPTION_SECRET` (for encrypting stored credentials)

Optional SSO secrets (when SSO_*_ENABLED=true):
- `SSO_GITHUB_CLIENT_ID`
- `SSO_GITHUB_CLIENT_SECRET`
- `SSO_GOOGLE_CLIENT_ID`
- `SSO_GOOGLE_CLIENT_SECRET`
- `SSO_KEYCLOAK_CLIENT_ID`
- `SSO_KEYCLOAK_CLIENT_SECRET`
- `SSO_ENTRA_CLIENT_ID`
- `SSO_ENTRA_CLIENT_SECRET`
- `SSO_OKTA_CLIENT_ID`
- `SSO_OKTA_CLIENT_SECRET`

Optional LLM provider keys (when llmchat_enabled=true):
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `AZURE_OPENAI_KEY`
- `AWS_ACCESS_KEY`
- `AWS_SECRET_KEY`

Optional database password (when using MariaDB/MySQL):
- `DB_PASSWORD`

### Dependencies

**Required:**
- mcp_context_forge_postgres.service (when database="postgresql")

**Optional:**
- redis.service (when redis_enabled=true)
- mariadb.service (when database="mariadb")
- mysql.service (when database="mysql")

### Conditional Enablement

**Enabled by:** User enables MCP Context Forge feature

**Expression:**
```
features.mcp_gateway == true
```

### Template Files

1. `mcp-context-forge/mcp-context-forge.container.njk` - Quadlet container (extends base-container.njk)
2. `mcp-context-forge/mcp-context-forge.caddy.njk` - Caddy reverse proxy with CORS, WebSocket, long timeouts
3. `mcp-context-forge/postgres/mcp-context-forge-postgres.container.njk` - PostgreSQL database
4. `mcp-context-forge/postgres/mcp-context-forge-postgres.volume` - PostgreSQL data volume

Additional files (examples, not templates):
- `mcp-context-forge/mcp-catalog.yml.example` - Pre-configured MCP servers
- `mcp-context-forge/mcp-context-forge-secrets.env.example` - Secret template

### Special Features

- **Template Inheritance:** Uses `{% extends "../base-container.njk" %}`
- **Volume Mounts:**
  - `data_dir:/data:Z` (persistent - database, logs)
  - `config_dir:/config:ro,Z` (read-only - secrets, catalog)
  - `config_dir/mcp-catalog.yml:/app/mcp-catalog.yml:ro,Z` (optional)
  - `config_dir/jwt:/etc/jwt:ro,Z` (for asymmetric JWT keys)
- **Environment File:** Loads secrets from `config_dir/secrets.env`
- **Health Check:** `wget` with 120s start period (slow startup)
- **Caddy Features:**
  - WebSocket/SSE support (300s timeouts)
  - CORS enabled
  - Rate limiting (commented out)
  - Error handling
  - Request logging

### Database Options

**PostgreSQL (default):**
```
DATABASE_URL=postgresql://mcp@mcp-context-forge-postgres:5432/mcp
```

**SQLite (alternative):**
```
DATABASE_URL=sqlite:////data/mcp.db
```

**MariaDB/MySQL:**
```
DATABASE_URL=mysql+pymysql://mysql:${DB_PASSWORD}@mariadb:3306/mcp
```

### MCP Server Registration

MCP servers are NOT configured in the template. They are:
1. Pre-configured in `mcp-catalog.yml` (optional)
2. Registered via Admin UI at `/admin`
3. Registered via API: `POST /gateways`

### Integration Points

**OpenWebUI Integration:**
- Can connect OpenWebUI to MCP Context Forge as MCP client
- Provides unified access to all registered MCP servers

**External AI Agents (A2A):**
- When `a2a_enabled=true`, allows OpenAI/Anthropic agents to access MCP tools

**LLM Chat:**
- When `llmchat_enabled=true`, provides built-in chat interface

### Notes

- **Multi-Tenancy:** Email-based authentication with teams and RBAC
- **Federation:** Can federate with other MCP Context Forge instances
- **Observability:** OpenTelemetry support for Phoenix, Jaeger, Zipkin
- **Admin UI:** Real-time management dashboard at `/admin`
- **API Docs:** Interactive API documentation at `/docs`

---

## Service: mcp_context_forge_postgres

### Overview

PostgreSQL database for MCP Context Forge user data, teams, MCP server registrations, and sessions.

**Image:** `docker.io/postgres:17`
**Version:** 17

### Infrastructure

```json
{
  "port": 5432,
  "published_port": null,
  "container_name": "mcp-context-forge-postgres",
  "hostname": "mcp-context-forge-postgres",
  "db_name": "mcp",
  "db_user": "mcp",
  "volume": "mcp-context-forge-postgres.volume"
}
```

### Configuration Fields Accessed

- `infrastructure.network.name`
- `infrastructure.services.mcp_context_forge_postgres.container_name`
- `infrastructure.services.mcp_context_forge_postgres.db_name`
- `infrastructure.services.mcp_context_forge_postgres.db_user`
- `infrastructure.services.mcp_context_forge_postgres.volume`

### Environment Variables Generated

```bash
POSTGRES_DB=mcp
POSTGRES_USER=mcp
POSTGRES_HOST_AUTH_METHOD=trust  # Internal network only
```

### Dependencies

None (foundational service)

### Template Files

1. `mcp-context-forge/postgres/mcp-context-forge-postgres.container.njk`
2. `mcp-context-forge/postgres/mcp-context-forge-postgres.volume`

### Notes

- **No password:** Uses `trust` authentication (internal network only)
- **No pgvector:** Not needed for MCP Context Forge (unlike OpenWebUI/LiteLLM postgres)
- Health check: `pg_isready -U mcp`
- Volume: `/var/lib/postgresql/data`
- PostgreSQL 17 (latest major version)

---

## Cross-Service Relationships

### Service Dependency Graph

```
mcp-context-forge
  └─ mcp_context_forge_postgres

litellm
  ├─ litellm_postgres
  └─ litellm_redis

jupyter
  └─ litellm (for AI code completion)

llama-swap (standalone)

Integration flow:
  llama-swap → litellm → jupyter
                    ↓
             openwebui (not audited by agent2)
```

### Shared Infrastructure Elements

All services use:
- `infrastructure.network.name` → "llm" (network name)
- `infrastructure.network.subnet` → "10.89.0.0/24"
- `tailscale.full_hostname` → for external URLs

### Common Patterns

1. **Service Naming:**
   - Main service: `{service_name}`
   - Database: `{service_name}_postgres`
   - Cache: `{service_name}_redis`

2. **Port Allocation:**
   - Main services: Custom ports (4000, 4444, 8000, 8888)
   - PostgreSQL: Always 5432 (internal)
   - Redis: Always 6379 (internal)

3. **Volume Naming:**
   - Pattern: `{service_name}.volume`
   - PostgreSQL: `{service_name}-postgres.volume`
   - Redis: `{service_name}-redis.volume`

4. **Health Checks:**
   - HTTP services: `curl -f http://localhost:{port}/health`
   - PostgreSQL: `pg_isready -U {user}`
   - Redis: `redis-cli ping`

---

## Infrastructure Requirements Summary

### Ports Required

| Service | Internal Port | Published Port | Bind Address |
|---------|--------------|----------------|--------------|
| jupyter | 8888 | 8889 | 127.0.0.1 |
| litellm | 4000 | 4000 | 127.0.0.1 |
| litellm_postgres | 5432 | null | (internal) |
| litellm_redis | 6379 | null | (internal) |
| llama-swap | 8000 | 8000 | 127.0.0.1 |
| mcp-context-forge | 4444 | 4444 | 127.0.0.1 |
| mcp_context_forge_postgres | 5432 | null | (internal) |

### Volume Requirements

| Service | Volume Name | Container Path | Purpose |
|---------|------------|----------------|---------|
| jupyter | jupyter.volume | /home/jovyan/blueprint-workspace | Notebooks |
| litellm_postgres | litellm-postgres.volume | /var/lib/postgresql/data | Database |
| litellm_redis | litellm-redis.volume | /data | Cache |
| llama-swap | llama-swap.volume | /app/data | State |
| mcp-context-forge | (data_dir) | /data | Database, logs |
| mcp_context_forge_postgres | mcp-context-forge-postgres.volume | /var/lib/postgresql/data | Database |

Additional llama-swap mounts:
- Podman socket: `/run/user/%U/podman/podman.sock:/run/podman/podman.sock:Z`
- RamaLama cache: `${HOME}/.local/share/ramalama:/root/.local/share/ramalama:ro,Z`
- Config: `%h/.config/containers/systemd/llama-swap/config.yaml:/app/config.yaml:ro,Z`

Additional mcp-context-forge mounts:
- Config dir: `%h/.config/mcp-context-forge:/config:ro,Z`
- MCP catalog: `%h/.config/mcp-context-forge/mcp-catalog.yml:/app/mcp-catalog.yml:ro,Z` (optional)
- JWT keys: `%h/.config/mcp-context-forge/jwt:/etc/jwt:ro,Z` (for RS256/ES256)

### External Subdomains

| Service | Subdomain | Full URL Pattern |
|---------|-----------|------------------|
| jupyter | jupyter | https://jupyter.{tailscale.full_hostname} |
| litellm | llm | https://llm.{tailscale.full_hostname} |
| llama-swap | llama | https://llama.{tailscale.full_hostname} |
| mcp-context-forge | mcp | https://mcp.{tailscale.full_hostname} |

---

## Configuration Schema Requirements

### Top-Level Sections Needed

1. **infrastructure.services** - Service infrastructure definitions
2. **litellm** - LiteLLM model configurations
3. **local_inference** - Local model definitions for llama-swap
4. **secrets** - API keys and sensitive credentials
5. **tailscale** - External access configuration

### Required Provider Fields

None of the audited services use the standard provider selection pattern. However:

- **Code execution provider:** jupyter
- **Code interpreter provider:** jupyter
- **LLM models:** litellm (multi-provider)
- **Local models:** llama-swap

### Secrets Mapping

| Secret Path | Used By | Environment Variable |
|------------|---------|---------------------|
| secrets.api_keys.litellm_master | litellm, jupyter | LITELLM_MASTER_KEY |
| secrets.llm_providers.openai | litellm | OPENAI_API_KEY |
| secrets.llm_providers.anthropic | litellm | ANTHROPIC_API_KEY |
| secrets.llm_providers.gemini | litellm | GEMINI_API_KEY |
| secrets.llm_providers.openrouter | litellm | OPENROUTER_API_KEY |
| secrets.llm_providers.groq | litellm | GROQ_API_KEY |
| secrets.mcp.jwt_secret_key | mcp-context-forge | JWT_SECRET_KEY |
| secrets.mcp.admin_password | mcp-context-forge | ADMIN_PASSWORD |
| secrets.mcp.auth_encryption_secret | mcp-context-forge | AUTH_ENCRYPTION_SECRET |
| secrets.mcp.sso.* | mcp-context-forge | SSO_*_CLIENT_ID/SECRET |

---

## Issues and Recommendations

See `SCHEMA-ISSUES.md` for detailed list.

### Key Findings

1. **LiteLLM model configuration** is complex (cloud + local models)
2. **Local inference configuration** requires deep nesting (models, groups, defaults)
3. **MCP Context Forge** has 150+ environment variables (most have sensible defaults)
4. **Jupyter custom image** requires Dockerfile (not in templates)
5. **llama-swap** requires Podman socket access (security consideration)

### Template Quality

- ✅ All templates follow consistent patterns
- ✅ Extensive use of macros (publishPort, volumeMount, healthCheck, etc.)
- ✅ Template inheritance (base-container.njk)
- ✅ Comprehensive inline documentation
- ✅ Architecture notes in templates

---

## Agent 2 Audit Complete

**Date:** 2025-10-31
**Services Audited:** 7
**Templates Analyzed:** 16
**Status:** ✅ Complete
