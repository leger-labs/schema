# Handoff Prompt: Complete Open WebUI Environment Variable Implementation

## Context
I have a Podman Quadlet configuration for Open WebUI that uses a schema-driven approach (schema.json) to generate Nunjucks templates. Currently implements **~40 environment variables** but Open WebUI v0.6.32 supports **200+ variables**. Need to achieve full compliance.

## Current Implementation Status

### ✅ Currently Configured (40 variables)
**Core:**
- DATABASE_URL, OPENAI_API_BASE_URL, WEBUI_NAME, CUSTOM_NAME
- WEBUI_AUTH, ENABLE_SIGNUP, DEFAULT_USER_ROLE, GLOBAL_LOG_LEVEL

**Vector DB:**
- VECTOR_DB, CHROMA_*, PGVECTOR_*, QDRANT_* (basic)

**RAG:**
- ENABLE_RAG, RAG_EMBEDDING_ENGINE, RAG_TOP_K, CHUNK_SIZE, CHUNK_OVERLAP

**Content Extraction:**
- CONTENT_EXTRACTION_ENGINE, TIKA_SERVER_URL, DOCLING_SERVER_URL

**Web Search:**
- ENABLE_RAG_WEB_SEARCH, ENABLE_WEB_SEARCH, RAG_WEB_SEARCH_ENGINE, SEARXNG_QUERY_URL

**Audio:**
- AUDIO_STT_ENGINE, AUDIO_STT_OPENAI_API_BASE_URL, AUDIO_STT_MODEL
- AUDIO_TTS_ENGINE, AUDIO_TTS_OPENAI_API_BASE_URL, AUDIO_TTS_MODEL, AUDIO_TTS_VOICE

**Code Execution:**
- ENABLE_CODE_EXECUTION, CODE_EXECUTION_ENGINE, JUPYTER_URL, JUPYTER_AUTH_TYPE, JUPYTER_TIMEOUT

**Redis/WebSocket:**
- REDIS_URL, REDIS_KEY_PREFIX, ENABLE_WEBSOCKET_SUPPORT, WEBSOCKET_MANAGER, WEBSOCKET_REDIS_URL

**AI Tasks:**
- ENABLE_TITLE_GENERATION, ENABLE_TAGS_GENERATION, ENABLE_RETRIEVAL_QUERY_GENERATION

---

## ❌ Missing Critical Variables (160+ variables)

### **PRIORITY 1 - Critical for Production** (35 variables)

#### General/App Configuration
```bash
WEBUI_URL                              # PersistentConfig - REQUIRED for OAuth/SSO
ENABLE_LOGIN_FORM                      # PersistentConfig - Dangerous if misconfigured
DEFAULT_LOCALE                         # PersistentConfig
DEFAULT_MODELS                         # PersistentConfig
ENABLE_PERSISTENT_CONFIG               # Controls PersistentConfig behavior
ENV                                    # dev/prod - Affects API docs visibility
PORT                                   # Server port (8080)
BYPASS_MODEL_ACCESS_CONTROL            # Security control
ENABLE_ADMIN_EXPORT                    # Security control
ENABLE_ADMIN_CHAT_ACCESS               # Security control
BYPASS_ADMIN_ACCESS_CONTROL            # Security control
ENABLE_SIGNUP_PASSWORD_CONFIRMATION
SHOW_ADMIN_DETAILS
ADMIN_EMAIL
```

#### Security & Authentication
```bash
WEBUI_SECRET_KEY                       # JWT signing - CRITICAL
WEBUI_SESSION_COOKIE_SAME_SITE         # lax/strict/none
WEBUI_SESSION_COOKIE_SECURE            # true/false
WEBUI_AUTH_COOKIE_SAME_SITE
WEBUI_AUTH_COOKIE_SECURE
JWT_EXPIRES_IN                         # Token expiration (4w default)
ENABLE_API_KEY                         # PersistentConfig
ENABLE_API_KEY_ENDPOINT_RESTRICTIONS   # PersistentConfig
API_KEY_ALLOWED_ENDPOINTS              # PersistentConfig
CORS_ALLOW_ORIGIN                      # * default
CORS_ALLOW_CUSTOM_SCHEME
SAFE_MODE                              # Disables unsafe features
OFFLINE_MODE                           # Disables internet connections
ENABLE_VERSION_UPDATE_CHECK
```

#### Database & Performance
```bash
DATABASE_TYPE                          # sqlite/postgresql/sqlite+sqlcipher
DATABASE_POOL_SIZE                     # Connection pooling
DATABASE_POOL_MAX_OVERFLOW
DATABASE_POOL_TIMEOUT
DATABASE_POOL_RECYCLE
DATABASE_ENABLE_SQLITE_WAL             # Performance for SQLite
DATABASE_DEDUPLICATE_INTERVAL          # Write deduplication
THREAD_POOL_SIZE                       # FastAPI/AnyIO threads (0=40)
MODELS_CACHE_TTL                       # Model list caching (1s default)
```

#### Redis
```bash
REDIS_SENTINEL_HOSTS                   # Comma-separated sentinels
REDIS_SENTINEL_PORT                    # 26379
REDIS_CLUSTER                          # true/false
WEBSOCKET_SENTINEL_HOSTS
WEBSOCKET_SENTINEL_PORT
WEBSOCKET_REDIS_CLUSTER
ENABLE_STAR_SESSIONS_MIDDLEWARE        # Experimental OAuth session storage
```

---

### **PRIORITY 2 - Feature Completeness** (60 variables)

#### RAG Advanced Settings
```bash
RAG_TOP_K_RERANKER                     # Default: 3
RAG_RELEVANCE_THRESHOLD                # Default: 0.0
ENABLE_RAG_HYBRID_SEARCH               # PersistentConfig - BM25 + vector
RAG_HYBRID_BM25_WEIGHT                 # 0-1, default 0.5
RAG_TEMPLATE                           # PersistentConfig - Prompt template
RAG_TEXT_SPLITTER                      # character/token/markdown_header
TIKTOKEN_CACHE_DIR
TIKTOKEN_ENCODING_NAME                 # cl100k_base
PDF_EXTRACT_IMAGES                     # PersistentConfig - OCR
RAG_FILE_MAX_SIZE                      # PersistentConfig - MB limit
RAG_FILE_MAX_COUNT                     # PersistentConfig - Upload limit
RAG_ALLOWED_FILE_EXTENSIONS            # PersistentConfig - ["pdf,docx,txt"]
RAG_EMBEDDING_BATCH_SIZE               # PersistentConfig
RAG_EMBEDDING_CONTENT_PREFIX           # PersistentConfig
RAG_EMBEDDING_PREFIX_FIELD_NAME        # PersistentConfig
RAG_EMBEDDING_QUERY_PREFIX             # PersistentConfig
RAG_RERANKING_MODEL                    # PersistentConfig
ENABLE_RETRIEVAL_QUERY_GENERATION      # PersistentConfig
QUERY_GENERATION_PROMPT_TEMPLATE       # PersistentConfig
BYPASS_EMBEDDING_AND_RETRIEVAL         # PersistentConfig
RAG_FULL_CONTEXT                       # PersistentConfig
ENABLE_RAG_LOCAL_WEB_FETCH             # PersistentConfig
ENABLE_WEB_LOADER_SSL_VERIFICATION     # PersistentConfig
```

#### Vector Database - Advanced
```bash
# Qdrant Multitenancy
ENABLE_QDRANT_MULTITENANCY_MODE        # Reduces RAM usage
QDRANT_COLLECTION_PREFIX               # open-webui

# Milvus Support
MILVUS_URI
MILVUS_DB
MILVUS_TOKEN
MILVUS_INDEX_TYPE                      # AUTOINDEX/FLAT/IVF_FLAT/HNSW/DISKANN
MILVUS_METRIC_TYPE                     # COSINE/IP/L2
MILVUS_HNSW_M
MILVUS_HNSW_EFCONSTRUCTION
MILVUS_IVF_FLAT_NLIST
MILVUS_DISKANN_MAX_DEGREE
MILVUS_DISKANN_SEARCH_LIST_SIZE
ENABLE_MILVUS_MULTITENANCY_MODE
MILVUS_COLLECTION_PREFIX

# Elasticsearch Support
ELASTICSEARCH_API_KEY
ELASTICSEARCH_CA_CERTS
ELASTICSEARCH_CLOUD_ID
ELASTICSEARCH_INDEX_PREFIX
ELASTICSEARCH_PASSWORD
ELASTICSEARCH_URL
ELASTICSEARCH_USERNAME

# OpenSearch Support
OPENSEARCH_CERT_VERIFY
OPENSEARCH_PASSWORD
OPENSEARCH_SSL
OPENSEARCH_URI
OPENSEARCH_USERNAME

# Pinecone Support
PINECONE_API_KEY
PINECONE_ENVIRONMENT
PINECONE_INDEX_NAME
PINECONE_DIMENSION
PINECONE_METRIC
PINECONE_CLOUD

# S3 Vector Support
S3_VECTOR_BUCKET_NAME
S3_VECTOR_REGION

# Oracle 23ai Support
ORACLE_DB_USE_WALLET
ORACLE_DB_USER
ORACLE_DB_PASSWORD
ORACLE_DB_DSN
ORACLE_WALLET_DIR
ORACLE_WALLET_PASSWORD
ORACLE_VECTOR_LENGTH
ORACLE_DB_POOL_MIN/MAX/INCREMENT
```

#### Web Search Engines - All Providers
```bash
WEB_SEARCH_TRUST_ENV                   # Enable http_proxy/https_proxy
WEB_SEARCH_RESULT_COUNT                # PersistentConfig - Default: 3
WEB_LOADER_CONCURRENT_REQUESTS         # PersistentConfig - Default: 10
BYPASS_WEB_SEARCH_EMBEDDING_AND_RETRIEVAL  # PersistentConfig

# SearXNG
SEARXNG_QUERY_URL                      # PersistentConfig

# Google PSE
GOOGLE_PSE_API_KEY                     # PersistentConfig
GOOGLE_PSE_ENGINE_ID                   # PersistentConfig

# Brave
BRAVE_SEARCH_API_KEY                   # PersistentConfig

# Kagi
KAGI_SEARCH_API_KEY                    # PersistentConfig

# Mojeek
MOJEEK_SEARCH_API_KEY                  # PersistentConfig

# Serpstack
SERPSTACK_API_KEY                      # PersistentConfig
SERPSTACK_HTTPS                        # PersistentConfig

# Serper
SERPER_API_KEY                         # PersistentConfig

# Serply
SERPLY_API_KEY                         # PersistentConfig

# SearchAPI
SEARCHAPI_API_KEY                      # PersistentConfig
SEARCHAPI_ENGINE                       # PersistentConfig

# SerpAPI
SERPAPI_API_KEY                        # PersistentConfig
SERPAPI_ENGINE                         # PersistentConfig

# Tavily
TAVILY_API_KEY                         # PersistentConfig
TAVILY_EXTRACT_DEPTH                   # PersistentConfig

# Jina
JINA_API_KEY                           # PersistentConfig

# Bing
BING_SEARCH_V7_ENDPOINT                # PersistentConfig
BING_SEARCH_V7_SUBSCRIPTION_KEY        # PersistentConfig

# Bocha
BOCHA_SEARCH_API_KEY                   # PersistentConfig

# Exa
EXA_API_KEY                            # PersistentConfig

# Sougou
SOUGOU_API_SID                         # PersistentConfig
SOUGOU_API_SK                          # PersistentConfig

# Ollama Cloud
OLLAMA_CLOUD_WEB_SEARCH_API_KEY        # PersistentConfig

# Perplexity (separate from LLM)
PERPLEXITY_API_KEY                     # PersistentConfig
```

#### Web Loader
```bash
WEB_LOADER_ENGINE                      # requests/playwright/safe_web
PLAYWRIGHT_WS_URL                      # PersistentConfig - Remote browser
PLAYWRIGHT_TIMEOUT                     # PersistentConfig
FIRECRAWL_API_BASE_URL                 # PersistentConfig
FIRECRAWL_API_KEY                      # PersistentConfig
YOUTUBE_LOADER_PROXY_URL               # PersistentConfig
YOUTUBE_LOADER_LANGUAGE                # PersistentConfig - Comma-separated
```

#### Whisper (Local STT)
```bash
WHISPER_MODEL                          # PersistentConfig - base
WHISPER_MODEL_DIR
WHISPER_VAD_FILTER                     # PersistentConfig
WHISPER_MODEL_AUTO_UPDATE
WHISPER_LANGUAGE                       # ISO 639-1
```

#### Azure Audio
```bash
AUDIO_STT_AZURE_API_KEY                # PersistentConfig
AUDIO_STT_AZURE_REGION                 # PersistentConfig
AUDIO_STT_AZURE_LOCALES                # PersistentConfig
AUDIO_TTS_AZURE_SPEECH_REGION          # PersistentConfig
AUDIO_TTS_AZURE_SPEECH_OUTPUT_FORMAT   # PersistentConfig
```

#### Deepgram Audio
```bash
DEEPGRAM_API_KEY                       # PersistentConfig
```

---

### **PRIORITY 3 - Advanced Features** (40 variables)

#### Task Models & Prompts
```bash
TASK_MODEL                             # PersistentConfig - Ollama task model
TASK_MODEL_EXTERNAL                    # PersistentConfig - OpenAI task model
TITLE_GENERATION_PROMPT_TEMPLATE       # PersistentConfig
ENABLE_FOLLOW_UP_GENERATION            # PersistentConfig
FOLLOW_UP_GENERATION_PROMPT_TEMPLATE   # PersistentConfig
TOOLS_FUNCTION_CALLING_PROMPT_TEMPLATE # PersistentConfig
```

#### Code Interpreter (separate from Code Execution)
```bash
ENABLE_CODE_INTERPRETER                # PersistentConfig
CODE_INTERPRETER_ENGINE                # PersistentConfig - pyodide/jupyter
CODE_INTERPRETER_BLACKLISTED_MODULES
CODE_INTERPRETER_PROMPT_TEMPLATE       # PersistentConfig
CODE_INTERPRETER_JUPYTER_URL           # PersistentConfig
CODE_INTERPRETER_JUPYTER_AUTH          # PersistentConfig
CODE_INTERPRETER_JUPYTER_AUTH_TOKEN    # PersistentConfig
CODE_INTERPRETER_JUPYTER_AUTH_PASSWORD # PersistentConfig
CODE_INTERPRETER_JUPYTER_TIMEOUT       # PersistentConfig
```

#### Direct Connections (OpenAPI/MCPO)
```bash
ENABLE_DIRECT_CONNECTIONS              # PersistentConfig
TOOL_SERVER_CONNECTIONS                # PersistentConfig - JSON array
```

#### Autocomplete
```bash
ENABLE_AUTOCOMPLETE_GENERATION         # PersistentConfig
AUTOCOMPLETE_GENERATION_INPUT_MAX_LENGTH  # PersistentConfig
AUTOCOMPLETE_GENERATION_PROMPT_TEMPLATE   # PersistentConfig
```

#### Evaluation Arena
```bash
ENABLE_EVALUATION_ARENA_MODELS         # PersistentConfig
ENABLE_MESSAGE_RATING                  # PersistentConfig
ENABLE_COMMUNITY_SHARING               # PersistentConfig
```

#### Image Generation - Advanced
```bash
ENABLE_IMAGE_PROMPT_GENERATION         # PersistentConfig
IMAGE_PROMPT_GENERATION_PROMPT_TEMPLATE # PersistentConfig
IMAGE_SIZE                             # PersistentConfig - 512x512
IMAGE_STEPS                            # PersistentConfig - 50
IMAGE_GENERATION_MODEL                 # PersistentConfig

# AUTOMATIC1111
AUTOMATIC1111_BASE_URL                 # PersistentConfig
AUTOMATIC1111_API_AUTH                 # PersistentConfig
AUTOMATIC1111_CFG_SCALE                # PersistentConfig
AUTOMATIC1111_SAMPLER                  # PersistentConfig
AUTOMATIC1111_SCHEDULER                # PersistentConfig

# ComfyUI
COMFYUI_BASE_URL                       # PersistentConfig
COMFYUI_API_KEY                        # PersistentConfig
COMFYUI_WORKFLOW                       # PersistentConfig - JSON

# Gemini
GEMINI_API_BASE_URL                    # PersistentConfig
GEMINI_API_KEY                         # PersistentConfig
IMAGES_GEMINI_API_BASE_URL             # PersistentConfig
IMAGES_GEMINI_API_KEY                  # PersistentConfig

# OpenAI DALL-E
IMAGES_OPENAI_API_BASE_URL             # PersistentConfig
IMAGES_OPENAI_API_VERSION              # PersistentConfig
IMAGES_OPENAI_API_KEY                  # PersistentConfig
```

#### Ollama Configuration
```bash
ENABLE_OLLAMA_API                      # PersistentConfig
OLLAMA_BASE_URL                        # Default: http://localhost:11434
OLLAMA_BASE_URLS                       # PersistentConfig - Semicolon-separated
USE_OLLAMA_DOCKER
K8S_FLAG
```

#### OpenAI Configuration
```bash
ENABLE_OPENAI_API                      # PersistentConfig
OPENAI_API_BASE_URL                    # PersistentConfig
OPENAI_API_BASE_URLS                   # PersistentConfig - Semicolon-separated
OPENAI_API_KEY                         # PersistentConfig
OPENAI_API_KEYS                        # PersistentConfig - Semicolon-separated
```

---

### **PRIORITY 4 - OAuth/LDAP/SCIM** (50 variables)

#### OAuth General
```bash
ENABLE_OAUTH_SIGNUP                    # PersistentConfig
ENABLE_OAUTH_PERSISTENT_CONFIG
OAUTH_SUB_CLAIM                        # PersistentConfig
OAUTH_MERGE_ACCOUNTS_BY_EMAIL          # PersistentConfig - UNSAFE
ENABLE_OAUTH_WITHOUT_EMAIL             # PersistentConfig
OAUTH_UPDATE_PICTURE_ON_LOGIN          # PersistentConfig
ENABLE_OAUTH_ID_TOKEN_COOKIE           # Legacy cookie support
OAUTH_CLIENT_INFO_ENCRYPTION_KEY       # Falls back to WEBUI_SECRET_KEY
OAUTH_SESSION_TOKEN_ENCRYPTION_KEY     # Falls back to WEBUI_SECRET_KEY
WEBUI_AUTH_TRUSTED_EMAIL_HEADER        # SSO header auth
WEBUI_AUTH_TRUSTED_NAME_HEADER
WEBUI_AUTH_TRUSTED_GROUPS_HEADER
```

#### OAuth - Google
```bash
GOOGLE_CLIENT_ID                       # PersistentConfig
GOOGLE_CLIENT_SECRET                   # PersistentConfig
GOOGLE_OAUTH_SCOPE                     # PersistentConfig
GOOGLE_REDIRECT_URI                    # PersistentConfig
```

#### OAuth - Microsoft
```bash
MICROSOFT_CLIENT_ID                    # PersistentConfig
MICROSOFT_CLIENT_SECRET                # PersistentConfig
MICROSOFT_CLIENT_TENANT_ID             # PersistentConfig
MICROSOFT_OAUTH_SCOPE                  # PersistentConfig
MICROSOFT_REDIRECT_URI                 # PersistentConfig
```

#### OAuth - GitHub
```bash
GITHUB_CLIENT_ID                       # PersistentConfig
GITHUB_CLIENT_SECRET                   # PersistentConfig
GITHUB_CLIENT_SCOPE                    # PersistentConfig
GITHUB_CLIENT_REDIRECT_URI             # PersistentConfig
```

#### OAuth - Feishu
```bash
FEISHU_CLIENT_ID                       # PersistentConfig
FEISHU_CLIENT_SECRET                   # PersistentConfig
FEISHU_CLIENT_SCOPE                    # PersistentConfig
FEISHU_CLIENT_REDIRECT_URI             # PersistentConfig
```

#### OAuth - Generic OIDC
```bash
OAUTH_CLIENT_ID                        # PersistentConfig
OAUTH_CLIENT_SECRET                    # PersistentConfig
OPENID_PROVIDER_URL                    # PersistentConfig - REQUIRED
OPENID_REDIRECT_URI                    # PersistentConfig
OAUTH_SCOPES                           # PersistentConfig
OAUTH_CODE_CHALLENGE_METHOD            # PersistentConfig - S256 for PKCE
OAUTH_PROVIDER_NAME                    # PersistentConfig
OAUTH_USERNAME_CLAIM                   # PersistentConfig
OAUTH_EMAIL_CLAIM                      # PersistentConfig
OAUTH_PICTURE_CLAIM                    # PersistentConfig
OAUTH_GROUP_CLAIM                      # PersistentConfig
ENABLE_OAUTH_ROLE_MANAGEMENT           # PersistentConfig
ENABLE_OAUTH_GROUP_MANAGEMENT          # PersistentConfig
OAUTH_ROLES_CLAIM                      # PersistentConfig
OAUTH_ALLOWED_ROLES                    # PersistentConfig
OAUTH_ADMIN_ROLES                      # PersistentConfig
OAUTH_ALLOWED_DOMAINS                  # PersistentConfig
```

#### LDAP
```bash
ENABLE_LDAP                            # PersistentConfig
LDAP_SERVER_LABEL                      # PersistentConfig
LDAP_SERVER_HOST                       # PersistentConfig
LDAP_SERVER_PORT                       # PersistentConfig
LDAP_ATTRIBUTE_FOR_MAIL                # PersistentConfig
LDAP_ATTRIBUTE_FOR_USERNAME            # PersistentConfig
LDAP_APP_DN                            # PersistentConfig
LDAP_APP_PASSWORD                      # PersistentConfig
LDAP_SEARCH_BASE                       # PersistentConfig
LDAP_SEARCH_FILTER                     # PersistentConfig
LDAP_SEARCH_FILTERS                    # PersistentConfig
LDAP_USE_TLS                           # PersistentConfig
LDAP_CA_CERT_FILE                      # PersistentConfig
LDAP_VALIDATE_CERT                     # PersistentConfig
LDAP_CIPHERS                           # PersistentConfig
ENABLE_LDAP_GROUP_MANAGEMENT           # PersistentConfig
ENABLE_LDAP_GROUP_CREATION             # PersistentConfig
LDAP_ATTRIBUTE_FOR_GROUPS              # PersistentConfig
```

#### SCIM
```bash
SCIM_ENABLED                           # PersistentConfig
SCIM_TOKEN                             # PersistentConfig
```

---

### **PRIORITY 5 - User Permissions** (20 variables)

```bash
# Chat Controls
USER_PERMISSIONS_CHAT_CONTROLS        # Master switch
USER_PERMISSIONS_CHAT_VALVES
USER_PERMISSIONS_CHAT_SYSTEM_PROMPT
USER_PERMISSIONS_CHAT_PARAMS
USER_PERMISSIONS_CHAT_FILE_UPLOAD     # PersistentConfig
USER_PERMISSIONS_CHAT_DELETE          # PersistentConfig
USER_PERMISSIONS_CHAT_EDIT            # PersistentConfig
USER_PERMISSIONS_CHAT_DELETE_MESSAGE  # PersistentConfig
USER_PERMISSIONS_CHAT_CONTINUE_RESPONSE  # PersistentConfig
USER_PERMISSIONS_CHAT_REGENERATE_RESPONSE  # PersistentConfig
USER_PERMISSIONS_CHAT_RATE_RESPONSE   # PersistentConfig
USER_PERMISSIONS_CHAT_STT             # PersistentConfig
USER_PERMISSIONS_CHAT_TTS             # PersistentConfig
USER_PERMISSIONS_CHAT_CALL            # PersistentConfig
USER_PERMISSIONS_CHAT_MULTIPLE_MODELS # PersistentConfig
USER_PERMISSIONS_CHAT_TEMPORARY       # PersistentConfig
USER_PERMISSIONS_CHAT_TEMPORARY_ENFORCED  # PersistentConfig

# Features
USER_PERMISSIONS_FEATURES_DIRECT_TOOL_SERVERS  # PersistentConfig
USER_PERMISSIONS_FEATURES_WEB_SEARCH  # PersistentConfig
USER_PERMISSIONS_FEATURES_IMAGE_GENERATION  # PersistentConfig
USER_PERMISSIONS_FEATURES_CODE_INTERPRETER  # PersistentConfig

# Workspace
USER_PERMISSIONS_WORKSPACE_MODELS_ACCESS  # PersistentConfig
USER_PERMISSIONS_WORKSPACE_KNOWLEDGE_ACCESS  # PersistentConfig
USER_PERMISSIONS_WORKSPACE_PROMPTS_ACCESS  # PersistentConfig
USER_PERMISSIONS_WORKSPACE_TOOLS_ACCESS  # PersistentConfig
USER_PERMISSIONS_WORKSPACE_MODELS_ALLOW_PUBLIC_SHARING  # PersistentConfig
USER_PERMISSIONS_WORKSPACE_KNOWLEDGE_ALLOW_PUBLIC_SHARING  # PersistentConfig
USER_PERMISSIONS_WORKSPACE_PROMPTS_ALLOW_PUBLIC_SHARING  # PersistentConfig
USER_PERMISSIONS_WORKSPACE_TOOLS_ALLOW_PUBLIC_SHARING  # PersistentConfig
USER_PERMISSIONS_NOTES_ALLOW_PUBLIC_SHARING
```

---

### **PRIORITY 6 - Infrastructure** (20 variables)

#### Storage Providers
```bash
STORAGE_PROVIDER                       # "" (local), s3, gcs, azure

# S3
S3_ACCESS_KEY_ID
S3_ADDRESSING_STYLE
S3_BUCKET_NAME
S3_ENDPOINT_URL
S3_KEY_PREFIX
S3_REGION_NAME
S3_SECRET_ACCESS_KEY
S3_USE_ACCELERATE_ENDPOINT
S3_ENABLE_TAGGING

# GCS
GOOGLE_APPLICATION_CREDENTIALS_JSON
GCS_BUCKET_NAME

# Azure
AZURE_STORAGE_ENDPOINT
AZURE_STORAGE_CONTAINER_NAME
AZURE_STORAGE_KEY
```

#### OpenTelemetry
```bash
ENABLE_OTEL
ENABLE_OTEL_TRACES
ENABLE_OTEL_METRICS
ENABLE_OTEL_LOGS
OTEL_EXPORTER_OTLP_ENDPOINT
OTEL_METRICS_EXPORTER_OTLP_ENDPOINT
OTEL_LOGS_EXPORTER_OTLP_ENDPOINT
OTEL_EXPORTER_OTLP_INSECURE
OTEL_METRICS_EXPORTER_OTLP_INSECURE
OTEL_LOGS_EXPORTER_OTLP_INSECURE
OTEL_SERVICE_NAME
OTEL_RESOURCE_ATTRIBUTES
OTEL_TRACES_SAMPLER
OTEL_BASIC_AUTH_USERNAME
OTEL_BASIC_AUTH_PASSWORD
OTEL_METRICS_BASIC_AUTH_USERNAME
OTEL_METRICS_BASIC_AUTH_PASSWORD
OTEL_LOGS_BASIC_AUTH_USERNAME
OTEL_LOGS_BASIC_AUTH_PASSWORD
OTEL_OTLP_SPAN_EXPORTER
OTEL_METRICS_OTLP_SPAN_EXPORTER
OTEL_LOGS_OTLP_SPAN_EXPORTER
```

#### Miscellaneous
```bash
UVICORN_WORKERS                        # Default: 1
CACHE_CONTROL                          # Cache-Control header
http_proxy                             # Proxy settings
https_proxy
no_proxy
PIP_OPTIONS
PIP_PACKAGE_INDEX_OPTIONS
DATA_DIR                               # ./data
FONTS_DIR
FRONTEND_BUILD_DIR                     # ../build
STATIC_DIR                             # ./static
AIOHTTP_CLIENT_TIMEOUT                 # 300
AIOHTTP_CLIENT_TIMEOUT_MODEL_LIST      # 10
AIOHTTP_CLIENT_TIMEOUT_OPENAI_MODEL_LIST
ENABLE_REALTIME_CHAT_SAVE              # false
CHAT_RESPONSE_STREAM_DELTA_CHUNK_SIZE  # 1
WEBUI_BUILD_HASH                       # dev-build
WEBUI_BANNERS                          # PersistentConfig - JSON array
USE_CUDA_DOCKER
EXTERNAL_PWA_MANIFEST_URL
LICENSE_KEY                            # PersistentConfig - Enterprise
SSL_ASSERT_FINGERPRINT                 # PersistentConfig
DEFAULT_PROMPT_SUGGESTIONS             # PersistentConfig - JSON array
PENDING_USER_OVERLAY_TITLE             # PersistentConfig
PENDING_USER_OVERLAY_CONTENT           # PersistentConfig
ENABLE_CHANNELS                        # PersistentConfig
WEBHOOK_URL                            # PersistentConfig
ENABLE_USER_WEBHOOKS                   # PersistentConfig
RESPONSE_WATERMARK                     # PersistentConfig
RESET_CONFIG_ON_START
ENABLE_FORWARD_USER_INFO_HEADERS
RAG_EMBEDDING_MODEL_TRUST_REMOTE_CODE
RAG_RERANKING_MODEL_TRUST_REMOTE_CODE
RAG_EMBEDDING_MODEL_AUTO_UPDATE
RAG_RERANKING_MODEL_AUTO_UPDATE
```

---

## Google Drive & OneDrive Integration
```bash
# Google Drive
ENABLE_GOOGLE_DRIVE_INTEGRATION        # PersistentConfig
GOOGLE_DRIVE_CLIENT_ID                 # PersistentConfig
GOOGLE_DRIVE_API_KEY                   # PersistentConfig

# OneDrive
ENABLE_ONEDRIVE_INTEGRATION            # PersistentConfig
ENABLE_ONEDRIVE_PERSONAL               # PersistentConfig
ENABLE_ONEDRIVE_BUSINESS               # PersistentConfig
ONEDRIVE_CLIENT_ID                     # Legacy
ONEDRIVE_CLIENT_ID_PERSONAL
ONEDRIVE_CLIENT_ID_BUSINESS
ONEDRIVE_SHAREPOINT_URL                # PersistentConfig
ONEDRIVE_SHAREPOINT_TENANT_ID          # PersistentConfig
```

---

## Document Intelligence (Azure)
```bash
DOCUMENT_INTELLIGENCE_ENDPOINT         # PersistentConfig
DOCUMENT_INTELLIGENCE_KEY              # PersistentConfig
```

---

## Implementation Strategy

### Phase 1: Schema Extensions (schema.json)
Add new sections to schema.json:

```json
{
  "general_advanced": {
    "webui_url": "string (PersistentConfig)",
    "enable_login_form": "boolean (PersistentConfig)",
    "enable_persistent_config": "boolean",
    "port": "integer",
    "env": "enum [dev, prod]",
    "thread_pool_size": "integer",
    "models_cache_ttl": "integer",
    // ... etc
  },
  
  "security": {
    "webui_secret_key": "string (sensitive)",
    "jwt_expires_in": "string",
    "session_cookie_same_site": "enum [lax, strict, none]",
    "session_cookie_secure": "boolean",
    "cors_allow_origin": "string",
    "safe_mode": "boolean",
    "offline_mode": "boolean",
    // ... etc
  },
  
  "database_advanced": {
    "database_type": "enum [sqlite, postgresql, sqlite+sqlcipher]",
    "database_pool_size": "integer",
    "database_enable_sqlite_wal": "boolean",
    // ... etc
  },
  
  "redis_advanced": {
    "redis_sentinel_hosts": "string",
    "redis_cluster": "boolean",
    // ... etc
  },
  
  "rag_advanced": {
    "rag_top_k_reranker": "integer",
    "enable_rag_hybrid_search": "boolean (PersistentConfig)",
    "rag_file_max_size": "integer (PersistentConfig)",
    // ... etc
  },
  
  "vector_db_extended": {
    "milvus": { /* full config */ },
    "elasticsearch": { /* full config */ },
    "opensearch": { /* full config */ },
    "pinecone": { /* full config */ },
    "qdrant_multitenancy": "boolean"
  },
  
  "web_search_extended": {
    "all_providers": { /* Google PSE, Brave, Kagi, etc. */ }
  },
  
  "audio_extended": {
    "whisper_local": { /* full config */ },
    "azure_audio": { /* full config */ },
    "deepgram": { /* full config */ }
  },
  
  "image_generation_extended": {
    "automatic1111": { /* full config */ },
    "comfyui_advanced": { /* full config */ },
    "gemini_image": { /* full config */ }
  },
  
  "code_interpreter": {
    "enable": "boolean (PersistentConfig)",
    "engine": "enum",
    "blacklisted_modules": "string",
    // ... etc
  },
  
  "oauth": {
    "enable_oauth_signup": "boolean (PersistentConfig)",
    "google": { /* full config */ },
    "microsoft": { /* full config */ },
    "github": { /* full config */ },
    "oidc_generic": { /* full config */ }
  },
  
  "ldap": { /* full config */ },
  
  "scim": {
    "enabled": "boolean (PersistentConfig)",
    "token": "string (sensitive, PersistentConfig)"
  },
  
  "user_permissions": {
    "chat": { /* all chat permissions */ },
    "features": { /* all feature permissions */ },
    "workspace": { /* all workspace permissions */ }
  },
  
  "storage_providers": {
    "provider": "enum ['', s3, gcs, azure]",
    "s3": { /* full config */ },
    "gcs": { /* full config */ },
    "azure": { /* full config */ }
  },
  
  "observability": {
    "otel": { /* full OpenTelemetry config */ }
  },
  
  "infrastructure": {
    "uvicorn_workers": "integer",
    "cache_control": "string",
    "data_dir": "string",
    // ... etc
  }
}
```

### Phase 2: Template Generation (openwebui.env.njk)

Structure template with clear sections:

```njk
{# ═══════════════════════════════════════════════ #}
{# CRITICAL PRODUCTION SETTINGS                    #}
{# ═══════════════════════════════════════════════ #}

WEBUI_URL={{ general_advanced.webui_url }}
WEBUI_SECRET_KEY={{ security.webui_secret_key }}
DATABASE_URL={{ general.database_url }}
REDIS_URL={{ redis.url }}

{# ═══════════════════════════════════════════════ #}
{# GENERAL CONFIGURATION                           #}
{# ═══════════════════════════════════════════════ #}

{% if general_advanced.enable_persistent_config %}
ENABLE_PERSISTENT_CONFIG=true
{% endif %}

ENV={{ general_advanced.env }}
PORT={{ general_advanced.port }}
// ... all general settings

{# ═══════════════════════════════════════════════ #}
{# SECURITY & AUTHENTICATION                       #}
{# ═══════════════════════════════════════════════ #}

JWT_EXPIRES_IN={{ security.jwt_expires_in }}
WEBUI_SESSION_COOKIE_SAME_SITE={{ security.session_cookie_same_site }}
// ... all security settings

{# ═══════════════════════════════════════════════ #}
{# DATABASE ADVANCED                                #}
{# ═══════════════════════════════════════════════ #}

{% if database_advanced.database_type %}
DATABASE_TYPE={{ database_advanced.database_type }}
{% endif %}
// ... all database settings

{# ═══════════════════════════════════════════════ #}
{# REDIS ADVANCED                                   #}
{# ═══════════════════════════════════════════════ #}

{% if redis_advanced.redis_cluster %}
REDIS_CLUSTER=true
{% endif %}
// ... all Redis settings

{# Continue for all categories... #}
```

### Phase 3: Schema Validation

Add JSON Schema validation rules:
- Required fields
- Type checking
- Enum validation
- Conditional requirements (x-depends-on)
- Sensitive field marking (x-sensitive)
- PersistentConfig marking (x-persistent)

### Phase 4: Documentation

For each new variable:
- Add to schema with:
  - `title`
  - `description`
  - `default`
  - `x-category`
  - `x-depends-on` (if conditional)
  - `x-sensitive` (if secret)
  - `x-persistent` (if PersistentConfig)

### Phase 5: Default Values

Establish sensible defaults that match Open WebUI's official defaults from the documentation.

---

## Key Design Principles

1. **PersistentConfig Awareness**: Mark all PersistentConfig variables clearly - they behave differently after first launch

2. **Conditional Generation**: Use Nunjucks conditionals to only generate variables when features are enabled

3. **Secrets Handling**: Mark sensitive variables and plan for Podman Secrets integration

4. **Default Safety**: All defaults should be production-safe (e.g., `SAFE_MODE=false`, `OFFLINE_MODE=false`, `BYPASS_MODEL_ACCESS_CONTROL=false`)

5. **Provider Extensibility**: Structure allows easy addition of new providers without schema changes

6. **Validation**: Schema should validate:
   - Required vs optional
   - Type correctness
   - Enum membership
   - Dependency satisfaction

---

## Deliverables Requested

1. **Updated schema.json** with all 200+ variables properly structured
2. **Updated openwebui.env.njk** template with conditional generation
3. **Schema validation additions** for new fields
4. **Documentation updates** explaining each variable category
5. **Migration guide** for existing configurations
6. **Testing checklist** to verify completeness

---

## Priority Order for Implementation

1. **PRIORITY 1** - Critical security and production variables (35 vars)
2. **PRIORITY 2** - Feature completeness for existing enabled features (60 vars)
3. **PRIORITY 3** - Advanced features most likely to be used (40 vars)
4. **PRIORITY 4** - OAuth/LDAP/SCIM for enterprise deployments (50 vars)
5. **PRIORITY 5** - User permissions granular controls (20 vars)
6. **PRIORITY 6** - Infrastructure and observability (20 vars)

---

## References

- Open WebUI Env Docs: Provided in context (owui-docs-latest.md)
- Current Schema: releases/v0.0.1/schema.json
- Current Template: releases/v0.0.1/templates/services/openwebui/openwebui.env.njk
- Release Version: v0.6.32

---

## Success Criteria

✅ All 200+ environment variables from Open WebUI v0.6.32 documented are represented in schema.json
✅ Template conditionally generates only relevant variables based on feature flags and provider selections
✅ PersistentConfig variables clearly marked and documented
✅ Sensitive variables marked for secret management
✅ Defaults match official Open WebUI defaults
✅ Schema validation prevents invalid configurations
✅ Generated .env file validates against Open WebUI without warnings
✅ Documentation explains each variable's purpose and impact
