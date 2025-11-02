# Future Completions - OpenWebUI v0.6.32 Integration

**Date**: 2025-11-02
**Schema Version**: v0.0.1
**Status**: Documented but Not Implemented

---

## Overview

This document catalogs OpenWebUI v0.6.32 features that are **documented but not yet implemented** in the Leger schema. These represent future expansion opportunities when users need additional capabilities.

---

## Missing Podman Quadlet Services

Services referenced in OpenWebUI environment variables but not yet templated:

### 1. AUTOMATIC1111 (Stable Diffusion WebUI)

**Purpose**: Alternative image generation backend
**OpenWebUI Variables**: `AUTOMATIC1111_BASE_URL`, `AUTOMATIC1111_API_AUTH`, `AUTOMATIC1111_CFG_SCALE`, `AUTOMATIC1111_SAMPLER`
**Container Image**: `ghcr.io/automatic1111/stable-diffusion-webui` (estimate)
**Port**: 7860 (default)
**Priority**: Low (ComfyUI already available)

**Required Quadlets**:
- `automatic1111.container`
- `automatic1111.volume`

**Schema Changes Needed**:
```json
{
  "infrastructure": {
    "services": {
      "automatic1111": {
        "container_name": "automatic1111",
        "hostname": "automatic1111",
        "port": 7860,
        "volume": "automatic1111.volume"
      }
    }
  }
}
```

### 2. Playwright (Headless Browser)

**Purpose**: JavaScript-enabled web scraping for RAG
**OpenWebUI Variable**: `WEB_LOADER_ENGINE=playwright`
**Container Image**: `mcr.microsoft.com/playwright:v1.40.0-jammy`
**Port**: N/A (used as sidecar or shared library)
**Priority**: Medium (requests and selenium sufficient for most use cases)

**Implementation Options**:
- Option A: Sidecar container (complex)
- Option B: Install in OpenWebUI container (simpler)
- Option C: External service with API

**Schema Changes**: May require `providers.web_loader` conditional logic extension

### 3. Docling (Document Intelligence)

**Purpose**: Alternative document processor to Tika
**OpenWebUI Variable**: `CONTENT_EXTRACTION_ENGINE=docling`
**Container Image**: TBD (likely custom)
**Port**: TBD
**Priority**: Low (Tika already available)

**Required Quadlets**:
- `docling.container`

### 4. E2B (Code Interpreter)

**Purpose**: Cloud-based code execution environment
**OpenWebUI Variables**: `CODE_INTERPRETER_ENGINE=e2b`, `E2B_API_KEY`
**Service Type**: External API (no container needed)
**Priority**: Low (Jupyter already available)

**Schema Changes Needed**:
```json
{
  "secrets": {
    "e2b_api_key": {
      "type": "string",
      "default": "{E2B_API_KEY}",
      "x-provider": "e2b",
      "x-required-by": ["openwebui"],
      "x-required-when": {"providers.code_interpreter_engine": "e2b"}
    }
  }
}
```

---

## Missing External API Secrets

Cloud service API keys referenced but not in `secrets` section:

### Search Providers (7 services)

| Provider | API Keys Required | Registration URL | Priority |
|----------|-------------------|------------------|----------|
| **Google PSE** | `google_pse_api_key`, `google_pse_engine_id` | https://developers.google.com/custom-search | Low |
| **Brave** | `brave_search_api_key` | https://brave.com/search/api/ | Medium |
| **Serper** | `serper_api_key` | https://serper.dev/ | Low |
| **SerpAPI** | `serpapi_api_key` | https://serpapi.com/ | Low |
| **Bing** | `bing_search_v7_subscription_key` | https://www.microsoft.com/en-us/bing/apis/bing-web-search-api | Low |
| **Kagi** | `kagi_search_api_key` | https://kagi.com/api | Low |
| **Mojeek** | `mojeek_search_api_key` | https://www.mojeek.com/services/api/ | Low |

**Implementation**: Add to `schema.json` → `secrets` section with `x-required-when` conditions

### Audio Providers (2 services)

| Provider | API Keys Required | Registration URL | Priority |
|----------|-------------------|------------------|----------|
| **Azure Speech** | `audio_stt_azure_api_key`, `audio_tts_azure_api_key` | https://azure.microsoft.com/en-us/products/ai-services/speech | Low |
| **Deepgram** | `deepgram_api_key` | https://deepgram.com/ | Low |

**Note**: ElevenLabs already in schema but not wired to template

### Image Providers (2 services)

| Provider | API Keys Required | Registration URL | Priority |
|----------|-------------------|------------------|----------|
| **Gemini Image** | `gemini_api_key` (already in schema) | https://makersuite.google.com/app/apikey | Medium |
| **AUTOMATIC1111** | No API key (self-hosted) | N/A | Low |

**Implementation**: Add conditional logic to `openwebui.env.njk` for Gemini images

### Cloud Storage Providers (3 services)

| Provider | Credentials Required | Schema Section | Priority |
|----------|---------------------|----------------|----------|
| **AWS S3** | `s3_access_key_id`, `s3_secret_access_key` | New `storage_config` | Medium |
| **GCS** | `google_application_credentials_json` | New `storage_config` | Low |
| **Azure Blob** | `azure_storage_key` | New `storage_config` | Low |

**Implementation**: Requires new `storage_config` section in schema with provider-specific fields

### Google Drive & OneDrive (2 integrations)

| Service | Credentials Required | OAuth Flow | Priority |
|---------|---------------------|------------|----------|
| **Google Drive** | `google_drive_client_id`, `google_drive_api_key` | OAuth 2.0 | Medium |
| **OneDrive** | `onedrive_client_id_personal`, `onedrive_client_id_business` | OAuth 2.0 | Low |

**Complexity**: Requires OAuth flow implementation (not just API keys)

---

## Missing Schema Sections

Major schema extensions needed for full v0.6.32 coverage:

### 1. Advanced RAG Configuration

**Purpose**: Fine-tuning for RAG performance
**Priority**: Low (basic RAG sufficient for most)

**New fields needed** (~15):
```json
{
  "provider_config": {
    "rag_top_k_reranker": 3,
    "rag_relevance_threshold": 0.0,
    "enable_rag_hybrid_search": false,
    "rag_template": "...",
    "pdf_extract_images": false,
    "rag_file_max_size": 10,
    "rag_file_max_count": 10,
    "rag_embedding_batch_size": 1
  }
}
```

### 2. Database Advanced

**Purpose**: Connection pooling and performance tuning
**Priority**: Low (defaults sufficient)

**New fields needed** (~8):
```json
{
  "infrastructure_advanced": {
    "database_pool_size": 10,
    "database_pool_max_overflow": 20,
    "database_pool_timeout": 30,
    "database_enable_sqlite_wal": true
  }
}
```

### 3. Observability (OpenTelemetry)

**Purpose**: Production monitoring and tracing
**Priority**: Low (single-user doesn't need)

**New section needed**:
```json
{
  "observability": {
    "enable_otel": false,
    "otel_endpoint": "",
    "otel_service_name": "openwebui"
  }
}
```

### 4. OAuth/LDAP Configuration

**Purpose**: Enterprise multi-user authentication
**Priority**: Low (single-user deployment)

**New sections needed**:
```json
{
  "authentication": {
    "oauth": {
      "enable": false,
      "provider": "generic",
      "client_id": "",
      "client_secret": ""
    },
    "ldap": {
      "enable": false,
      "server_host": "",
      "search_base": ""
    }
  }
}
```

### 5. Storage Configuration

**Purpose**: External file storage
**Priority**: Medium (for backups/scaling)

**New section needed**:
```json
{
  "storage": {
    "provider": "",
    "s3": {
      "bucket_name": "",
      "access_key_id": "",
      "secret_access_key": "",
      "region": "us-east-1"
    },
    "gcs": {
      "bucket_name": "",
      "credentials_json": ""
    }
  }
}
```

---

## Provider Enum Extensions Needed

Additional options for existing provider enums:

### Already Extended (✅ Complete)

- `web_search_engine`: ✅ Added google_pse, serper, serpapi, bing, ""
- `image_engine`: ✅ Added gemini, ""
- `stt_engine`: ✅ Added azure, deepgram, ""
- `tts_engine`: ✅ Added azure, ""
- `web_loader`: ✅ Added playwright, safe_web
- `text_splitter`: ✅ Added token, markdown_header

### Future Extensions

**Vector DB Providers**:
```json
"vector_db": {
  "enum": ["pgvector", "qdrant", "chroma", "milvus", "elasticsearch", "opensearch", "pinecone"]
}
```

**Content Extraction**:
```json
"content_extraction": {
  "enum": ["tika", "docling", "azure_doc_intelligence"]
}
```

---

## Implementation Priority Matrix

| Feature | User Demand | Complexity | Priority | ETA |
|---------|-------------|------------|----------|-----|
| **Cloud Storage (S3/GCS)** | High | Medium | High | v0.0.2 |
| **Additional Search Engines** | Medium | Low | Medium | v0.0.3 |
| **Gemini Image Generation** | Medium | Low | Medium | v0.0.3 |
| **Advanced RAG Settings** | Low | Low | Low | v0.1.0 |
| **OAuth/LDAP** | Low | High | Low | v0.2.0 |
| **Observability** | Low | Medium | Low | v0.2.0 |
| **AUTOMATIC1111** | Low | Medium | Low | v0.3.0 |
| **Playwright Web Loader** | Low | High | Low | v0.3.0 |

---

## How to Add a Missing Feature

### For External API Keys:

1. **Add to `schema.json` → `secrets`**:
   ```json
   {
     "brave_search_api_key": {
       "type": "string",
       "default": "{BRAVE_SEARCH_API_KEY}",
       "x-sensitive": true,
       "x-provider": "brave",
       "x-required-when": {"providers.web_search_engine": "brave"}
     }
   }
   ```

2. **Update SECRETS.md**: Document the new secret

3. **User adds to Cloudflare KV**: Via `leger secrets sync`

4. **Template receives via Podman Secret**: Already wired

### For New Services:

1. **Add to `schema.json` → `infrastructure.services`**:
   ```json
   {
     "automatic1111": {
       "container_name": "automatic1111",
       "hostname": "automatic1111",
       "port": 7860
     }
   }
   ```

2. **Create Quadlet templates**:
   - `automatic1111.container.njk`
   - `automatic1111.volume.njk`

3. **Update `openwebui.env.njk`**: Add conditional logic

4. **Test**: `leger deploy install && systemctl --user start automatic1111`

### For New Schema Sections:

1. **Extend `schema.json`**: Add new top-level section or extend `provider_config`

2. **Update validation**: Ensure JSON Schema rules

3. **Update templates**: Use new fields in Nunjucks templates

4. **Update docs**: Document new fields in README

---

## Questions & Answers

### Q: Why aren't all 200+ variables active by default?

**A**: Most variables are for enterprise features (OAuth, LDAP, OTEL) or alternative providers. The superuser single-user deployment model only needs ~74 active variables. The other 140+ are documented for future use.

### Q: Can I enable a commented feature?

**A**: Yes! Commented features have full documentation. To enable:
1. Check if requires schema changes (usually yes for new providers)
2. Check if requires external API key (add to secrets section)
3. Uncomment relevant section in `openwebui.env.njk`
4. Re-run `leger deploy install`

### Q: What's the fastest feature to add?

**A**: External API-based services (search engines, audio providers) - just add API key to schema, no new Quadlets needed.

### Q: What's the hardest feature to add?

**A**: OAuth/LDAP (requires complex authentication flows) or Playwright (requires browser automation integration).

---

## Conclusion

The current v0.0.1 implementation provides:
- ✅ Complete core functionality (~74 active variables)
- ✅ Full documentation of 200+ variables
- ✅ Clear upgrade path for future features

**Next priorities**:
1. Cloud storage (S3/GCS) - v0.0.2
2. Additional search engines - v0.0.3
3. Advanced RAG settings - v0.1.0

All features are **documented and ready to implement** when user demand justifies the development effort.
