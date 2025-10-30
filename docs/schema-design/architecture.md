# Leger Schema Architecture v0.0.1

## Overview

The Leger schema system is a **four-layer marketplace architecture** that transforms 29 high-level user decisions into complete Podman Quadlet deployments.

## Core Principles

1. **Single Source of Truth**: One versioned schema defines everything
2. **Progressive Disclosure**: UI reveals fields based on user selections
3. **Version Pinning**: Container images locked to specific x.x.x versions (no SHA256)
4. **Clean Separation**: Release catalog ≠ User config ≠ Generated output
5. **Marketplace Model**: Users install services/models, not configure 370+ variables
6. **Versioned Releases**: Immutable release directories with schema + templates
7. **Orthogonal Models**: Model catalog maintained separately in leger-labs/model-store

## Four-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 0: RELEASE CATALOG (schema.json in releases/vX.X.X/)     │
│ - Available services with version pins                          │
│ - Integration definitions                                        │
│ - Compatibility matrices                                         │
│ - Template file references                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: USER CONFIGURATION (user-config.json)                  │
│ - 29 decision variables                                          │
│ - Installed services/models/integrations                         │
│ - Feature toggles (15 booleans)                                  │
│ - Provider selections (13 enums)                                 │
│ - Optional advanced overrides (1 object)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: GENERATED MANIFEST (manifest.json)                     │
│ - All 370+ variables resolved                                    │
│ - Dependency graph computed                                      │
│ - Services enabled/disabled                                      │
│ - Environment variables expanded                                 │
│ - Immutable deployment artifact                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: RENDERED OUTPUT (.container, .volume, configs)         │
│ - Actual Podman Quadlet files                                    │
│ - Configuration files (YAML, etc)                                │
│ - Caddy routes                                                   │
│ - Published to R2 storage                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User fills RJSF form in web UI
         ↓
Form validates against schema.json
         ↓
User saves → generates user-config.json
         ↓
Cloudflare Worker receives config
         ↓
Worker loads schema.json from release version
         ↓
Resolution engine computes manifest.json
         ↓
Nunjucks renderer applies templates
         ↓
Output files published to R2 (per-user versioned)
         ↓
CLI fetches from R2 URL
         ↓
CLI deploys to local Podman systemd
```

## The 29 Decision Variables

### Feature Flags (15 booleans)
```
1.  rag                      - Enable RAG capabilities
2.  web_search               - Enable web search
3.  image_generation         - Enable image generation
4.  speech_to_text           - Enable STT
5.  text_to_speech           - Enable TTS
6.  code_execution           - Enable code execution
7.  code_interpreter         - Enable code interpreter
8.  google_drive             - Enable Google Drive integration
9.  onedrive                 - Enable OneDrive integration
10. oauth_signup             - Enable OAuth signup
11. ldap                     - Enable LDAP authentication
12. title_generation         - Enable AI title generation
13. autocomplete_generation  - Enable autocomplete
14. tags_generation          - Enable tag generation
15. websocket_support        - Enable WebSocket connections
```

### Provider Selections (13 enums)
```
1.  vector_db                - pgvector | qdrant | chroma
2.  rag_embedding            - openai | ollama
3.  content_extraction       - tika | docling
4.  text_splitter            - character | recursive
5.  web_search_engine        - searxng | tavily | brave
6.  web_loader               - requests | selenium
7.  image_engine             - openai | automatic1111 | comfyui
8.  stt_engine               - openai | whisper
9.  tts_engine               - openai | elevenlabs | edgetts
10. code_execution_engine    - jupyter | pyodide
11. code_interpreter_engine  - jupyter | e2b
12. storage_provider         - "" | s3 | gcs
13. auth_provider            - local | oauth | ldap
```

### Advanced Overrides (1 object)
```
advanced:
  rag_top_k: 5
  chunk_size: 1500
  chunk_overlap: 100
  query_rewrite: true
  hybrid_search: false
  # ... other tunable parameters
```

**Total:** 29 variables that expand to 370+ OpenWebUI environment variables.

## Service Classification

### Infrastructure Services (always enabled)
- `llm.network` - Container network (10.89.0.0/24)
- `caddy` - Reverse proxy with Tailscale HTTPS

### User-Installable Services (explicit install)
- `openwebui` + `openwebui_postgres` + `openwebui_redis`
- `litellm` + `litellm_postgres` + `litellm_redis`
- `jupyter` - Code execution
- `llama_swap` - Local model router
- `cockpit` - System management
- `mcp_context_forge` + `mcp_context_forge_postgres`

### Conditionally-Enabled Services (auto-enabled by feature+provider)
- `searxng` + `searxng_redis` - when web_search_engine: "searxng"
- `qdrant` - when vector_db: "qdrant"
- `tika` - when content_extraction: "tika"
- `whisper` - when stt_engine: "whisper"
- `edgetts` - when tts_engine: "edgetts"
- `comfyui` - when image_engine: "comfyui"

## Progressive Disclosure Pattern

```
User enables features.rag: true
    ↓
Field providers.vector_db becomes visible (x-depends-on)
    ↓
User selects providers.vector_db: "qdrant"
    ↓
Fields qdrant_url, qdrant_api_key appear (x-provider-fields)
    ↓
Service "qdrant" auto-added to enabled_services (x-affects-services)
    ↓
Resolution engine evaluates enabled_by expressions
    ↓
Template qdrant.container.njk rendered
```

## Metadata Extensions for RJSF

All `x-*` extensions control UI generation and validation:

### UI Grouping
- `x-category` - Sidebar section (Features, Providers, Security, etc.)
- `x-display-order` - Sort order within category (integer, lower first)

### Progressive Disclosure
- `x-depends-on` - Conditional visibility (object with field:value pairs)
  - Fields only appear when ALL conditions are true
  - This is the ONLY visibility mechanism - no "expert mode" toggles

### Service Enablement
- `x-affects-services` - Maps enum values to service IDs
- `x-provider-fields` - Fields that appear for each provider choice

### Environment Variables
- `x-env-var` - Environment variable name this field generates

### Documentation
- `x-rationale` - Help text for users
- `x-sensitive` - Boolean marking secrets (UI masks, external storage)

## Version Pinning Strategy

Each service specifies version separately from image:

```json
{
  "openwebui": {
    "name": "Open WebUI",
    "version": "0.6.34",
    "image": "ghcr.io/open-webui/open-webui",
    "port": 8080,
    "dependencies": {
      "required": ["openwebui_postgres", "openwebui_redis", "litellm"]
    },
    "enabled_by": [],
    "template_files": ["container", "volume", "env", "caddy"]
  }
}
```

**Key points:**
- `version` and `image` are separate fields
- No SHA256 hashes (overkill for this use case)
- Semantic versioning (x.x.x format)
- Templates combine: `Image={{ image }}:{{ version }}`
- Port included as exception (needed for service discovery)

## Repository Structure

```
leger-schema/
├── .github/
│   └── workflows/
│       ├── validate.yml        # Validates schema on PR
│       └── publish.yml         # Publishes release
│
├── releases/
│   ├── v1.0.0/
│   │   ├── schema.json         # Release catalog + topology validation
│   │   ├── templates/          # All .njk templates for this version
│   │   │   ├── base/
│   │   │   │   ├── base-container.njk
│   │   │   │   └── macros.njk
│   │   │   ├── network/
│   │   │   │   └── llm.network.njk
│   │   │   └── services/
│   │   │       ├── openwebui/
│   │   │       │   ├── openwebui.container.njk
│   │   │       │   ├── openwebui.env.njk
│   │   │       │   ├── openwebui.caddy.njk
│   │   │       │   ├── openwebui.volume
│   │   │       │   └── postgres/
│   │   │       │       ├── openwebui-postgres.container.njk
│   │   │       │       └── openwebui-postgres.volume
│   │   │       ├── litellm/
│   │   │       │   └── [similar structure]
│   │   │       └── [other services]
│   │   └── RELEASE.md          # Human-readable release notes
│   │
│   ├── v1.1.0/
│   │   └── [same structure with updates]
│   │
│   └── latest -> v1.0.0        # Symlink to current release
│
├── ARCHITECTURE.md             # This file
├── SCHEMA-DOCUMENTATION.md     # Detailed schema specification
├── SCHEMA-SKELETON.json        # Master skeleton template
└── README.md                   # Overview
```

**Key principles:**
- Each release is immutable
- Release includes schema + all templates for that version
- Symlink `latest` points to current stable release
- No examples directory (examples shown in documentation only)
- No migration guides (not handling breaking changes yet)
- No separate validation scripts (GitHub Actions only)

## Schema Versioning

Schema uses semantic versioning in `schema_version` field:

- **Major** (x.0.0) - Breaking changes (field removed/renamed, structure changed)
- **Minor** (0.x.0) - New features (new services/fields added, backward compatible)
- **Patch** (0.0.x) - Bug fixes (validation rules, documentation, templates)

Current version: `1.0.0`

## Model Store Integration

Models are **orthogonal** to schema releases:

```
leger-labs/model-store/          # Separate repository
├── cloud/
│   ├── claude-sonnet-4-5.json
│   ├── gpt-5.json
│   └── [other cloud models]
├── local/
│   ├── qwen3-14b.json
│   ├── llama-4-scout-17b.json
│   └── [other local models]
└── schemas/
    ├── cloud.schema.json
    └── local.schema.json
```

**How it works:**
1. User-config.json references models by file name:
   ```json
   {
     "installed": {
       "models": [
         {"source": "cloud", "id": "claude-sonnet-4-5"},
         {"source": "local", "id": "qwen3-14b"}
       ]
     }
   }
   ```

2. UI queries model-store API to show catalog
3. User clicks "Add Model" → added to list
4. Resolution engine fetches model details when generating manifest
5. Model-store updates continuously (not version-locked to schema)

**Rationale:** AI models release frequently, schema should be stable.

## Design Decisions

### ✅ What We Include

1. **Release Catalog** - Embedded in schema.json
2. **Topology Schema** - JSON Schema validation + RJSF UI metadata in one file
3. **Template References** - Which .njk files to render per service
4. **Conditional Logic** - Declarative enabled_by expressions
5. **Version Pins** - Exact container versions (x.x.x format)
6. **Port Metadata** - Exception to minimal principle (needed for discovery)
7. **Model References** - Points to model-store files (not full definitions)

### ❌ What We Exclude

1. **SHA256 Hashes** - Overkill, just use version tags
2. **Example Configs** - Shown in documentation, not checked into repo
3. **Breaking Changes** - Not worrying about migrations yet
4. **Secret Values** - Handled by external secret store
5. **Model Definitions** - Maintained in separate model-store repo
6. **Default User Configs** - Not in schema (user creates via UI)

## Critical Corrections

1. **EdgeTTS Image Fixed**
   - ❌ Was: `ghcr.io/traefik/parakeet:latest`
   - ✅ Now: `docker.io/travisvn/openai-edge-tts:latest`

2. **Database-Per-Service Pattern**
   - Each service gets dedicated PostgreSQL + Redis
   - No shared databases
   - Naming: `servicename_postgres`, `servicename_redis`

3. **Conditional Logic is Declarative**
   - Resolution engine evaluates enabled_by before template rendering
   - Templates receive pre-computed enabled_services list
   - No complex conditionals in templates

## Validation Strategy

Validation happens at multiple levels via GitHub Actions:

### validate.yml Workflow

Runs on pull requests to validate:
- Schema structure (valid JSON Schema v7)
- All service IDs in enabled_by exist
- All x-affects-services point to valid services
- All x-provider-fields reference existing fields
- Semantic version format (x.x.x)
- Template file references exist in templates/

### publish.yml Workflow

Runs on git tag push to:
- Validate schema
- Run all validation checks
- Create GitHub release
- Tag docker images
- Publish to package registry

**No separate validation scripts** - all validation in CI/CD.

## Next Implementation Steps

1. Complete schema.json with all services defined
2. Create .njk templates for each service
3. Implement resolution engine in Cloudflare Worker
4. Build RJSF form generator from schema
5. Integrate with model-store API
6. Set up R2 storage for rendered outputs
7. Create CLI for fetching and deploying
