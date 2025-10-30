# Schema.json Master Skeleton Documentation

This document explains every section of the schema.json structure and the design decisions behind it.

## Table of Contents

1. [Top-Level Structure](#top-level-structure)
2. [Release Catalog Section](#release-catalog-section)
3. [Topology Section](#topology-section)
4. [The 29 Decision Variables](#the-29-decision-variables)
5. [Metadata Extensions](#metadata-extensions)
6. [Design Rationale](#design-rationale)

---

## Top-Level Structure

```json
{
  "$schema": "...",           // JSON Schema version
  "$id": "...",               // Canonical URL for this schema
  "schema_version": "1.0.0",  // Semantic version of schema structure
  
  "release": { ... },         // What's available in this release
  "topology": { ... },        // JSON Schema for user-config.json
  "definitions": { ... },     // Reusable schema components
  "x-metadata": { ... }       // Tooling metadata
}
```

### schema_version

**Purpose:** Track breaking changes to schema structure itself.

**Format:** Semantic versioning (x.x.x)
- **Major:** Breaking changes (field removed/renamed, structure changed)
- **Minor:** New features (new fields added, backward compatible)
- **Patch:** Bug fixes (validation rules, documentation)

**Usage:**
- Resolution engine checks this to ensure compatibility
- UI generator adapts based on version
- Migration tools use this to upgrade configs

---

## Release Catalog Section

**Purpose:** Define what container images, integrations, and capabilities are available in this versioned release.

### release.version

The version tag for this release (e.g., "v1.0.0").

**Key principle:** Each release is immutable. To update container versions, create a new release (v1.1.0).

### release.services

**Structure:**
```json
{
  "service_id": {
    "name": "Human-readable name",
    "description": "What this does",
    "version": "0.6.34",              // Container version (NO :latest)
    "image": "ghcr.io/org/image",     // Registry path WITHOUT tag
    "port": 8080,                     // Internal port (EXCEPTION to minimal principle)
    "dependencies": {
      "required": ["postgres", "redis"],
      "optional": {
        "rag": ["qdrant"]             // If user enables RAG, add qdrant
      }
    },
    "enabled_by": [                   // Declarative auto-enablement
      "topology.features.rag == true && topology.providers.vector_db == 'qdrant'"
    ],
    "template_files": ["container", "volume", "env"],
    "notes": "Release notes"
  }
}
```

**Design decisions:**

1. **version and image are separate fields**
   - `version`: Semantic version for tracking (0.6.34)
   - `image`: Registry path without tag (ghcr.io/open-webui/open-webui)
   - Templates combine them: `Image={{ image }}:{{ version }}`

2. **port is EXCEPTION to minimal principle**
   - Ports needed for service discovery (healthchecks, inter-service communication)
   - Templates use this for `PublishPort=` directives

3. **enabled_by is declarative**
   - Resolution engine evaluates these expressions
   - Computes full list of enabled services before template rendering
   - Templates only see final enabled services list

4. **optional dependencies keyed by feature**
   - If user enables `rag` feature, automatically add `qdrant` dependency
   - Resolution engine handles cascade

### release.integrations

**Purpose:** Third-party external services (no containers deployed).

**Structure:**
```json
{
  "tavily": {
    "name": "Tavily Search",
    "type": "web_search",
    "requires_api_key": true,
    "api_endpoint": "https://api.tavily.com",
    "provides_features": ["web_search"],
    "provider_value": "tavily"
  }
}
```

**Usage:**
- User installs integration via UI
- UI prompts for API key
- Resolution engine sets environment variables
- No containers deployed

---

## Topology Section

**Purpose:** Define the JSON Schema that validates user-config.json AND provides metadata for RJSF UI generation.

**Dual purpose:**
1. **JSON Schema validation:** Standard JSON Schema v7 validation rules
2. **RJSF UI generation:** `x-*` extensions control UI rendering

### topology.network

**Simple infrastructure config:**
```json
{
  "name": "llm",           // Network name
  "subnet": "10.89.0.0/24" // Optional, expert-level
}
```

**Generated template usage:**
```nunjucks
Network={{ network.name }}.network
```

### topology.installed

**The "marketplace" model.**

Users don't configure 370+ variables. They **install** resources:

```json
{
  "services": ["openwebui", "litellm"],
  "models": [
    {"source": "cloud", "id": "claude-sonnet-4-5"},
    {"source": "local", "id": "qwen3-14b"}
  ],
  "integrations": ["tavily"]
}
```

**Model references:**
- Points to files in `leger-labs/model-store` repo
- `source`: "cloud" or "local" (directory in model-store)
- `id`: Filename without .json extension
- UI queries model-store API to show available models
- User clicks "Add Model" → added to this list

**Key insight:** Models are orthogonal to schema versioning. Model-store updates continuously, schema releases are versioned.

### topology.features

**The 15 boolean feature toggles.**

Each feature:
- Has descriptive title
- Has `x-rationale` explaining when to enable
- Has `x-env-var` mapping to environment variable
- Has `x-category` for UI grouping
- Has `x-display-order` for sorting

**Example:**
```json
{
  "rag": {
    "type": "boolean",
    "title": "RAG (Retrieval-Augmented Generation)",
    "default": false,
    "x-category": "Features",
    "x-display-order": 100,
    "x-rationale": "Enable semantic search over documents",
    "x-env-var": "ENABLE_RAG"
  }
}
```

**Resolution engine behavior:**
- Reads `features.rag: true`
- Sets `ENABLE_RAG=true` in environment
- Reveals `providers.vector_db` field (via `x-depends-on`)
- Evaluates services' `enabled_by` expressions

### topology.providers

**The 13 enum provider selections.**

Each provider field:
- Is an enum (specific choices)
- Has `x-depends-on` (only appears if feature enabled)
- Has `x-affects-services` (which service gets enabled)
- Has `x-provider-fields` (additional fields for each choice)

**Example:**
```json
{
  "vector_db": {
    "type": "string",
    "enum": ["pgvector", "qdrant", "chroma"],
    "default": "pgvector",
    "x-depends-on": {
      "features.rag": true
    },
    "x-affects-services": {
      "pgvector": null,      // No service needed
      "qdrant": "qdrant",    // Enable qdrant service
      "chroma": "chroma"     // Enable chroma service
    },
    "x-provider-fields": {
      "qdrant": ["qdrant_url", "qdrant_api_key"],
      "chroma": ["chroma_url"]
    },
    "x-env-var": "VECTOR_DB"
  }
}
```

**Progressive disclosure cascade:**
1. User enables `features.rag: true`
2. Field `providers.vector_db` becomes visible
3. User selects `vector_db: "qdrant"`
4. Fields `qdrant_url` and `qdrant_api_key` appear (from `x-provider-fields`)
5. Service `qdrant` auto-added to enabled services
6. Template `qdrant.container.njk` gets rendered

### topology.advanced

**The 1 advanced overrides object.**

Optional tuning parameters. Only populated if user changes from defaults.

**Design principle:** Most users never touch this section. Expert mode reveals these fields.

### topology.provider_config

**Provider-specific configuration fields.**

These fields appear/disappear based on `x-provider-fields` metadata.

**Example flow:**
1. User selects `providers.web_search_engine: "tavily"`
2. Field `provider_config.tavily_api_key` appears
3. User enters API key
4. Resolution engine sets `TAVILY_API_KEY=<value>`

**Sensitive fields:**
- Have `x-sensitive: true`
- UI masks input
- Values never logged
- Stored in external secret store

### topology.service_overrides

**Expert-level per-service tweaks.**

Allows overriding:
- Published ports
- Bind addresses
- Container images
- Additional environment variables

**Usage:** Power users who need non-standard configurations.

---

## The 29 Decision Variables

**Summary table:**

| Variable | Type | Category | Purpose |
|----------|------|----------|---------|
| `features.rag` | boolean | Features | Enable RAG |
| `features.web_search` | boolean | Features | Enable web search |
| `features.image_generation` | boolean | Features | Enable image generation |
| `features.speech_to_text` | boolean | Features | Enable STT |
| `features.text_to_speech` | boolean | Features | Enable TTS |
| `features.code_execution` | boolean | Features | Enable code execution |
| `features.code_interpreter` | boolean | Features | Enable code interpreter |
| `features.google_drive` | boolean | Features | Enable Google Drive |
| `features.onedrive` | boolean | Features | Enable OneDrive |
| `features.oauth_signup` | boolean | Security | Enable OAuth |
| `features.ldap` | boolean | Security | Enable LDAP |
| `features.title_generation` | boolean | AI Assistance | Enable title generation |
| `features.autocomplete_generation` | boolean | AI Assistance | Enable autocomplete |
| `features.tags_generation` | boolean | AI Assistance | Enable tags |
| `features.websocket_support` | boolean | Advanced | Enable WebSocket |
| `providers.vector_db` | enum | Providers | Vector database choice |
| `providers.rag_embedding` | enum | Providers | Embedding model |
| `providers.content_extraction` | enum | Providers | Document parser |
| `providers.text_splitter` | enum | Providers | Text splitting algorithm |
| `providers.web_search_engine` | enum | Providers | Search engine |
| `providers.web_loader` | enum | Providers | Web page loader |
| `providers.image_engine` | enum | Providers | Image generation |
| `providers.stt_engine` | enum | Providers | Speech-to-text |
| `providers.tts_engine` | enum | Providers | Text-to-speech |
| `providers.code_execution_engine` | enum | Providers | Code execution |
| `providers.code_interpreter_engine` | enum | Providers | Code interpreter |
| `providers.storage_provider` | enum | Providers | External storage |
| `providers.auth_provider` | enum | Security | Authentication |
| `advanced.*` | object | Advanced | Tuning parameters |

**These 29 variables expand to 370+ OpenWebUI environment variables** via the resolution engine.

---

## Metadata Extensions

All `x-*` fields are custom extensions for UI generation and tooling.

### x-category

**Purpose:** Group fields in UI sidebar navigation.

**Values:** "Infrastructure", "Services", "Features", "Providers", "Security", "AI Assistance", "Advanced"

**UI behavior:** Fields with same category appear in same section.

### x-display-order

**Purpose:** Sort order within category.

**Values:** Integer (lower = appears first)

**Example:**
- `x-display-order: 100` → RAG feature
- `x-display-order: 101` → Web Search feature
- `x-display-order: 102` → Image Generation feature

### x-depends-on

**Purpose:** Conditional field visibility based on other field values.

**Format:** Object with field paths and expected values.

**Example:**
```json
{
  "x-depends-on": {
    "features.rag": true,
    "providers.vector_db": "qdrant"
  }
}
```

**Behavior:** Field only appears if ALL conditions are true (AND logic).

**This is the ONLY visibility mechanism.** No "expert mode" or "advanced mode" toggles.

### x-affects-services

**Purpose:** Map provider values to services.

**Format:** Object mapping enum values to service IDs.

**Example:**
```json
{
  "x-affects-services": {
    "pgvector": null,      // No service
    "qdrant": "qdrant",    // Enable qdrant
    "chroma": "chroma"     // Enable chroma
  }
}
```

**Usage:** Resolution engine adds/removes services based on selection.

### x-provider-fields

**Purpose:** Define which fields appear for each provider choice.

**Format:** Object mapping enum values to array of field names.

**Example:**
```json
{
  "x-provider-fields": {
    "qdrant": ["qdrant_url", "qdrant_api_key"],
    "chroma": ["chroma_url"],
    "pgvector": []
  }
}
```

**Usage:** UI shows/hides fields based on selection.

### x-env-var

**Purpose:** Name of environment variable this field generates.

**Format:** String (usually SCREAMING_SNAKE_CASE)

**Example:**
```json
{
  "x-env-var": "ENABLE_RAG"
}
```

**Usage:** Resolution engine generates: `ENABLE_RAG=true`

### x-rationale

**Purpose:** Help text explaining when/why to change this setting.

**Format:** String (shown as tooltip or help text in UI)

**Example:**
```json
{
  "x-rationale": "Enable semantic search over documents using vector databases"
}
```

### x-sensitive

**Purpose:** Mark field as containing secrets.

**Format:** Boolean

**Behavior:**
- UI masks input (password field)
- Value stored in external secret store
- Never logged or displayed

---

## Design Rationale

### Why Nested Structure?

**Decision:** User config is nested (features.rag, providers.vector_db)

**Rationale:**
1. **Clarity:** Obvious categorization
2. **Template access:** `{{ features.rag }}` is readable
3. **Validation:** Easier to validate sections
4. **UI generation:** Natural sidebar navigation

### Why Declarative enabled_by?

**Decision:** Services have `enabled_by` array in schema, not imperative checks in templates.

**Rationale:**
1. **Single source of truth:** Logic in schema, not scattered across templates
2. **Resolution before rendering:** Engine computes enabled services once
3. **Template simplicity:** Templates don't need complex conditionals
4. **Debuggability:** Can inspect enabled services list

**Alternative considered:** Imperative checks in templates
```nunjucks
{% if features.rag and providers.vector_db == "qdrant" %}
  {# render qdrant #}
{% endif %}
```

**Why rejected:** Logic duplication, harder to debug, templates become complex.

### Why Port in Schema?

**Decision:** Include `port` field in release.services despite "minimal schema" principle.

**Rationale:**
1. **Service discovery:** Healthchecks need port numbers
2. **Inter-service communication:** Services reference each other by port
3. **Template rendering:** `PublishPort=` directives need port
4. **Not user-configurable:** This is infrastructure metadata, not user decision

**Alternative considered:** Hardcode ports in templates.

**Why rejected:** Port changes require template updates, not just schema updates.

### Why Separate version and image?

**Decision:** 
```json
{
  "version": "0.6.34",
  "image": "ghcr.io/open-webui/open-webui"
}
```

**Rationale:**
1. **Semantic tracking:** Version is semantic (0.6.34), image is technical
2. **Override flexibility:** User can override version without changing registry
3. **Template clarity:** `Image={{ image }}:{{ version }}` is explicit
4. **Upgrade paths:** Can update version field, keep same image path

### Why Single Schema File?

**Decision:** All metadata in schema.json (not separate ui-schema.json).

**Rationale:**
1. **Single source of truth:** One file to version and validate
2. **Atomic updates:** Can't have schema/ui-schema mismatch
3. **Simpler versioning:** One version number for everything
4. **JSON Schema compatibility:** `x-*` extensions are standard practice

**Alternative considered:** Separate ui-schema.json for RJSF metadata.

**Why rejected:** Synchronization issues, versioning complexity.

### Why Model References Not Definitions?

**Decision:** Models section just references model-store files.

**Rationale:**
1. **Orthogonal concerns:** Model catalog updates independently of schema releases
2. **Avoid duplication:** Model-store is authoritative source
3. **Rapid updates:** AI models release frequently, schema should be stable
4. **Size:** Hundreds of models would bloat schema

**How it works:**
- UI queries model-store API: `https://api.leger.dev/models/cloud/claude-sonnet-4-5.json`
- User picks model from catalog
- User config stores reference: `{"source": "cloud", "id": "claude-sonnet-4-5"}`
- Resolution engine fetches model details when generating manifest

---

## Next Steps

### For Schema Authors

1. Fill in all services in `release.services`
2. Define all integrations in `release.integrations`
3. Complete all provider fields in `topology.provider_config`
4. Document environment variable mappings

### For UI Developers

1. Implement RJSF form generator from schema
2. Handle `x-depends-on` for conditional visibility
3. Implement `x-provider-fields` dynamic field rendering
4. Query model-store API for model catalog
5. Validate user input against schema

### For Resolution Engine Developers

1. Implement `enabled_by` expression evaluator
2. Build dependency graph resolver
3. Create environment variable expansion function
4. Handle `x-affects-services` service enablement
5. Generate manifest.json from user-config.json + schema.json

### For Template Authors

1. Use service definitions from release catalog
2. Access user config via nested paths (features.rag, providers.vector_db)
3. Assume enabled_services list is pre-computed
4. Generate env vars from x-env-var mappings
5. Use macros for common patterns

---

## Validation Rules

### Schema-Level

- All service IDs in `enabled_by` must exist
- All service IDs in `x-affects-services` must exist
- All field names in `x-provider-fields` must exist in `provider_config`
- All `x-depends-on` paths must resolve to valid fields
- Semantic versions must match pattern: `\d+\.\d+\.\d+`

### User-Config-Level

- Must validate against `topology` JSON Schema
- All installed services must exist in `release.services`
- All model references must exist in model-store
- All integrations must exist in `release.integrations`
- Required provider fields must have values

### Template-Level

- All referenced services must be in enabled_services list
- All referenced environment variables must be generated
- All volume names must follow convention: `servicename.volume`
- All ports must be unique across services

---

## Appendix: Complete x-* Extension Reference

| Extension | Type | Purpose |
|-----------|------|---------|
| `x-category` | string | UI grouping |
| `x-display-order` | integer | Sort order |
| `x-depends-on` | object | Conditional visibility (ONLY mechanism) |
| `x-affects-services` | object | Service enablement map |
| `x-provider-fields` | object | Dynamic field mapping |
| `x-env-var` | string | Environment variable name |
| `x-rationale` | string | Help text |
| `x-sensitive` | boolean | Secret field marker |
| `x-metadata` | object | Tooling metadata |

---

## Appendix: User-Config.json Example Structure

```json
{
  "schema_version": "1.0.0",
  "release_version": "v1.0.0",
  
  "network": {
    "name": "llm",
    "subnet": "10.89.0.0/24"
  },
  
  "installed": {
    "services": ["openwebui", "litellm"],
    "models": [
      {"source": "cloud", "id": "claude-sonnet-4-5"},
      {"source": "local", "id": "qwen3-14b"}
    ],
    "integrations": []
  },
  
  "features": {
    "rag": true,
    "web_search": false,
    "image_generation": false,
    "speech_to_text": false,
    "text_to_speech": false,
    "code_execution": true,
    "code_interpreter": false,
    "google_drive": false,
    "onedrive": false,
    "oauth_signup": false,
    "ldap": false,
    "title_generation": true,
    "autocomplete_generation": true,
    "tags_generation": true,
    "websocket_support": true
  },
  
  "providers": {
    "vector_db": "qdrant",
    "rag_embedding": "openai",
    "content_extraction": "tika",
    "text_splitter": "recursive",
    "web_search_engine": "searxng",
    "web_loader": "requests",
    "image_engine": "openai",
    "stt_engine": "openai",
    "tts_engine": "openai",
    "code_execution_engine": "jupyter",
    "code_interpreter_engine": "jupyter",
    "storage_provider": "",
    "auth_provider": "local"
  },
  
  "provider_config": {
    "qdrant_url": "http://qdrant:6333",
    "qdrant_api_key": ""
  },
  
  "advanced": {},
  
  "service_overrides": {}
}
```

This represents the 29 decisions + minimal provider config.

Resolution engine expands this into 370+ environment variables for OpenWebUI.
