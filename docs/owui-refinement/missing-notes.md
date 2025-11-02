# Reconciliation Analysis: Schema vs Template vs Docs

## The Real Issue: Namespace Architecture

After careful analysis, I found the core problem isn't 160 missing variables - it's a **structural mismatch** between what the template expects and what the schema provides.

### Current State

**Template expects:**
```nunjucks
{{ openwebui.general.webui_name }}
{{ openwebui.providers.vector_db }}
{{ openwebui.rag_embedding_config.openai.model }}
```

**Schema provides:**
```json
{
  "features": { ... },      // Top-level, no openwebui prefix
  "providers": { ... },     // Top-level, no openwebui prefix
  "provider_config": { ... } // Top-level, no openwebui prefix
}
```

**The template expects an `openwebui` namespace that doesn't exist in the schema!**

---

## Actual Missing Variables (Critical vs Optional)

### ✅ CRITICAL - Must Be User-Configurable (9 variables)

These significantly affect user experience and should be in schema:

1. **`webui_name`** - Branding (e.g., "Leger AI", "My Company AI")
   - **Location**: `infrastructure.services.openwebui.webui_name`
   - **Default**: "Leger AI"
   - **Why**: Users want to brand their instance

2. **`default_user_role`** - Security policy
   - **Location**: `provider_config.default_user_role`
   - **Default**: "pending"
   - **Enum**: ["pending", "user", "admin"]
   - **Why**: Critical security decision

3. **`rag_embedding_model`** - Cost/performance tradeoff
   - **Location**: `provider_config.rag_embedding_model`
   - **Default**: "text-embedding-3-small"
   - **Depends**: `providers.rag_embedding == "openai"`
   - **Why**: Different models have different costs/quality

4. **`audio_tts_voice`** - User preference
   - **Location**: `provider_config.audio_tts_voice`
   - **Default**: "alloy"
   - **Depends**: `providers.tts_engine == "openai"`
   - **Why**: Voice is a personal preference

5. **`audio_stt_model`** - Model selection
   - **Location**: `provider_config.audio_stt_model`
   - **Default**: "whisper-1"
   - **Depends**: `providers.stt_engine == "openai"`

6. **`audio_tts_model`** - Model selection
   - **Location**: `provider_config.audio_tts_model`
   - **Default**: "tts-1"
   - **Depends**: `providers.tts_engine == "openai"`

7. **`task_model_title`** - AI model for title generation
   - **Location**: `provider_config.task_model_title`
   - **Default**: ""
   - **Depends**: `features.title_generation == true`
   - **Why**: Users may want to use different/cheaper models for tasks

8. **`task_model_tags`** - AI model for tags generation
   - **Location**: `provider_config.task_model_tags`
   - **Default**: ""
   - **Depends**: `features.tags_generation == true`

9. **`task_model_query`** - AI model for query generation
   - **Location**: `provider_config.task_model_query`
   - **Default**: ""
   - **Depends**: `features.rag == true`

---

### ⚙️ OPTIONAL - Nice to Have (8 variables)

Advanced users might want these, but defaults are fine:

10. **`custom_name`** - Instance label
    - **Location**: `provider_config.custom_name`
    - **Default**: ""
    - **Why**: Empty is fine, but some may want "Dev", "Staging", etc.

11. **`log_level`** - Logging verbosity
    - **Location**: `provider_config.log_level`
    - **Default**: "INFO"
    - **Enum**: ["DEBUG", "INFO", "WARNING", "ERROR"]
    - **Why**: Debugging

12. **`chroma_tenant`** - ChromaDB multitenancy
    - **Location**: `provider_config.chroma_tenant`
    - **Default**: "default_tenant"
    - **Depends**: `providers.vector_db == "chroma"`

13. **`chroma_database`** - ChromaDB database name
    - **Location**: `provider_config.chroma_database`
    - **Default**: "default_database"
    - **Depends**: `providers.vector_db == "chroma"`

14. **`jupyter_auth_type`** - Jupyter auth method
    - **Location**: `provider_config.jupyter_auth_type`
    - **Default**: "token"
    - **Enum**: ["token", "password", "none"]
    - **Depends**: `providers.code_execution_engine == "jupyter"`

15. **`jupyter_timeout`** - Jupyter execution timeout
    - **Location**: `provider_config.jupyter_timeout`
    - **Default**: 300
    - **Depends**: `providers.code_execution_engine == "jupyter"`

16. **`redis_key_prefix`** - Redis namespace
    - **Location**: `provider_config.redis_key_prefix`
    - **Default**: "open-webui"

17. **`ollama_embedding_model`** - Ollama embedding model
    - **Location**: `provider_config.ollama_embedding_model`
    - **Default**: "nomic-embed-text"
    - **Depends**: `providers.rag_embedding == "ollama"`

---

### 🔒 HARDCODED - Never User-Configurable (13 variables)

These should be **constructed or hardcoded in the template only**:

18. **`DATABASE_URL`** - ✅ Already constructed from `infrastructure.services.openwebui_postgres.*`
19. **`OPENAI_API_BASE_URL`** - ✅ Construct from `infrastructure.services.litellm.*` → `http://litellm:4000/v1`
20. **`RAG_OPENAI_API_BASE_URL`** - ✅ Same as above
21. **`AUDIO_STT_OPENAI_API_BASE_URL`** - ✅ Same as above
22. **`AUDIO_TTS_OPENAI_API_BASE_URL`** - ✅ Same as above
23. **`JUPYTER_URL`** - ✅ Construct from `infrastructure.services.jupyter.*` → `http://jupyter:8888`
24. **`REDIS_URL`** - ✅ Construct from `infrastructure.services.openwebui_redis.*`
25. **`WEBSOCKET_REDIS_URL`** - ✅ Same as above with different DB number
26. **`PGVECTOR_DB_URL`** - ✅ Same as DATABASE_URL
27. **`OLLAMA_BASE_URL`** - ✅ Construct from `infrastructure.services.llama_swap.*` → `http://llama-swap:8000`
28. **`TIKA_SERVER_URL`** - ✅ Already in schema as `provider_config.tika_server_url`
29. **`SEARXNG_QUERY_URL`** - ✅ Already in schema as `provider_config.searxng_query_url`
30. **`WEBUI_AUTH`** - ✅ Derive from `providers.auth_provider` (map "local" → "true", "oauth" → "oauth", etc.)
31. **`ENABLE_SIGNUP`** - ✅ Derive from `features.oauth_signup` boolean

---

## Strategy: Three-Tier Decision Model

### Tier 1: Add to Schema (17 variables)
Variables that users commonly need to configure:
- All 9 CRITICAL variables
- All 8 OPTIONAL variables

### Tier 2: Hardcode in Template (13 variables)
Variables that are constructed from infrastructure or security-sensitive:
- All service URLs (DATABASE_URL, OPENAI_API_BASE_URL, etc.)
- Derived booleans (WEBUI_AUTH from providers.auth_provider)

### Tier 3: Not Needed (160+ variables)
The OpenWebUI docs list 200+ variables, but most are for:
- Enterprise features you don't use (LDAP, SCIM, OAuth providers)
- Advanced features not enabled (multiple vector DBs, all search engines)
- Performance tuning (database pool sizes, timeouts)
- Observability (OpenTelemetry)

**Decision: Don't add these unless a feature is actually used.**

---

## Namespace Fix Required

The template uses `openwebui.*` but schema doesn't have this structure. Two options:

### Option A: Add `openwebui` wrapper in schema
```json
{
  "openwebui": {
    "general": { "webui_name", "log_level", etc. },
    "features": { /* move from top-level */ },
    "providers": { /* move from top-level */ },
    "provider_config": { /* move from top-level */ }
  }
}
```

### Option B: Update template to match current schema structure
```nunjucks
{{ features.rag }}                    // Not openwebui.features.rag
{{ providers.vector_db }}             // Not openwebui.providers.vector_db
{{ provider_config.rag_embedding_model }}  // Not openwebui.rag_embedding_config...
```

**Recommendation: Option B** - Keep schema flat, fix template references.

---

## Handoff Instructions for Implementation

### Phase 1: Fix Namespace Mismatch
1. Update `openwebui.env.njk` to use correct schema paths:
   - `openwebui.features.*` → `features.*`
   - `openwebui.providers.*` → `providers.*`
   - `openwebui.general.*` → Create as `provider_config.*`
   - `openwebui.vector_db_config.*` → `provider_config.*`
   - etc.

### Phase 2: Add 17 New Schema Fields

Add to `provider_config` section:

```json
{
  "provider_config": {
    "properties": {
      // CRITICAL (9)
      "webui_name": {
        "type": "string",
        "title": "WebUI Instance Name",
        "description": "The name displayed in the interface header",
        "default": "Leger AI",
        "x-category": "Core",
        "x-display-order": 10
      },
      "default_user_role": {
        "type": "string",
        "title": "Default User Role",
        "enum": ["pending", "user", "admin"],
        "default": "pending",
        "x-category": "Security",
        "x-display-order": 201
      },
      "rag_embedding_model": {
        "type": "string",
        "title": "RAG Embedding Model",
        "default": "text-embedding-3-small",
        "x-depends-on": {
          "providers.rag_embedding": "openai"
        },
        "x-category": "Providers",
        "x-display-order": 111
      },
      "audio_tts_voice": {
        "type": "string",
        "title": "TTS Voice",
        "default": "alloy",
        "x-depends-on": {
          "providers.tts_engine": "openai"
        },
        "x-category": "Providers",
        "x-display-order": 132
      },
      "audio_stt_model": {
        "type": "string",
        "title": "STT Model",
        "default": "whisper-1",
        "x-depends-on": {
          "providers.stt_engine": "openai"
        },
        "x-category": "Providers",
        "x-display-order": 131
      },
      "audio_tts_model": {
        "type": "string",
        "title": "TTS Model",
        "default": "tts-1",
        "x-depends-on": {
          "providers.tts_engine": "openai"
        },
        "x-category": "Providers",
        "x-display-order": 133
      },
      "task_model_title": {
        "type": "string",
        "title": "Task Model: Title Generation",
        "default": "",
        "x-depends-on": {
          "features.title_generation": true
        },
        "x-category": "Advanced",
        "x-display-order": 301
      },
      "task_model_tags": {
        "type": "string",
        "title": "Task Model: Tags Generation",
        "default": "",
        "x-depends-on": {
          "features.tags_generation": true
        },
        "x-category": "Advanced",
        "x-display-order": 302
      },
      "task_model_query": {
        "type": "string",
        "title": "Task Model: Query Generation",
        "default": "",
        "x-depends-on": {
          "features.rag": true
        },
        "x-category": "Advanced",
        "x-display-order": 303
      },
      
      // OPTIONAL (8)
      "custom_name": {
        "type": "string",
        "title": "Custom Instance Label",
        "default": "",
        "x-category": "Core",
        "x-display-order": 11
      },
      "log_level": {
        "type": "string",
        "title": "Log Level",
        "enum": ["DEBUG", "INFO", "WARNING", "ERROR"],
        "default": "INFO",
        "x-category": "Advanced",
        "x-display-order": 600
      },
      "chroma_tenant": {
        "type": "string",
        "title": "ChromaDB Tenant",
        "default": "default_tenant",
        "x-depends-on": {
          "providers.vector_db": "chroma"
        },
        "x-category": "Providers",
        "x-display-order": 105
      },
      "chroma_database": {
        "type": "string",
        "title": "ChromaDB Database",
        "default": "default_database",
        "x-depends-on": {
          "providers.vector_db": "chroma"
        },
        "x-category": "Providers",
        "x-display-order": 106
      },
      "jupyter_auth_type": {
        "type": "string",
        "title": "Jupyter Auth Type",
        "enum": ["token", "password", "none"],
        "default": "token",
        "x-depends-on": {
          "providers.code_execution_engine": "jupyter"
        },
        "x-category": "Providers",
        "x-display-order": 141
      },
      "jupyter_timeout": {
        "type": "integer",
        "title": "Jupyter Timeout (seconds)",
        "default": 300,
        "minimum": 60,
        "maximum": 1800,
        "x-depends-on": {
          "providers.code_execution_engine": "jupyter"
        },
        "x-category": "Advanced",
        "x-display-order": 142
      },
      "redis_key_prefix": {
        "type": "string",
        "title": "Redis Key Prefix",
        "default": "open-webui",
        "x-category": "Advanced",
        "x-display-order": 610
      },
      "ollama_embedding_model": {
        "type": "string",
        "title": "Ollama Embedding Model",
        "default": "nomic-embed-text",
        "x-depends-on": {
          "providers.rag_embedding": "ollama"
        },
        "x-category": "Providers",
        "x-display-order": 112
      }
    }
  }
}
```

### Phase 3: Update Template Variable References

In `openwebui.env.njk`, update all references:

```nunjucks
# BEFORE (incorrect namespace)
Environment=WEBUI_NAME={{ openwebui.general.webui_name }}
Environment=RAG_EMBEDDING_MODEL={{ openwebui.rag_embedding_config.openai.model }}

# AFTER (correct schema paths)
Environment=WEBUI_NAME={{ provider_config.webui_name }}
Environment=CUSTOM_NAME={{ provider_config.custom_name }}
Environment=DEFAULT_USER_ROLE={{ provider_config.default_user_role }}
Environment=GLOBAL_LOG_LEVEL={{ provider_config.log_level }}

{% if providers.vector_db == "chroma" %}
Environment=CHROMA_TENANT={{ provider_config.chroma_tenant }}
Environment=CHROMA_DATABASE={{ provider_config.chroma_database }}
{% endif %}

{% if features.rag and providers.rag_embedding == "openai" %}
Environment=RAG_EMBEDDING_MODEL={{ provider_config.rag_embedding_model }}
{% endif %}

{% if features.title_generation %}
Environment=TASK_MODEL={{ provider_config.task_model_title }}
{% endif %}

{% if features.tags_generation %}
Environment=TASK_MODEL_TAGS={{ provider_config.task_model_tags }}
{% endif %}

{% if features.rag %}
Environment=TASK_MODEL_QUERY={{ provider_config.task_model_query }}
{% endif %}
```

### Phase 4: Validate Constructed URLs

Ensure these are built correctly from infrastructure:

```nunjucks
# LiteLLM endpoints (ALL point to litellm, NOT llama-swap)
Environment=OPENAI_API_BASE_URL=http://{{ infrastructure.services.litellm.hostname }}:{{ infrastructure.services.litellm.port }}/v1

{% if features.rag and providers.rag_embedding == "openai" %}
Environment=RAG_OPENAI_API_BASE_URL=http://{{ infrastructure.services.litellm.hostname }}:{{ infrastructure.services.litellm.port }}/v1
{% endif %}

{% if features.speech_to_text and providers.stt_engine == "openai" %}
Environment=AUDIO_STT_OPENAI_API_BASE_URL=http://{{ infrastructure.services.litellm.hostname }}:{{ infrastructure.services.litellm.port }}/v1
Environment=AUDIO_STT_MODEL={{ provider_config.audio_stt_model }}
{% endif %}

{% if features.text_to_speech and providers.tts_engine == "openai" %}
Environment=AUDIO_TTS_OPENAI_API_BASE_URL=http://{{ infrastructure.services.litellm.hostname }}:{{ infrastructure.services.litellm.port }}/v1
Environment=AUDIO_TTS_MODEL={{ provider_config.audio_tts_model }}
Environment=AUDIO_TTS_VOICE={{ provider_config.audio_tts_voice }}
{% endif %}

# Jupyter
{% if features.code_execution and providers.code_execution_engine == "jupyter" %}
Environment=JUPYTER_URL=http://{{ infrastructure.services.jupyter.hostname }}:{{ infrastructure.services.jupyter.port }}
Environment=JUPYTER_AUTH_TYPE={{ provider_config.jupyter_auth_type }}
Environment=JUPYTER_TIMEOUT={{ provider_config.jupyter_timeout }}
{% endif %}

# Redis
Environment=REDIS_URL=redis://{{ infrastructure.services.openwebui_redis.hostname }}:{{ infrastructure.services.openwebui_redis.port }}/2
Environment=REDIS_KEY_PREFIX={{ provider_config.redis_key_prefix }}

{% if features.websocket_support %}
Environment=ENABLE_WEBSOCKET_SUPPORT=true
Environment=WEBSOCKET_MANAGER=redis
Environment=WEBSOCKET_REDIS_URL=redis://{{ infrastructure.services.openwebui_redis.hostname }}:{{ infrastructure.services.openwebui_redis.port }}/3
{% endif %}

# Ollama (for RAG embeddings only)
{% if features.rag and providers.rag_embedding == "ollama" %}
Environment=OLLAMA_BASE_URL=http://{{ infrastructure.services.llama_swap.hostname }}:{{ infrastructure.services.llama_swap.port }}
Environment=RAG_EMBEDDING_MODEL={{ provider_config.ollama_embedding_model }}
{% endif %}
```

---

## Summary: What Was Actually Missing

**Not 160+ variables** - most are:
- Enterprise features you don't use
- Features not enabled
- Performance tuning for scale

**Actually missing: 17 variables** split into:
- 9 critical (branding, security, model selection)
- 8 optional (advanced tuning)

**Plus: 1 structural issue** - template namespace mismatch

---

## Validation Checklist

After implementation:

- [ ] All template `{{ openwebui.* }}` references updated to correct schema paths
- [ ] All 17 new fields added to `provider_config` section
- [ ] All constructed URLs use correct infrastructure components
- [ ] All LiteLLM endpoints point to `litellm:4000/v1` (NOT llama-swap)
- [ ] Conditional logic (`{% if %}`) matches schema `x-depends-on`
- [ ] Test render with sample config to verify no undefined variables
- [ ] Verify generated .env has all expected variables
- [ ] No hardcoded secrets in schema (those stay in template)
