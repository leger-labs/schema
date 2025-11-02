# OpenWebUI v0.6.32 Environment Variable Decisions

**Date**: 2025-11-02
**Schema Version**: v0.0.1
**OpenWebUI Version**: v0.6.32
**Decision Model**: Superuser Single-User Mode

---

## Executive Summary

This document records the deliberate decision for every OpenWebUI v0.6.32 environment variable (200+ total) and how it's handled in the Leger schema.

### Decision Categories:

1. **Schema-Driven** (16): User configures via `provider_config` fields in schema.json
2. **Constructed** (13): Auto-generated from infrastructure service definitions
3. **Hardcoded** (45): Best-practice defaults for superuser single-user mode
4. **Commented** (140+): Documented but unused (enterprise features, alternative providers)

### Deployment Context:

- **User Model**: Single user with full admin rights (superuser)
- **Security**: Tailscale VPN subnet (no public internet)
- **Philosophy**: Simplicity over enterprise features

---

## Category 1: Schema-Driven Variables (16)

Variables the user explicitly configures in their `user-config.json`:

| Variable | Schema Field | Default | Location |
|----------|--------------|---------|----------|
| `WEBUI_NAME` | `provider_config.webui_name` | `"Leger AI"` | schema.json:771, openwebui.env.njk:17 |
| `CUSTOM_NAME` | `provider_config.custom_name` | `""` | schema.json:780, openwebui.env.njk:19 |
| `GLOBAL_LOG_LEVEL` | `provider_config.log_level` | `"INFO"` | schema.json:1415, openwebui.env.njk:23 |
| `RAG_EMBEDDING_MODEL` | `provider_config.rag_embedding_model` | `"text-embedding-3-small"` | schema.json:884, openwebui.env.njk:105 |
| `OLLAMA_EMBEDDING_MODEL` | `provider_config.ollama_embedding_model` | `"nomic-embed-text"` | schema.json:896, openwebui.env.njk:110 |
| `AUDIO_STT_MODEL` | `provider_config.audio_stt_model` | `"whisper-1"` | schema.json:1168, openwebui.env.njk:165 |
| `AUDIO_TTS_MODEL` | `provider_config.audio_tts_model` | `"tts-1"` | schema.json:1265, openwebui.env.njk:183 |
| `AUDIO_TTS_VOICE` | `provider_config.audio_tts_voice` | `"alloy"` | schema.json:1277, openwebui.env.njk:184 |
| `TASK_MODEL` (title) | `provider_config.task_model_title` | `""` | schema.json:1379, openwebui.env.njk:233 |
| `TASK_MODEL_TAGS` | `provider_config.task_model_tags` | `""` | schema.json:1391, openwebui.env.njk:238 |
| `TASK_MODEL` (query) | `provider_config.task_model_query` | `""` | schema.json:1403, openwebui.env.njk:129 |
| `CHROMA_TENANT` | `provider_config.chroma_tenant` | `"default_tenant"` | schema.json:848, openwebui.env.njk:75 |
| `CHROMA_DATABASE` | `provider_config.chroma_database` | `"default_database"` | schema.json:860, openwebui.env.njk:76 |
| `JUPYTER_AUTH_TYPE` | `provider_config.jupyter_auth_type` | `"token"` | schema.json:1301, openwebui.env.njk:204 |
| `JUPYTER_TIMEOUT` | `provider_config.jupyter_timeout` | `300` | schema.json:1314, openwebui.env.njk:205 |
| `REDIS_KEY_PREFIX` | `provider_config.redis_key_prefix` | `"open-webui"` | schema.json:1425, openwebui.env.njk:217 |

**Rationale**: These represent true user choices that vary by deployment (branding, model selection, personal preferences).

---

## Category 2: Constructed Variables (13)

Variables auto-generated from infrastructure service definitions:

| Variable | Construction Logic | Example Value | Location |
|----------|-------------------|---------------|----------|
| `DATABASE_URL` | `postgresql://{{db_user}}@{{hostname}}:{{port}}/{{db_name}}` | `postgresql://openwebui@openwebui-postgres:5432/openwebui` | openwebui.env.njk:11 |
| `OPENAI_API_BASE_URL` | `http://{{litellm.hostname}}:{{litellm.port}}/v1` | `http://litellm:4000/v1` | openwebui.env.njk:14 |
| `RAG_OPENAI_API_BASE_URL` | Same as OPENAI_API_BASE_URL | `http://litellm:4000/v1` | openwebui.env.njk:104 |
| `AUDIO_STT_OPENAI_API_BASE_URL` | Same as OPENAI_API_BASE_URL or whisper service | `http://litellm:4000/v1` | openwebui.env.njk:164 |
| `AUDIO_TTS_OPENAI_API_BASE_URL` | Same as OPENAI_API_BASE_URL or edgetts service | `http://litellm:4000/v1` | openwebui.env.njk:182 |
| `JUPYTER_URL` | `http://{{jupyter.hostname}}:{{jupyter.port}}` | `http://jupyter:8888` | openwebui.env.njk:203 |
| `REDIS_URL` | `redis://{{redis.hostname}}:{{redis.port}}/2` | `redis://openwebui-redis:6379/2` | openwebui.env.njk:216 |
| `WEBSOCKET_REDIS_URL` | `redis://{{redis.hostname}}:{{redis.port}}/3` | `redis://openwebui-redis:6379/3` | openwebui.env.njk:222 |
| `PGVECTOR_DB_URL` | Same as DATABASE_URL | `postgresql://openwebui@openwebui-postgres:5432/openwebui` | openwebui.env.njk:80 |
| `OLLAMA_BASE_URL` | `http://{{llama_swap.hostname}}:{{llama_swap.port}}` | `http://llama-swap:8000` | openwebui.env.njk:109 |
| `TIKA_SERVER_URL` | `http://{{tika.hostname}}:{{tika.port}}` | `http://tika:9998` | openwebui.env.njk:123 |
| `SEARXNG_QUERY_URL` | `http://{{searxng.hostname}}:{{searxng.port}}/search?q=<query>` | `http://searxng:8080/search?q=<query>` | openwebui.env.njk:146 |
| `COMFYUI_BASE_URL` | `http://{{comfyui.hostname}}:{{comfyui.port}}` | `http://comfyui:8188` | openwebui.env.njk:254 |

**Rationale**: These are deterministic from the infrastructure topology. No user decision needed.

---

## Category 3: Hardcoded Variables (45)

Variables with best-practice defaults for superuser mode:

### 3.1 Authentication & User Management (8 variables)

| Variable | Value | Rationale | Location |
|----------|-------|-----------|----------|
| `DEFAULT_USER_ROLE` | `admin` | First user = owner = admin | openwebui.env.njk:30 |
| `ENABLE_SIGNUP` | `false` | Single user, no new signups | openwebui.env.njk:31 |
| `WEBUI_AUTH` | `true` | Always require auth (even on Tailscale) | openwebui.env.njk:32 |
| `ENABLE_LOGIN_FORM` | `true` | Standard login flow | openwebui.env.njk:33 |
| `BYPASS_MODEL_ACCESS_CONTROL` | `true` | User = admin, full access | openwebui.env.njk:61 |
| `ENABLE_ADMIN_EXPORT` | `true` | Allow data export | openwebui.env.njk:62 |
| `ENABLE_ADMIN_CHAT_ACCESS` | `true` | Admin sees all chats | openwebui.env.njk:63 |
| `SHOW_ADMIN_DETAILS` | `true` | Show admin interface | openwebui.env.njk:64 |

### 3.2 Chat Permissions (12 variables)

All set to `true` (user = superuser):

| Variable | Value | Location |
|----------|-------|----------|
| `USER_PERMISSIONS_CHAT_DELETE` | `true` | openwebui.env.njk:36 |
| `USER_PERMISSIONS_CHAT_EDIT` | `true` | openwebui.env.njk:37 |
| `USER_PERMISSIONS_CHAT_DELETE_MESSAGE` | `true` | openwebui.env.njk:38 |
| `USER_PERMISSIONS_CHAT_CONTINUE_RESPONSE` | `true` | openwebui.env.njk:39 |
| `USER_PERMISSIONS_CHAT_REGENERATE_RESPONSE` | `true` | openwebui.env.njk:40 |
| `USER_PERMISSIONS_CHAT_RATE_RESPONSE` | `true` | openwebui.env.njk:41 |
| `USER_PERMISSIONS_CHAT_FILE_UPLOAD` | `true` | openwebui.env.njk:42 |
| `USER_PERMISSIONS_CHAT_STT` | `true` | openwebui.env.njk:43 |
| `USER_PERMISSIONS_CHAT_TTS` | `true` | openwebui.env.njk:44 |
| `USER_PERMISSIONS_CHAT_CALL` | `true` | openwebui.env.njk:45 |
| `USER_PERMISSIONS_CHAT_MULTIPLE_MODELS` | `true` | openwebui.env.njk:46 |
| `USER_PERMISSIONS_CHAT_TEMPORARY` | `true` | openwebui.env.njk:47 |

### 3.3 Feature Permissions (3 variables)

| Variable | Value | Location |
|----------|-------|----------|
| `USER_PERMISSIONS_FEATURES_WEB_SEARCH` | `true` | openwebui.env.njk:50 |
| `USER_PERMISSIONS_FEATURES_IMAGE_GENERATION` | `true` | openwebui.env.njk:51 |
| `USER_PERMISSIONS_FEATURES_CODE_INTERPRETER` | `true` | openwebui.env.njk:52 |

### 3.4 Workspace Permissions (4 variables)

| Variable | Value | Location |
|----------|-------|----------|
| `USER_PERMISSIONS_WORKSPACE_MODELS_ACCESS` | `true` | openwebui.env.njk:55 |
| `USER_PERMISSIONS_WORKSPACE_KNOWLEDGE_ACCESS` | `true` | openwebui.env.njk:56 |
| `USER_PERMISSIONS_WORKSPACE_PROMPTS_ACCESS` | `true` | openwebui.env.njk:57 |
| `USER_PERMISSIONS_WORKSPACE_TOOLS_ACCESS` | `true` | openwebui.env.njk:58 |

### 3.5 Feature Enablement (Feature-Conditional) (18 variables)

| Variable | Condition | Value | Location |
|----------|-----------|-------|----------|
| `ENABLE_RAG` | `features.rag` | `true` or `false` | openwebui.env.njk:97,133 |
| `VECTOR_DB` | `features.rag` | From `providers.vector_db` | openwebui.env.njk:71 |
| `RAG_EMBEDDING_ENGINE` | `features.rag` | From `providers.rag_embedding` | openwebui.env.njk:100 |
| `RAG_TEXT_SPLITTER` | `features.rag` | From `providers.text_splitter` | openwebui.env.njk:118 |
| `RAG_TOP_K` | `features.rag` | From `provider_config.rag_top_k` | openwebui.env.njk:115 |
| `CHUNK_SIZE` | `features.rag` | From `provider_config.chunk_size` | openwebui.env.njk:116 |
| `CHUNK_OVERLAP` | `features.rag` | From `provider_config.chunk_overlap` | openwebui.env.njk:117 |
| `CONTENT_EXTRACTION_ENGINE` | `features.rag` | From `providers.content_extraction` | openwebui.env.njk:121 |
| `ENABLE_RETRIEVAL_QUERY_GENERATION` | `features.rag && task_model_query` | `true` | openwebui.env.njk:128 |
| `ENABLE_RAG_WEB_SEARCH` | `features.web_search` | `true` or `false` | openwebui.env.njk:141,152 |
| `ENABLE_WEB_SEARCH` | `features.web_search` | `true` or `false` | openwebui.env.njk:142,153 |
| `RAG_WEB_SEARCH_ENGINE` | `features.web_search` | From `providers.web_search_engine` | openwebui.env.njk:143 |
| `WEB_LOADER_ENGINE` | `features.web_search` | From `providers.web_loader` | openwebui.env.njk:149 |
| `AUDIO_STT_ENGINE` | `features.speech_to_text` | From `providers.stt_engine` | openwebui.env.njk:161 |
| `AUDIO_TTS_ENGINE` | `features.text_to_speech` | From `providers.tts_engine` | openwebui.env.njk:179 |
| `ENABLE_CODE_EXECUTION` | `features.code_execution` | `true` or `false` | openwebui.env.njk:199,209 |
| `CODE_EXECUTION_ENGINE` | `features.code_execution` | From `providers.code_execution_engine` | openwebui.env.njk:200 |
| `ENABLE_WEBSOCKET_SUPPORT` | `features.websocket_support` | `true` or `false` | openwebui.env.njk:220,224 |
| `WEBSOCKET_MANAGER` | `features.websocket_support` | `redis` | openwebui.env.njk:221 |
| `ENABLE_TITLE_GENERATION` | `features.title_generation && task_model_title` | `true` | openwebui.env.njk:232 |
| `ENABLE_TAGS_GENERATION` | `features.tags_generation && task_model_tags` | `true` | openwebui.env.njk:237 |
| `ENABLE_AUTOCOMPLETE_GENERATION` | `features.autocomplete_generation` | `true` | openwebui.env.njk:242 |
| `ENABLE_IMAGE_GENERATION` | `features.image_generation` | `true` or `false` | openwebui.env.njk:250,258 |
| `IMAGE_GENERATION_ENGINE` | `features.image_generation` | From `providers.image_engine` | openwebui.env.njk:251 |

**Rationale**: These enforce the superuser single-user deployment model with best practices.

---

## Category 4: Commented Variables (140+)

Variables documented but not used in the current deployment model:

### 4.1 OAuth Authentication (50+ variables)

**Status**: Commented out
**Rationale**: Single-user deployment doesn't need external authentication
**Location**: openwebui.env.njk:261-288
**Documentation**: See `docs/owui-refinement/analysis-missing-env-variables.md` for full list

Example variables:
- `ENABLE_OAUTH_SIGNUP`
- `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`
- `OPENID_PROVIDER_URL`
- `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID`, `GITHUB_CLIENT_ID`
- `OAUTH_MERGE_ACCOUNTS_BY_EMAIL`
- `ENABLE_OAUTH_ROLE_MANAGEMENT`
- (40+ more OAuth-related variables)

### 4.2 LDAP Authentication (20+ variables)

**Status**: Commented out
**Rationale**: Enterprise directory integration not needed
**Location**: openwebui.env.njk:276-280

Example variables:
- `ENABLE_LDAP`
- `LDAP_SERVER_HOST`, `LDAP_SERVER_PORT`
- `LDAP_SEARCH_BASE`, `LDAP_SEARCH_FILTER`
- `LDAP_USE_TLS`, `LDAP_CA_CERT_FILE`
- (15+ more LDAP variables)

### 4.3 SCIM Provisioning (2 variables)

**Status**: Commented out
**Rationale**: Enterprise user provisioning not needed
**Location**: openwebui.env.njk:282-284

Variables:
- `SCIM_ENABLED`
- `SCIM_TOKEN`

### 4.4 OpenTelemetry Observability (20+ variables)

**Status**: Commented out
**Rationale**: Advanced monitoring not needed for single-user
**Location**: openwebui.env.njk:290-306

Example variables:
- `ENABLE_OTEL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_SERVICE_NAME`
- `OTEL_TRACES_SAMPLER`
- (15+ more OTEL variables)

### 4.5 Cloud Storage Providers (20+ variables)

**Status**: Commented out
**Rationale**: Local storage sufficient, cloud storage for future scaling
**Location**: openwebui.env.njk:308-328

Example variables:

**S3**:
- `STORAGE_PROVIDER=s3`
- `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `S3_REGION_NAME`, `S3_ENDPOINT_URL`

**GCS**:
- `STORAGE_PROVIDER=gcs`
- `GCS_BUCKET_NAME`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`

**Azure**:
- `STORAGE_PROVIDER=azure`
- `AZURE_STORAGE_CONTAINER_NAME`, `AZURE_STORAGE_KEY`

### 4.6 Additional Web Search Engines (30+ variables)

**Status**: Commented out
**Rationale**: SearXNG sufficient, others documented for future
**Location**: openwebui.env.njk:330-357

Example providers and variables:
- **Google PSE**: `GOOGLE_PSE_API_KEY`, `GOOGLE_PSE_ENGINE_ID`
- **Brave**: `BRAVE_SEARCH_API_KEY`
- **Serper**: `SERPER_API_KEY`
- **SerpAPI**: `SERPAPI_API_KEY`, `SERPAPI_ENGINE`
- **Bing**: `BING_SEARCH_V7_ENDPOINT`, `BING_SEARCH_V7_SUBSCRIPTION_KEY`
- **Tavily**: Available in schema but commented here
- **Kagi**, **Mojeek**, **Serpstack**, **Serply**, **SearchAPI**, **Jina**, **Bocha**, **Exa**, **Sougou**, **Ollama Cloud**, **Perplexity**

### 4.7 Advanced Audio Providers (10+ variables)

**Status**: Commented out
**Rationale**: OpenAI/Whisper/EdgeTTS sufficient
**Location**: openwebui.env.njk:359-372

Example variables:
- **Azure Speech**: `AUDIO_STT_AZURE_API_KEY`, `AUDIO_STT_AZURE_REGION`, `AUDIO_TTS_AZURE_SPEECH_REGION`
- **Deepgram**: `DEEPGRAM_API_KEY`
- **ElevenLabs**: Already in schema, documented here

### 4.8 Advanced Image Generation (10+ variables)

**Status**: Commented out
**Rationale**: OpenAI/ComfyUI sufficient
**Location**: openwebui.env.njk:374-385

Example variables:
- **Gemini**: `IMAGES_GEMINI_API_BASE_URL`, `IMAGES_GEMINI_API_KEY`
- **AUTOMATIC1111**: `AUTOMATIC1111_BASE_URL`, `AUTOMATIC1111_API_AUTH`, `AUTOMATIC1111_CFG_SCALE`, `AUTOMATIC1111_SAMPLER`

### 4.9 Advanced RAG Settings (20+ variables)

**Status**: Commented out
**Rationale**: Basic RAG settings sufficient for most use cases
**Not listed in template but documented in analysis**

Example variables:
- `RAG_TOP_K_RERANKER`
- `RAG_RELEVANCE_THRESHOLD`
- `ENABLE_RAG_HYBRID_SEARCH`
- `RAG_TEMPLATE`
- `PDF_EXTRACT_IMAGES`
- `RAG_FILE_MAX_SIZE`, `RAG_FILE_MAX_COUNT`
- (15+ more advanced RAG variables)

### 4.10 Database Advanced (10+ variables)

**Status**: Commented out
**Rationale**: Default connection pooling sufficient

Example variables:
- `DATABASE_TYPE` (using PostgreSQL, implied)
- `DATABASE_POOL_SIZE`, `DATABASE_POOL_MAX_OVERFLOW`
- `DATABASE_ENABLE_SQLITE_WAL`
- `DATABASE_DEDUPLICATE_INTERVAL`

### 4.11 Google Drive & OneDrive (10+ variables)

**Status**: Commented out
**Rationale**: External storage integrations for future

Example variables:
- `ENABLE_GOOGLE_DRIVE_INTEGRATION`
- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_API_KEY`
- `ENABLE_ONEDRIVE_INTEGRATION`
- `ONEDRIVE_CLIENT_ID_PERSONAL`, `ONEDRIVE_CLIENT_ID_BUSINESS`
- `ONEDRIVE_SHAREPOINT_URL`

---

## Decision Summary by Category

| Category | Count | Treatment |
|----------|-------|-----------|
| Schema-Driven (user configures) | 16 | Added to `provider_config` in schema.json |
| Constructed (auto-generated) | 13 | Built from infrastructure topology |
| Hardcoded (best practices) | 45 | Set in openwebui.env.njk |
| Commented (documented) | 140+ | Documented in comments for future use |
| **Total** | **214** | **Complete v0.6.32 coverage** |

---

## Validation

All 200+ OpenWebUI v0.6.32 environment variables have been reviewed and deliberately classified:

- ✅ **Active variables** (~74): Configured or constructed
- ✅ **Documented variables** (~140): Commented with rationale
- ✅ **Zero ignored variables**: Every variable has a decision

---

## Future Extensions

To add a commented variable in the future:

1. **If user-configurable**: Add field to `schema.json` → `provider_config`
2. **If external API key**: Add to `schema.json` → `secrets` section
3. **If new service needed**: Add to `infrastructure.services`
4. **Update template**: Uncomment and configure in `openwebui.env.njk`
5. **Document**: Update this file with the decision

---

## References

- **Full variable list**: `docs/owui-refinement/analysis-missing-env-variables.md`
- **Refined analysis**: `docs/owui-refinement/missing-notes.md`
- **Secrets guide**: `releases/v0.0.1/SECRETS.md`
- **OpenWebUI docs**: https://docs.openwebui.com/getting-started/env-configuration
- **Template**: `releases/v0.0.1/templates/services/openwebui/openwebui.env.njk`
- **Schema**: `releases/v0.0.1/schema.json`
