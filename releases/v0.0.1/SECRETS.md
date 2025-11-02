# Leger Schema Secrets Management

## Philosophy: Real Secrets Only

The Leger schema distinguishes between **real secrets** (external cloud provider API keys) and **internal keys** (for inter-service communication):

### ✅ Real Secrets (use Secret= directives)
- **External cloud provider API keys** that users must register for
- Examples: OpenAI, Anthropic, Gemini, Groq, Mistral, OpenRouter, Perplexity
- Examples: Tavily Search, HuggingFace, CivitAI
- These are stored in Cloudflare KV → legerd → Podman secrets
- **Never hardcoded** - managed via `leger secrets sync`

### ❌ Internal Keys (hardcode as Environment=)
- **Internal service authentication** between containers
- Examples: LiteLLM master key, OpenWebUI secret key, SearXNG secret key
- Examples: MCP JWT secret, admin password, encryption keys
- These are **just for local inter-service auth**, not real secrets
- **Always hardcoded** in templates as `Environment=KEY=value`

## Five-Paragraph Explanation for Schema Developers

**Paragraph 1: The Core Problem and Solution**
Traditional infrastructure systems either embed all secrets in config files (insecure) or treat everything as a secret (overcomplicated). Leger uses a pragmatic approach: distinguish between **external cloud API keys** (which users pay for and must protect) versus **internal service keys** (which are just for communication between containers on the same network). External keys use the full Podman Secret= mechanism with Cloudflare KV storage. Internal keys are simply hardcoded as Environment= variables since they only matter within the isolated container network.

**Paragraph 2: Schema-Side Real Secrets**
The schema's `secrets` section contains ONLY external cloud provider API keys. Each secret has: (1) `default` with `{PLACEHOLDER}` pattern, (2) `x-sensitive: true` to mark as never-log, (3) `x-provider` indicating the cloud service (openai, anthropic, etc.), (4) `x-required-by` listing which services need it, and (5) `x-leger-namespace` showing where legerd stores it. These metadata fields enable the CLI to discover which providers a user has configured, fetch the actual keys from Cloudflare KV, and inject them at runtime via Podman's native secret store.

**Paragraph 3: Template-Side Secret Injection**
Templates use `Secret=secret_name,type=env,target=ENV_VAR` directives ONLY for real external API keys. For example, LiteLLM's template has `Secret=openai_api_key,type=env,target=OPENAI_API_KEY` for the real OpenAI key, but `Environment=LITELLM_MASTER_KEY=sk-1234` for the internal master key. Internal keys are hardcoded directly as Environment= variables because they're not real secrets—they're just tokens for local service-to-service authentication that never leave the container network.

**Paragraph 4: The CLI Workflow (Not Your Responsibility, But Critical Context)**
When a user runs `leger secrets sync`, the CLI: (1) reads user-config.json and finds all `{PLACEHOLDER}` patterns in the secrets section, (2) fetches actual values from Cloudflare KV (where users have stored their purchased API keys), (3) stores them in legerd at `leger/{user-uuid}/secret_name`, and (4) creates Podman secrets. During `leger deploy install`, quadlets reference these Podman secrets via `Secret=` directives, and Podman injects them as environment variables at container startup. The actual key values never touch disk—they flow: Cloudflare KV → legerd memory → Podman secret store (encrypted) → container memory.

**Paragraph 5: Validation and Naming Conventions**
Real secret names use **snake_case** (`openai_api_key`), placeholders use **{UPPER_SNAKE_CASE}** (`{OPENAI_API_KEY}`), and environment variable targets use **UPPER_SNAKE_CASE** (`OPENAI_API_KEY`). This three-tier convention lets the CLI discover secrets via regex (`^Secret=([^,]+)`), map them to legerd namespaces, and validate that every `Secret=` directive in a quadlet corresponds to a user-registered API key. If you add a new external provider to the schema, you must: (1) add it to `secrets` with full metadata, (2) add the corresponding `Secret=` directive to the appropriate service template, and (3) update the `litellmSecrets()` or `comfyuiSecrets()` macro if applicable.

---

## Current Real Secrets (10 External Providers)

### LLM Provider API Keys
| Secret | Provider | Register At |
|--------|----------|-------------|
| `openai_api_key` | OpenAI | https://platform.openai.com/api-keys |
| `anthropic_api_key` | Anthropic | https://console.anthropic.com/ |
| `gemini_api_key` | Google | https://makersuite.google.com/app/apikey |
| `groq_api_key` | Groq | https://console.groq.com/ |
| `mistral_api_key` | Mistral | https://console.mistral.ai/ |
| `openrouter_api_key` | OpenRouter | https://openrouter.ai/keys |
| `perplexity_api_key` | Perplexity | https://www.perplexity.ai/settings/api |

### Search and Model Registry Keys
| Secret | Provider | Register At |
|--------|----------|-------------|
| `tavily_api_key` | Tavily | https://tavily.com/ |
| `hf_token` | HuggingFace | https://huggingface.co/settings/tokens |
| `civitai_token` | CivitAI | https://civitai.com/user/account |

---

## Internal Keys (Hardcoded in Templates)

These are **NOT** in the secrets section because they're not real secrets:

| Service | Key | Template Location | Hardcoded Value |
|---------|-----|-------------------|-----------------|
| LiteLLM | `LITELLM_MASTER_KEY` | litellm.container.njk | `sk-1234` |
| OpenWebUI | `WEBUI_SECRET_KEY` | openwebui.container.njk | `t0p-secret-83kf92mf023` |
| OpenWebUI | `OPENAI_API_KEY` | openwebui.container.njk | `sk-1234` (points to LiteLLM) |
| SearXNG | `SEARXNG_SECRET_KEY` | searxng.container.njk | `ultrasecret-searxng-key-192kf8s` |
| MCP Context Forge | `JWT_SECRET_KEY` | mcp-context-forge.container.njk | `mcp-jwt-secret-key-9s8d7f6g5h4j3k2l1` |
| MCP Context Forge | `ADMIN_PASSWORD` | mcp-context-forge.container.njk | `changeme123` |
| MCP Context Forge | `AUTH_ENCRYPTION_SECRET` | mcp-context-forge.container.njk | `mcp-auth-encryption-secret-z9x8c7v6b5n4m3` |

**Why hardcode?** These keys only matter for local service-to-service communication on an isolated container network. They're not purchased from external providers, don't cost money, and aren't valuable to attackers. Hardcoding them simplifies the deployment model.

---

## Secret Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SCHEMA DEFINITION (real external secrets only)                │
├─────────────────────────────────────────────────────────────────┤
│ schema.json:                                                      │
│   "openai_api_key": {                                            │
│     "default": "{OPENAI_API_KEY}",                               │
│     "x-provider": "openai",                                      │
│     "x-sensitive": true                                          │
│   }                                                               │
│                                                                   │
│ Internal keys NOT in schema - hardcoded in templates             │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. TEMPLATE RENDERING (server-side)                              │
├─────────────────────────────────────────────────────────────────┤
│ litellm.container.njk:                                            │
│   Environment=LITELLM_MASTER_KEY=sk-1234  ← Hardcoded            │
│   Secret=openai_api_key,type=env,target=OPENAI_API_KEY  ← Real  │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. SECRET SYNC ($ leger secrets sync)                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. Find {OPENAI_API_KEY} placeholder in user-config.json        │
│ 2. Fetch actual key from Cloudflare KV                           │
│ 3. Store in legerd: leger/{user-uuid}/openai_api_key             │
│ 4. Create Podman secret: podman secret create openai_api_key     │
│                                                                   │
│ Internal keys skipped - already hardcoded in quadlets            │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. RUNTIME (Podman injects real secrets, uses hardcoded keys)    │
├─────────────────────────────────────────────────────────────────┤
│ Podman reads: Secret=openai_api_key,type=env,target=OPENAI_API_KEY │
│ Injects: OPENAI_API_KEY=sk-proj-actual-key-from-podman-store     │
│                                                                   │
│ Podman reads: Environment=LITELLM_MASTER_KEY=sk-1234             │
│ Injects: LITELLM_MASTER_KEY=sk-1234 (hardcoded, no secret store) │
└─────────────────────────────────────────────────────────────────┘
```

---

## Adding a New External Provider

Example: Adding Cohere API support

**Step 1**: Add to `schema.json`
```json
{
  "secrets": {
    "cohere_api_key": {
      "type": "string",
      "title": "Cohere API Key",
      "description": "Cohere API key for command models. Register at https://dashboard.cohere.com/api-keys",
      "default": "{COHERE_API_KEY}",
      "x-sensitive": true,
      "x-secret-type": "api-key",
      "x-provider": "cohere",
      "x-required-by": ["litellm"],
      "x-required-when": {
        "comment": "Required when using Cohere models in LiteLLM config"
      },
      "x-leger-namespace": "leger/{user-uuid}/cohere_api_key"
    }
  }
}
```

**Step 2**: Add to LiteLLM template (`litellm.container.njk`)
```nunjucks
{% block secrets %}
# External LLM Provider API Keys
Secret=openai_api_key,type=env,target=OPENAI_API_KEY
Secret=anthropic_api_key,type=env,target=ANTHROPIC_API_KEY
Secret=cohere_api_key,type=env,target=COHERE_API_KEY  ← Add this
{% endblock %}
```

**Step 3**: Update macro (`templates/base/macros.njk`)
```nunjucks
{% macro litellmSecrets() %}
# External LLM Provider API Keys
Secret=openai_api_key,type=env,target=OPENAI_API_KEY
Secret=anthropic_api_key,type=env,target=ANTHROPIC_API_KEY
Secret=cohere_api_key,type=env,target=COHERE_API_KEY  ← Add this
{% endmacro %}
```

---

## Security Model

### Real Secrets Protection
```
User purchases API key → Stores in Cloudflare KV → leger secrets sync fetches
→ Stores in legerd (encrypted) → Creates Podman secret (encrypted)
→ Podman injects into container memory at runtime
→ Never touches disk unencrypted
```

### Internal Keys (No Protection Needed)
```
Developer hardcodes in template → leger deploy renders quadlet
→ Environment=KEY=value in .container file
→ Podman reads and injects
→ Only matters within isolated container network
```

---

## Key Differences from Original Implementation

| Aspect | Original (Over-Engineered) | Current (Pragmatic) |
|--------|----------------------------|---------------------|
| LiteLLM Master Key | Secret= directive + legerd | Hardcoded: `sk-1234` |
| OpenWebUI Secret | Secret= directive + legerd | Hardcoded: `t0p-secret-83kf92mf023` |
| SearXNG Secret | Secret= directive + legerd | Hardcoded: `ultrasecret-searxng-key-192kf8s` |
| MCP Keys | Secret= directives + legerd | Hardcoded in template |
| PostgreSQL Passwords | Planned for future | Using `trust` auth (internal only) |
| **OpenAI API Key** | ✅ Secret= + legerd | ✅ Secret= + legerd (REAL SECRET) |
| **Anthropic API Key** | ✅ Secret= + legerd | ✅ Secret= + legerd (REAL SECRET) |
| **Mistral API Key** | ❌ Not included | ✅ Secret= + legerd (NEW) |
| **Perplexity API Key** | ❌ Not included | ✅ Secret= + legerd (NEW) |

---

## Troubleshooting

### Problem: "Secret not found" error for external API key

**Diagnosis**:
```bash
# Check if secret exists in Podman
podman secret ls | grep openai_api_key

# Check if secret exists in legerd
curl http://localhost:8080/secrets/leger/{user-uuid}/openai_api_key
```

**Solution**: Run `leger secrets sync` to fetch from Cloudflare KV and create Podman secrets.

### Problem: Internal key not working

**Check template**: Ensure hardcoded value is correct in the `.container.njk` file.
```bash
# View rendered quadlet
cat ~/.config/containers/systemd/litellm.container | grep LITELLM_MASTER_KEY
# Should show: Environment=LITELLM_MASTER_KEY=sk-1234
```

**Solution**: If missing, re-run `leger deploy install` to regenerate quadlets from templates.

---

## Version History

- **v0.0.2** (2025-02-02): Refactored to real-secrets-only model
  - Removed 6 internal "secrets" (litellm_master_key, openwebui_secret_key, searxng_secret_key, mcp_jwt_secret_key, mcp_admin_password, mcp_auth_encryption_secret)
  - Removed 3 PostgreSQL password placeholders (using trust auth instead)
  - Added 2 new real external secrets (mistral_api_key, perplexity_api_key)
  - Total: 10 real external cloud provider API secrets
  - Updated templates to hardcode internal keys as Environment= variables
  - Updated macros to only handle real external secrets
  - Clarified philosophy: real secrets (external cloud APIs) vs internal keys (hardcoded)

- **v0.0.1** (2025-02-02): Initial secret placeholder mechanism
  - 16 secrets total (mix of real and internal)
  - All used Secret= directives (over-engineered)
