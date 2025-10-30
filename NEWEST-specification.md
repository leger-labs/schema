# Consolidated Design Specification for Leger v0.0.1

## Architectural Foundation

You are implementing a **four-layer marketplace architecture** where users install services, models, and integrations rather than configuring 370+ variables directly. The system transforms 29 high-level decisions into complete deployment manifests.

**Layer 0: Release Catalog**
Defines what's available in this release version. Contains pinned container images with SHA256 hashes, template versions, compatibility matrices, and breaking change documentation. This is embedded directly in the schema as a top-level "release" object, not a separate file. Every container image is version-pinned - no "latest" tags except where explicitly documented as rolling releases (SearXNG, Qdrant, etc.). The catalog tracks OpenWebUI version history because it changes rapidly and breaks frequently.

**Layer 1: User Configuration**
Stores only user decisions, never derived values. Contains three sections: installed resources (which services/models/integrations), feature toggles (15 booleans like rag, web_search, code_execution), and provider selections (13 enums like vector_db: qdrant vs pgvector). Advanced overrides are optional and only present if user changed from default. Secrets reference environment variables, never store values directly.

**Layer 2: Generated Manifest**
Immutable deployment artifact with all variables resolved. Contains pinned container images with SHA256, expanded environment variables (all 370+ for OpenWebUI), resolved dependencies in correct startup order, and file checksums. This is what gets published to R2 and consumed by CLI. Each manifest has unique ID for versioning and rollback.

**Layer 3: Rendered Output**
Actual quadlet files, configuration files, and Caddy routes. Published to R2 in git-cloneable structure. CLI fetches via static URL and deploys to Podman systemd.

## Schema Structure

The single source of truth is a JSON Schema that generates three things simultaneously: validation rules for backend, RJSF UI metadata for frontend, and template rendering context for Nunjucks.

**Top-level structure:**
```
{
  schema_version: "1.0.0",
  release: { version, released_at, template_sha, changelog_url, services, models, integrations, compatibility },
  topology: { network, services },
  secrets: { api_keys, llm_providers, search_providers, audio_providers }
}
```

**Service definition pattern:**
Every service has infrastructure (deployment concerns) and configuration (runtime concerns). Infrastructure includes image, ports, dependencies, enabled_by conditions, volumes, healthchecks. Configuration is JSON Schema with x-* extensions for UI generation.

**Dual nature of services:**
Some services are infrastructure (postgres, redis) - always enabled when parent service is enabled. Others are user-installable (openwebui, litellm, jupyter) - user explicitly chooses to install. Others are conditionally enabled (searxng, qdrant, tika) - automatically enabled when user selects them as provider.

## Version Pinning Strategy

Release catalog embedded in schema defines exact versions for reproducibility. Each service entry contains name, version, image with tag, image_sha (empty for now, populate later), template_version, dependencies array, optional_dependencies keyed by feature, supported_features array, and breaking_changes documentation.

**Critical corrections identified:**
EdgeTTS image is WRONG in current templates - uses ghcr.io/traefik/parakeet:latest when should use docker.io/travisvn/openai-edge-tts:latest. This must be fixed in schema and templates.

**Version evolution:**
When OpenWebUI releases 0.7.0, create new release object with updated version and document breaking changes. Users can deploy specific release versions. System supports upgrade paths with migration guides.

## Directory Structure and Template Organization

Templates organized into service-specific folders already completed. Structure is:
```
njk/
├── release-catalog.json (deprecated - embed in schema instead)
├── blueprint-config.json (user config - will be replaced by UI input)
├── macros.njk (shared utilities)
├── llm.network.njk (network definition)
├── base-container.njk (template inheritance base)
├── openwebui/
│   ├── openwebui.container.njk
│   ├── openwebui.env.njk
│   ├── openwebui.caddy.njk
│   ├── openwebui.volume
│   ├── postgres/
│   │   ├── openwebui-postgres.container.njk
│   │   └── openwebui-postgres.volume
│   └── redis/
├── litellm/
│   ├── litellm.container.njk
│   ├── litellm.yaml.njk
│   └── [postgres/redis subdirs]
└── [other services follow same pattern]
```

Templates reference schema via: `{% set service_def = release.services.openwebui %}` then use `Image={{ service_def.image }}` instead of hardcoded values.

## Service Inventory and Requirements

**Core infrastructure services (always present):**
- llm.network (10.89.0.0/24 subnet)
- Caddy (reverse proxy with Tailscale HTTPS)

**User-installable services (primary):**
- OpenWebUI + dedicated postgres + dedicated redis
- LiteLLM + dedicated postgres + dedicated redis  
- Jupyter (code execution)
- Llama-Swap (local model router)
- Cockpit (system management)
- MCP Context Forge + dedicated postgres

**Conditionally-enabled services (provider-dependent):**
- SearXNG + dedicated redis (when web_search_engine: searxng)
- Qdrant (when vector_db: qdrant)
- Tika (when content_extraction: tika)
- Whisper (when stt_engine: whisper or openai+local)
- EdgeTTS (when tts_engine: edge-tts)
- ComfyUI (when image_engine: comfyui)

**Database-per-service pattern:**
Each main service gets dedicated PostgreSQL and Redis instances. Never share databases. Naming convention: servicename_postgres, servicename_redis. This provides isolation, independent scaling, and no port conflicts.

## Configuration Complexity Reduction

OpenWebUI has 370+ environment variables but user only makes 29 decisions. System automatically expands based on selections.

**The 29 decision variables:**

15 Feature Flags (boolean): rag, web_search, image_generation, speech_to_text, text_to_speech, code_execution, code_interpreter, google_drive, onedrive, oauth_signup, ldap, title_generation, autocomplete_generation, tags_generation, websocket_support

13 Provider Selections (enum): vector_db (pgvector|qdrant|chroma), rag_embedding (openai|ollama), content_extraction (tika|docling), text_splitter (character|recursive), web_search_engine (searxng|tavily|brave), web_loader (requests|selenium), image_engine (openai|automatic1111|comfyui), stt_engine (openai|whisper), tts_engine (openai|elevenlabs|edgetts), code_execution_engine (jupyter|pyodide), code_interpreter_engine (jupyter|e2b), storage_provider (""| s3|gcs), auth_provider (local|oauth|ldap)

1 Advanced Override (object): Contains tunable parameters like RAG top-k, chunk sizes, etc. Only populated if user changes defaults.

**Variable classification:**
All 370+ variables categorized as structural (affects service enablement), provider_selection (choice between alternatives), configuration (tunes behavior), derived (computed from other values), or secret (API keys from environment).

## Progressive Disclosure and Conditional Logic

This is the core UX innovation. Form reveals fields based on prior selections using x-depends-on and x-provider-fields metadata.

**Pattern example for RAG:**
User enables ENABLE_RAG feature toggle → Field VECTOR_DB becomes visible → User selects "qdrant" → Fields QDRANT_URL and QDRANT_API_KEY appear → Service qdrant automatically added to enabled services list → Backend resolves qdrant container image from catalog → Template renders qdrant.container quadlet.

**Provider-specific fields:**
Each provider selection field has x-provider-fields metadata mapping provider values to required fields. When WEB_SEARCH_ENGINE changes from "searxng" to "tavily", hide SEARXNG_QUERY_URL and show TAVILY_API_KEY.

**Service enablement expressions:**
Services have enabled_by array with boolean expressions evaluated as logical OR. Example: searxng enabled when "openwebui.configuration.ENABLE_WEB_SEARCH == true AND openwebui.configuration.WEB_SEARCH_ENGINE == 'searxng'". These expressions reference dotted paths into service configuration sections.

**Dependency cascade:**
When user installs OpenWebUI, system automatically installs openwebui_postgres and openwebui_redis because they're in required dependencies. If user enables RAG and selects Qdrant, system automatically installs qdrant. If user later disables RAG or switches to pgvector, qdrant is automatically removed.

## Metadata Extensions for UI Generation

Schema uses x-* extensions that don't affect validation but control UI rendering:

**x-category:** Groups fields in UI (General, Features, Providers, Advanced, Security). Sidebar navigation generated from categories.

**x-display-order:** Sort order within category (integer). Lower numbers appear first.

**x-visibility:** Control when field appears (exposed|advanced|expert|hidden). Expert mode toggle reveals expert fields.

**x-depends-on:** Object specifying conditions for field visibility. Example: `{ "ENABLE_WEB_SEARCH": true, "WEB_SEARCH_ENGINE": "searxng" }` means field only appears when both conditions met.

**x-enables-services:** Array of service IDs enabled when boolean field is true. Example: ENABLE_WEB_SEARCH enables ["searxng", "searxng_redis"].

**x-provider-fields:** Object or array defining which fields appear for each provider selection. Can be object mapping provider values to field arrays, or array listing fields that always appear.

**x-affects-services:** Object mapping field values to service IDs. Example: `{ "searxng": "searxng", "tavily": null, "brave": null }` means selecting "searxng" enables searxng service, others need no service.

**x-requires-field:** String path to another field this depends on. Example: OPENAI_API_KEY requires "litellm.configuration.LITELLM_MASTER_KEY". System validates referenced field exists and optionally enforces value matching.

**x-sensitive:** Boolean marking field as containing secrets. UI masks input, value never logged, stored encrypted.

**x-secret-ref:** String path to secrets section. Example: "secrets.api_keys.litellm_master" points to where value is stored.

**x-template-path:** String path in blueprint-config.json (legacy) or where value should be written.

**x-rationale:** String explaining why field exists and when to change it. Shows as help text.

**x-default-handling:** Enum (preloaded|unset|user-configured) tracking whether user modified default.

**x-env-var:** String name of environment variable this field generates. Used in quadlet rendering.

## Validation Rules

System implements four validation levels:

**Field-level validation:**
Standard JSON Schema type checking, enum validation, pattern matching for strings (regex), range validation for numbers (min/max), array constraints (minItems/maxItems). Sensitive fields should reference secrets, not contain values directly (warning level).

**Service-level validation:**
All required configuration fields must have values. All service dependencies must exist in topology.services. Published ports must be unique across services. Container names must be unique. Healthchecks recommended for all enabled services (warning). Volume names should follow convention servicename.volume or servicename-purpose.volume (warning).

**Topology-level validation:**
No circular dependencies (topological sort must succeed). Conditional enablement expressions must reference valid configuration paths. Provider fields must exist when provider selected. Fields with x-depends-on should only be required when dependency met. Cross-service field references (x-requires-field) must point to existing fields. Services in x-affects-services and x-enables-services must exist. Template paths should be unique. Secret references must exist in secrets section. All services should use same network for inter-service communication (warning).

**Runtime validation:**
Dependencies must pass health checks before dependents start. Services with enabled_by conditions start/stop based on configuration changes. Published ports must be available on host.

## Template Rendering Mechanics

Templates receive complete topology object as context plus derived values. Resolution engine computes enabled services by evaluating enabled_by expressions and checking user's installed services list. Dependency graph computed via topological sort to determine startup order. Environment variables generated by expansion function that takes 29 decisions and produces 370+ variables following OpenWebUI's documented requirements.

**Template context available:**
Service identifiers (service_name, container_name, hostname), image reference, network name, ports (internal, published, bind address), dependencies array, volumes array with mounts, healthcheck object, environment variables as key-value dict, configuration object with all schema fields, infrastructure object with deployment settings, metadata (description, websocket, external_subdomain), secrets object, global topology reference, enabled_services list, startup_order array.

**Template inheritance:**
Templates extend base-container.njk which provides standard structure. Child templates override specific blocks: service_header (description), dependencies (After= directives), network_config, ports, volumes, environment, health_check, service_exec. This eliminates 50% duplication.

**Macro usage:**
Common patterns extracted to macros.njk. Categories include systemd (unitSection, afterDependencies), container (publishPort, volumeMount, healthCheck, amdGPU), environment (databaseURL, redisURL, openaiEndpoint), caddy (reverseProxy), service (serviceSection), conditional (ifEnabled, ifFeature, ifProvider). Import as `{% import "macros.njk" as m %}` then call `{{ m.publishPort(service) }}`.

**Custom filters:**
Nunjucks environment adds custom filters. boolstring converts boolean to lowercase string for env vars. shouldInclude checks if field should render based on x-depends-on. default provides fallback values like Jinja2.

## Model Management

Models are installables, not configuration. Users browse cloud and local model catalogs and click install.

**Cloud models:**
Catalog defines available models from OpenAI, Anthropic, Google, etc. Each has provider, name, description, context_window, pricing, supports array, requires_api_key, litellm_compatible flag. When user installs model, system adds to installed.models.cloud array and generates LiteLLM model_list entry automatically.

**Local models:**
Catalog defines models with HuggingFace URIs, quantization, RAM requirements, context windows, group classification (task vs heavy). When user installs, CLI downloads from HuggingFace to local cache and llama-swap manages lifecycle. Models organized into groups: task models (always loaded, <4GB RAM) and heavy models (swap on demand, 16GB+ RAM).

**Model configuration generation:**
Resolution engine generates litellm.yaml with model_list containing all installed cloud models. Generates llama-swap config with all installed local models. OpenWebUI environment includes model lists for task model assignments (title generation, tags, autocomplete).

## Integration Marketplace

Third-party services that enhance functionality without requiring containers. Types include web_search (Tavily, Brave), content_extraction (Docling API), tts (ElevenLabs), vector_db (Pinecone, Milvus Cloud). Each integration has type, requires_api_key flag, provides array indicating which OpenWebUI features it enables.

When user enables feature and selects external integration as provider, system prompts for API key and configures OpenWebUI environment automatically. No containers deployed, just environment variables set.

## Secrets Management

Never store secrets in schema or manifests. Always reference environment variables. Secrets section maps logical names to environment variable references: `"openai": "${OPENAI_API_KEY}"`. Configuration fields with x-sensitive:true should have x-secret-ref pointing to secrets path.

In generated manifest, secret references remain as ${VAR} placeholders. CLI resolves from environment during deployment. Cloudflare Workers stores encrypted secrets in D1 per-user. Local development uses .env files excluded from git.

## Resolution Engine Algorithm

Transform User Config → Generated Manifest via multi-stage resolution:

**Stage 1 - Resolve services:**
Start with user's installed.services list. For each service, get definition from release catalog. Add to manifest.containers with pinned image and SHA. Recursively add all required dependencies. For each feature user enabled, check service's optional_dependencies - if user installed optional dep, add to manifest.

**Stage 2 - Evaluate enabled_by:**
For all services in catalog, evaluate enabled_by expressions against user configuration. Expression syntax: "servicename.configuration.FIELD == value" with operators ==, !=, &&, ||. Logical OR across array items - any true condition enables service. Add conditionally-enabled services to manifest.containers.

**Stage 3 - Compute dependency graph:**
Build directed graph from requires arrays. Run topological sort (Kahn's algorithm or DFS). Result is startup_order array. Detect circular dependencies and fail if found.

**Stage 4 - Generate environment variables:**
For each service, call generation function that expands configuration. OpenWebUI generator takes 29 decisions and produces 370+ variables following documented patterns. DATABASE_URL from postgres container_name, REDIS_URL from redis container_name, conditional blocks for each feature, provider-specific nested configuration.

**Stage 5 - Generate model configurations:**
Cloud models become LiteLLM model_list entries. Local models become llama-swap config. Embedding models configured in RAG section. Task models assigned to specific functions.

**Stage 6 - Compute checksums:**
Hash entire manifest for immutability. Hash individual files for integrity checking. Generate manifest.json with file list and checksums. Create deployment ID as unique identifier.

## File Publishing Strategy

Generated manifest and rendered files published to R2 in git-cloneable structure:

```
{user_uuid}/
  v1/
    manifest.json
    llm.network
    openwebui.container
    openwebui.env
    litellm.container
    litellm.yaml
    caddy.container
    Caddyfile
    [all other quadlets and configs]
  v2/
    [files]
  latest/
    redirect.json → current version
```

Each version directory is immutable. Latest pointer updates atomically. CLI fetches manifest.json to get file list and checksums, then downloads all files, verifies checksums, installs to ~/.config/containers/systemd/, runs systemctl daemon-reload.

## Critical Design Decisions Finalized

**Four layers strictly separated:** Release catalog defines available resources. User config contains only decisions. Generated manifest has all values resolved. Rendered output is deployment artifact. Never mix concerns.

**Version pinning mandatory:** No latest tags except documented rolling releases. Every release has specific container versions with SHA256. Templates reference catalog, never hardcode versions.

**Database per service:** Never share postgres or redis. Each service gets dedicated instances. Isolation, scaling, naming clarity.

**Progressive disclosure:** UI reveals fields based on selections. Provider choice determines visible fields. Features enable service lists.

**Conditional enablement:** Services auto-enable from feature+provider combinations. Boolean expressions evaluated against configuration. Logical OR semantics.

**Marketplace model:** Users install not configure. Services, models, integrations are resources. 29 decisions not 370+ variables.

**Frontend agnostic:** Schema defines validation and UI metadata. Frontend consumes schema via RJSF. Backend renders templates. Clean separation.

**Template inheritance and macros:** DRY principle via base templates and macro library. 50% code reduction. Consistent structure.

**Semantic versioning:** Schema versions track breaking changes. Release catalog versions track container updates. Users deploy specific versions. Rollback supported.

**No timelines, full specification:** This is the complete design. Implementation follows specification exactly. No prioritization, no phases, just comprehensive design documentation.
