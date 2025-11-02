# Leger Schema Secrets Management

## Overview

The Leger schema implements a **placeholder-based secret management system** that keeps sensitive data completely separate from configuration files and templates. Secrets are **never** stored in `schema.json`, user config files, or rendered Nunjucks templates. Instead, they use a `{PLACEHOLDER}` pattern that the Leger CLI resolves at runtime using Podman's native secret injection mechanism.

## Architecture

### Five-Paragraph Explanation for Schema Developers

**Paragraph 1: The Core Problem**
Traditional infrastructure-as-code systems embed API keys, passwords, and tokens directly in configuration files, environment variables, or templates. This creates security risks: secrets get committed to version control, logged in plaintext, and exposed through config file access. The Leger schema solves this by treating secrets as **pointers**, not values. In `schema.json`, a secret is defined as `{"default": "{OPENAI_API_KEY}"}` — just a placeholder template that indicates "this is where a secret goes," not the secret itself.

**Paragraph 2: Schema-Side Responsibilities**
The schema's job is to **declare what secrets exist** and **provide metadata** for the CLI to use. Each secret in `schema.json` has five critical attributes: (1) `default` — the `{PLACEHOLDER}` pattern in UPPER_SNAKE_CASE, (2) `x-sensitive: true` — marks it as never-log-never-display, (3) `x-required-by` — array of services that need this secret, (4) `x-leger-namespace` — the full path where legerd stores it (`leger/{user-uuid}/secret_name`), and (5) `x-secret-type` — classification like "api-key", "password", or "token". These metadata fields are NOT for runtime; they're for the CLI's validation, discovery, and namespace routing logic.

**Paragraph 3: Template-Side Secret Injection**
Nunjucks templates **must never** use `Environment=` directives for secrets. Instead, they use Podman Quadlet's `Secret=` directive format: `Secret=secret_name,type=env,target=ENV_VAR`. For example, LiteLLM's template has `Secret=openai_api_key,type=env,target=OPENAI_API_KEY`. This tells Podman: "Fetch the secret named `openai_api_key` from Podman's secret store and inject it as the `OPENAI_API_KEY` environment variable at container runtime." The secret value never touches the quadlet file, env file, or disk — it exists only in Podman's encrypted secret store and the container's memory.

**Paragraph 4: The CLI Workflow (Not Your Responsibility, But Critical Context)**
When a user runs `leger secrets sync`, the CLI: (1) reads `user-config.json` and finds all `{PLACEHOLDER}` patterns in the `secrets` section, (2) fetches the actual secret values from Cloudflare KV using the placeholder name, (3) stores them in the `legerd` daemon (a setec fork) at the namespaced path `leger/{user-uuid}/secret_name`, and (4) creates Podman secrets with `podman secret create secret_name`. Later, when `leger deploy install` runs, the CLI parses all `Secret=` directives from rendered quadlets, fetches the values from legerd, and ensures Podman secrets exist before systemd starts the containers. The secrets flow: Cloudflare KV → legerd → Podman secret store → container memory (never disk).

**Paragraph 5: Validation and Naming Conventions**
Secret names in `schema.json` use **snake_case** (`openai_api_key`), placeholders use **UPPER_SNAKE_CASE** (`{OPENAI_API_KEY}`), Podman secret names match the schema key (`openai_api_key`), and environment variable targets use **UPPER_SNAKE_CASE** (`OPENAI_API_KEY`). This three-tier naming convention ensures the CLI can discover secrets via regex (`^Secret=([^,]+)`), map them to legerd namespaces, and validate that every `Secret=` directive in a quadlet has a corresponding entry in `schema.json`. If you add a secret to the schema, you must add it to the appropriate service templates using `Secret=` directives — otherwise, the CLI's validation step will fail, and deployment will abort.

---

## Secret Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SCHEMA DEFINITION (leger-labs/schema repo)                    │
├─────────────────────────────────────────────────────────────────┤
│ schema.json:                                                      │
│   "openai_api_key": {                                            │
│     "default": "{OPENAI_API_KEY}",                               │
│     "x-sensitive": true,                                         │
│     "x-required-by": ["litellm"],                                │
│     "x-leger-namespace": "leger/{user-uuid}/openai_api_key"      │
│   }                                                               │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. USER CONFIGURATION (user-config.json)                         │
├─────────────────────────────────────────────────────────────────┤
│ {                                                                 │
│   "secrets": {                                                    │
│     "openai_api_key": "{OPENAI_API_KEY}"  ← Inherits from schema │
│   }                                                               │
│ }                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. TEMPLATE RENDERING (server-side, templates/*.njk)             │
├─────────────────────────────────────────────────────────────────┤
│ litellm.container.njk:                                            │
│   Secret=openai_api_key,type=env,target=OPENAI_API_KEY           │
│                                                                   │
│ Generated Quadlet:                                                │
│   [Container]                                                     │
│   Secret=openai_api_key,type=env,target=OPENAI_API_KEY           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. SECRET SYNC ($ leger secrets sync)                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. Parse user-config.json                                        │
│ 2. Find {OPENAI_API_KEY} placeholder                             │
│ 3. Fetch actual value from Cloudflare KV                         │
│ 4. Store in legerd: leger/{user-uuid}/openai_api_key             │
│ 5. Create Podman secret: podman secret create openai_api_key     │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. DEPLOYMENT ($ leger deploy install)                           │
├─────────────────────────────────────────────────────────────────┤
│ 1. Pull rendered quadlets from backend                           │
│ 2. Parse Secret= directives                                      │
│ 3. Validate secrets exist in legerd                              │
│ 4. Fetch values from legerd via setec                            │
│ 5. Ensure Podman secrets exist                                   │
│ 6. Install quadlets to ~/.config/containers/systemd/             │
│ 7. systemctl --user daemon-reload                                │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. RUNTIME (Podman + Systemd)                                    │
├─────────────────────────────────────────────────────────────────┤
│ Podman reads Secret= directive from quadlet                       │
│ Fetches secret from ~/.local/share/containers/storage/secrets/   │
│ Injects as OPENAI_API_KEY environment variable                   │
│ Secret exists ONLY in container memory (never on disk)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schema Definition Reference

### Secret Properties

All secrets in `schema.json` must follow this structure:

```json
{
  "secrets": {
    "secret_name": {
      "type": "string",
      "title": "Human-Readable Title",
      "description": "Detailed description of what this secret is for",
      "default": "{PLACEHOLDER_NAME}",
      "x-sensitive": true,
      "x-secret-type": "api-key|token|password|certificate",
      "x-required-by": ["service1", "service2"],
      "x-required-when": {
        "providers.some_provider": "specific_value"
      },
      "x-leger-namespace": "leger/{user-uuid}/secret_name"
    }
  }
}
```

### Metadata Fields Explained

| Field | Required | Purpose | Example |
|-------|----------|---------|---------|
| `type` | Yes | JSON Schema type (always "string" for secrets) | `"string"` |
| `title` | Yes | Human-readable name for UI/docs | `"OpenAI API Key"` |
| `description` | Yes | What the secret is used for | `"API key for OpenAI GPT models"` |
| `default` | Yes | Placeholder pattern (UPPER_SNAKE_CASE in braces) | `"{OPENAI_API_KEY}"` |
| `x-sensitive` | Yes | Marks as never-log/never-display (MUST be `true`) | `true` |
| `x-secret-type` | Yes | Classification for auditing/validation | `"api-key"`, `"password"`, `"token"` |
| `x-required-by` | Yes | Services that need this secret (for dependency checks) | `["litellm", "openwebui"]` |
| `x-required-when` | Optional | Conditional requirement based on config | `{"providers.stt_engine": "openai"}` |
| `x-leger-namespace` | Yes | Full path in legerd (for CLI routing) | `"leger/{user-uuid}/openai_api_key"` |

### Naming Conventions

**CRITICAL**: Secret naming must follow this exact pattern:

1. **Schema Key** (snake_case): `openai_api_key`
   - Used in `schema.json` properties
   - Used as Podman secret name
   - Used in `Secret=` directives

2. **Placeholder** (UPPER_SNAKE_CASE in braces): `{OPENAI_API_KEY}`
   - Used in `default` field
   - Used in user-config.json
   - Detected by CLI regex: `/^\{([A-Z_]+)\}$/`

3. **Environment Variable Target** (UPPER_SNAKE_CASE): `OPENAI_API_KEY`
   - Used in container runtime
   - Specified in `Secret=...,target=OPENAI_API_KEY`

**Example Mapping**:
```
schema.json key:     openai_api_key
placeholder:         {OPENAI_API_KEY}
podman secret name:  openai_api_key
env var in container: OPENAI_API_KEY
legerd namespace:    leger/{user-uuid}/openai_api_key
```

---

## Template Integration

### The Secret= Directive Format

Podman Quadlet supports two types of secret injection:

```ini
# 1. Environment variable (most common)
Secret=secret_name,type=env,target=ENV_VAR_NAME

# 2. File mount (for certs, SSH keys, etc.)
Secret=secret_name,type=mount,target=/path/in/container
```

### Template Block Structure

All service templates extending `base-container.njk` should include a `secrets` block:

```nunjucks
{% block secrets %}
# ═══════════════════════════════════════════════════════════════
# 🔐 SECRETS - Injected via Podman Secrets
# ═══════════════════════════════════════════════════════════════
Secret=secret_name,type=env,target=SECRET_ENV_VAR
{% endblock %}
```

### Secret Macros Reference

The schema provides reusable macros in `templates/services/macros.njk`:

```nunjucks
{% import "macros.njk" as m %}

{# Single secret injection #}
{{ m.secret("openai_api_key", "OPENAI_API_KEY") }}

{# Service-specific bundles #}
{{ m.litellmSecrets() }}     {# All LLM provider keys #}
{{ m.openwebuiSecrets() }}   {# OpenWebUI + LiteLLM key #}
{{ m.searxngSecrets() }}     {# SearXNG secret key #}
{{ m.mcpSecrets() }}         {# MCP JWT, admin, encryption #}
{{ m.comfyuiSecrets() }}     {# HuggingFace, CivitAI tokens #}

{# PostgreSQL password #}
{{ m.postgresSecret("openwebui_postgres_password") }}

{# File-based secret (TLS cert, SSH key) #}
{{ m.secretFile("tls_cert", "/etc/ssl/cert.pem") }}
```

### Example: Adding a New Secret to a Service

**Step 1**: Add to `schema.json`
```json
{
  "secrets": {
    "replicate_api_key": {
      "type": "string",
      "title": "Replicate API Key",
      "description": "API key for Replicate model hosting",
      "default": "{REPLICATE_API_KEY}",
      "x-sensitive": true,
      "x-secret-type": "api-key",
      "x-required-by": ["comfyui"],
      "x-required-when": {
        "providers.image_engine": "comfyui"
      },
      "x-leger-namespace": "leger/{user-uuid}/replicate_api_key"
    }
  }
}
```

**Step 2**: Add to template (e.g., `comfyui.container.njk`)
```nunjucks
{% block secrets %}
# ComfyUI Model Download Tokens
Secret=hf_token,type=env,target=HF_TOKEN
Secret=civitai_token,type=env,target=CIVITAI_TOKEN
Secret=replicate_api_key,type=env,target=REPLICATE_API_KEY
{% endblock %}
```

**Step 3**: Document in macro (optional, for reusability)
```nunjucks
{% macro comfyuiSecrets() %}
# HuggingFace Token
Secret=hf_token,type=env,target=HF_TOKEN

# CivitAI Token
Secret=civitai_token,type=env,target=CIVITAI_TOKEN

# Replicate API Key
Secret=replicate_api_key,type=env,target=REPLICATE_API_KEY
{% endmacro %}
```

---

## Security Principles

### ✅ DO

1. **Always use `{PLACEHOLDER}` format** in schema defaults
2. **Always mark secrets with `x-sensitive: true`**
3. **Always use `Secret=` directives** in templates (never `Environment=`)
4. **Always provide `x-required-by`** metadata for dependency tracking
5. **Always use snake_case** for schema keys and Podman secret names
6. **Always validate** schema changes with `jq '.' schema.json`

### ❌ DON'T

1. **NEVER put actual secret values** in schema.json or user-config.json
2. **NEVER use `Environment=`** for sensitive data in templates
3. **NEVER break the `{PLACEHOLDER}` pattern** (must be `{UPPER_SNAKE}`)
4. **NEVER hardcode secrets** in .env files or EnvironmentFile directives
5. **NEVER log or display** values of x-sensitive fields
6. **NEVER remove secrets** that existing quadlets depend on without migration

---

## CLI Integration Points

### Secret Discovery (quadlet/parser.go)

The CLI uses this regex to find secrets in quadlets:
```go
secretRegex := regexp.MustCompile(`^Secret=([^,]+)`)
```

Your responsibility: Ensure all `Secret=` directives are **parseable** and **match schema keys exactly**.

### Secret Validation (cli/secrets.go)

The CLI validates:
1. All `{PLACEHOLDER}` patterns in user-config exist in Cloudflare KV
2. All `Secret=` directives in quadlets have corresponding Podman secrets
3. All secrets marked `x-required-by: ["service"]` exist when that service is enabled

Your responsibility: Maintain accurate `x-required-by` metadata.

### Namespace Routing (daemon/client.go)

The CLI uses `x-leger-namespace` to route secrets to the correct legerd path:
```
schema:  "x-leger-namespace": "leger/{user-uuid}/openai_api_key"
legerd:  leger/01234567-89ab-cdef-0123-456789abcdef/openai_api_key
podman:  openai_api_key
```

Your responsibility: Keep `x-leger-namespace` templates accurate.

---

## Current Secrets Inventory

### Core Application Secrets

| Secret | Type | Required By | Description |
|--------|------|-------------|-------------|
| `openwebui_secret_key` | token | openwebui | Django session encryption key |
| `litellm_master_key` | api-key | litellm, openwebui | LiteLLM proxy authentication |

### LLM Provider API Keys

| Secret | Type | Required By | Description |
|--------|------|-------------|-------------|
| `openai_api_key` | api-key | litellm | OpenAI GPT models |
| `anthropic_api_key` | api-key | litellm | Anthropic Claude models |
| `gemini_api_key` | api-key | litellm | Google Gemini models |
| `openrouter_api_key` | api-key | litellm | OpenRouter unified access |
| `groq_api_key` | api-key | litellm | Groq fast inference |

### Feature-Specific Secrets

| Secret | Type | Required By | Required When | Description |
|--------|------|-------------|---------------|-------------|
| `searxng_secret_key` | token | searxng | `providers.web_search_engine == "searxng"` | SearXNG session encryption |
| `hf_token` | token | comfyui | `providers.image_engine == "comfyui"` | HuggingFace model downloads |
| `civitai_token` | token | comfyui | `providers.image_engine == "comfyui"` | CivitAI model downloads |

### MCP Context Forge Secrets

| Secret | Type | Required By | Description |
|--------|------|-------------|-------------|
| `mcp_jwt_secret_key` | token | mcp_context_forge | JWT signing secret |
| `mcp_admin_password` | password | mcp_context_forge | Admin account password |
| `mcp_auth_encryption_secret` | token | mcp_context_forge | Credential encryption key |

### Database Passwords (Optional, for future use)

| Secret | Type | Required By | Description |
|--------|------|-------------|-------------|
| `openwebui_postgres_password` | password | openwebui_postgres | OpenWebUI PostgreSQL password |
| `litellm_postgres_password` | password | litellm_postgres | LiteLLM PostgreSQL password |
| `mcp_postgres_password` | password | mcp_context_forge_postgres | MCP PostgreSQL password |

**Note**: PostgreSQL containers currently use `POSTGRES_HOST_AUTH_METHOD=trust` for internal-only access. Passwords are available in the schema for future enhanced security if needed.

---

## Troubleshooting

### Problem: Secret not injected into container

**Diagnosis**:
```bash
# Check Podman secret exists
podman secret ls | grep openai_api_key

# Check legerd has the secret
curl -X GET http://localhost:8080/secrets/leger/{user-uuid}/openai_api_key

# Check quadlet has Secret= directive
cat ~/.config/containers/systemd/litellm.container
```

**Solution**: Ensure `leger secrets sync` ran successfully and `Secret=` directive is in quadlet.

### Problem: Schema validation fails

**Diagnosis**:
```bash
# Validate JSON syntax
jq '.' releases/v0.0.1/schema.json

# Check for required fields
jq '.secrets | to_entries | map(select(.value["x-sensitive"] != true))' schema.json
```

**Solution**: Ensure all secrets have `x-sensitive: true` and valid `{PLACEHOLDER}` defaults.

### Problem: CLI can't find secret in quadlet

**Diagnosis**:
```bash
# Test regex manually
grep '^Secret=' ~/.config/containers/systemd/*.container
```

**Solution**: Ensure `Secret=` directives are at line start (no leading whitespace in rendered quadlet).

---

## Migration Guide: Converting Existing Secrets

If you find secrets using `Environment=` directives:

**Before**:
```nunjucks
{% block environment %}
Environment=OPENAI_API_KEY={{ secrets.openai_api_key }}
{% endblock %}
```

**After**:
```nunjucks
{% block environment %}
# Non-sensitive config only
Environment=OPENAI_API_BASE_URL=http://litellm:4000/v1
{% endblock %}

{% block secrets %}
# Secrets injected via Podman Secret= directives
Secret=openai_api_key,type=env,target=OPENAI_API_KEY
{% endblock %}
```

**Checklist**:
1. Remove `Environment=SECRET_NAME={{ ... }}` from environment block
2. Add `Secret=secret_name,type=env,target=SECRET_NAME` to secrets block
3. Ensure `secret_name` exists in `schema.json` secrets section
4. Verify `x-sensitive: true` is set
5. Test with `leger secrets sync && leger deploy install`

---

## References

- **Podman Quadlet Secrets**: https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html#secret-directive
- **Leger CLI Source**: https://github.com/leger-labs/leger (internal/cli/secrets.go)
- **Setec Protocol**: https://github.com/tailscale/setec
- **JSON Schema Spec**: https://json-schema.org/draft-07/schema

---

## Version History

- **v0.0.1** (2025-02-02): Initial secret placeholder mechanism implementation
  - Added 16 secrets to schema.json with full metadata
  - Created secret macros in templates/services/macros.njk
  - Updated litellm, openwebui, searxng, mcp-context-forge templates
  - Added secrets block to base-container.njk template
  - Documented secret flow and naming conventions
