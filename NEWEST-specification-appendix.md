# Schema Architecture - Final Specification

**Version:** 0.0.1  
**Date:** 2025-10-30  
**Status:** Ready for Implementation Handoff

---

## Critical Correction: Data Flow

### WRONG Understanding (What I Proposed)

```
schema.json (with x-env-var)
    ↓
user-config.json
    ↓
Resolution engine reads x-env-var
    ↓
Generates environment variables
    ↓
Templates receive env vars
```

**Problem:** Schema tries to dictate environment variable names. This is backwards.

---

### CORRECT Understanding (What Actually Happens)

```
schema.json (validation + cascade logic only)
    ↓
user-config.json (the 29 decisions)
    ↓
Templates read user-config.json directly
    ↓
Templates decide what env vars to generate
    ↓
Output: .container, .env, .yaml files
```

**Key insight:** Templates KNOW what they need. Schema doesn't tell them.

---

## What schema.json Actually Does

### Purpose 1: Validate user-config.json Structure

Ensure user input is valid:
- Type checking (boolean, string, enum)
- Required fields
- Value constraints (enums, patterns, ranges)
- Structure validation

### Purpose 2: Provide Default Infrastructure Configuration

Define service infrastructure with sensible defaults:
- Container ports (internal and published)
- Bind addresses
- Service names and hostnames
- Volume mount points
- Network configuration

All infrastructure can be overridden by user; defaults ensure working system out-of-box.

### Purpose 3: Generate RJSF Form

Provide metadata for UI generation:
- Field titles and descriptions
- Input types (inferred from JSON Schema types)
- Default values
- Validation rules

### Purpose 4: Define Cascade Logic

Business rules for progressive disclosure:
- `x-depends-on` - When fields become visible
- `x-affects-services` - Which services to enable
- `x-provider-fields` - Dynamic field mapping

### Purpose 5: Document the Contract

Communicate to template authors:
- What paths are available in user-config.json
- What the structure looks like
- What values are valid

---

## What schema.json Does NOT Do

❌ **Map to environment variables** - Templates decide this  
❌ **Define service configurations** - Templates handle this  
❌ **Store container versions** - Hardcoded in templates  
❌ **Generate output files** - That's the renderer's job  
❌ **Define infrastructure topology** - That's separate data  

---

## Minimal x-* Extensions Required

Based on corrected understanding, only **3 extensions** are needed:

### 1. `x-depends-on` (Progressive Disclosure)

**Purpose:** Control field visibility based on other field values

**Used by:** UI generator

```json
{
  "providers.vector_db": {
    "x-depends-on": {
      "features.rag": true
    }
  }
}
```

**Behavior:** Field only appears when ALL conditions are true (AND logic)

---

### 2. `x-affects-services` (Service Enablement)

**Purpose:** Map user choices to container services that need to run

**Used by:** Resolution engine (pre-rendering)

```json
{
  "providers.vector_db": {
    "x-affects-services": {
      "pgvector": [],
      "qdrant": ["qdrant"],
      "chroma": []
    }
  }
}
```

**Behavior:** When user selects value, add listed services to enabled_services array

---

### 3. `x-provider-fields` (Dynamic Field Groups)

**Purpose:** Define which config fields appear per provider selection

**Used by:** UI generator

```json
{
  "providers.vector_db": {
    "x-provider-fields": {
      "pgvector": [],
      "qdrant": ["qdrant_url", "qdrant_api_key"],
      "chroma": []
    }
  }
}
```

**Behavior:** Show specified fields when provider is selected

---

## Removed Extensions

### ❌ x-env-var

**Why removed:** Templates decide environment variable names, not schema

**Before:**
```json
{
  "rag": {
    "x-env-var": "ENABLE_RAG"  // ❌ Schema shouldn't know this
  }
}
```

**After (in template):**
```nunjucks
{% if features.rag %}
Environment=ENABLE_RAG=true  {# Template decides name #}
{% endif %}
```

---

## Complete Data Flow

### Step 1: User Interaction

```
User opens webapp
    ↓
UI generator reads schema.json
    ↓
Generates RJSF form with 29 fields
    ↓
User fills form (makes 29 decisions)
    ↓
Form validates against schema.json
    ↓
Saves user-config.json
```

### Step 2: Pre-Rendering Resolution

```
Resolution engine loads:
    - schema.json (for x-affects-services)
    - user-config.json (the decisions)
    ↓
Evaluates x-depends-on (which fields are populated)
    ↓
Evaluates x-affects-services (which containers needed)
    ↓
Computes:
    - enabled_services: ["openwebui", "litellm", "qdrant", ...]
    - startup_order: [dependencies-first topological sort]
    ↓
Augmented user-config.json ready for templates
```

### Step 3: Template Rendering

```
For each enabled service:
    ↓
Nunjucks loads service.container.njk
    ↓
Template accesses user-config.json directly:
    - {{ features.rag }}
    - {{ providers.vector_db }}
    - {{ provider_config.qdrant_url }}
    ↓
Template generates output:
    - openwebui.container (Quadlet file)
    - openwebui.env (Environment variables)
    - litellm.yaml (LiteLLM config)
    - Caddyfile snippets (Reverse proxy)
    ↓
All outputs collected and returned to user
```

**Key point:** Templates are NOT just outputting env vars. They're generating:
- Quadlet .container files
- YAML configurations
- Environment files
- Caddy routes
- Volume definitions
- Network configurations

---

## Scope Beyond OpenWebUI

The 29 decisions cascade into configurations for:

### 1. OpenWebUI (~100 env vars)
- Features enabled/disabled
- Provider selections
- Authentication settings
- UI preferences

### 2. LiteLLM (litellm.yaml)
- Cloud models configured
- Local models enabled
- Database connection
- Redis caching
- Router settings

### 3. Caddy (route snippets)
- Which services get external URLs
- WebSocket support per service
- Subdomain mappings
- TLS configuration

### 4. Service Containers (Quadlets)
- Which containers to start
- Port mappings
- Volume mounts
- Health checks
- Dependencies

### 5. Auxiliary Services
- **Jupyter:** If code_execution enabled
- **Whisper:** If speech_to_text + local engine
- **EdgeTTS:** If text_to_speech + edgetts engine
- **Tika:** If rag + tika extractor
- **SearXNG:** If web_search + searxng engine
- **Qdrant:** If rag + qdrant vector_db
- **PostgreSQL containers:** For services that need them
- **Redis containers:** For services that need them

### 6. Inter-Service Configuration
- Database connection URLs
- Redis connection URLs
- Service discovery endpoints
- Internal network addresses

---

## Example: How RAG Feature Cascades

User enables `features.rag: true`

### Affects UI
```
x-depends-on triggers visibility of:
    - providers.vector_db
    - providers.rag_embedding
    - providers.content_extraction
    - providers.text_splitter
    - advanced.rag_top_k
    - advanced.chunk_size
```

### Affects Services
```
User selects providers.vector_db: "qdrant"
    ↓
x-affects-services: {"qdrant": ["qdrant"]}
    ↓
enabled_services includes "qdrant"
```

### Affects Templates

**openwebui.env.njk:**
```nunjucks
{% if features.rag %}
ENABLE_RAG=true
VECTOR_DB={{ providers.vector_db }}
{% if providers.vector_db == "qdrant" %}
QDRANT_URL={{ provider_config.qdrant_url }}
{% endif %}
RAG_TOP_K={{ advanced.rag_top_k }}
CHUNK_SIZE={{ advanced.chunk_size }}
{% endif %}
```

**qdrant.container.njk** (if service enabled):
```nunjucks
[Unit]
Description=Qdrant Vector Database

[Container]
Image=docker.io/qdrant/qdrant:latest
PublishPort=6333:6333

[Service]
Restart=on-failure
```

**Caddyfile.njk** (if external_subdomain defined):
```nunjucks
{% if "qdrant" in enabled_services %}
https://qdrant.{{ tailscale.full_hostname }} {
    reverse_proxy qdrant:6333
}
{% endif %}
```

---

## Template Contract

What templates can expect from user-config.json:

### Structure
```
network.name
network.subnet

infrastructure.{service_name}.port
infrastructure.{service_name}.published_port
infrastructure.{service_name}.bind_address
(... all infrastructure config with defaults or overrides)

features.{feature_name}  (15 booleans)

providers.{provider_name}  (13 enums)

provider_config.{provider_specific_field}  (dynamic, depends on provider)

secrets.{secret_name}  ({TEMPLATE} pointers, CLI injects actual values)

models.cloud_models[]  (array of model references)
models.local_models[]  (array of model references)

advanced.{tuning_parameter}  (optional overrides)
```

### Additional Context (Computed and Passed at Render Time)

```
enabled_services: ["openwebui", "litellm", "qdrant", ...]
startup_order: ["network", "postgres", "litellm", ...]
resolved_secrets: {openai_api_key: "sk-actual-value", ...}  // CLI injected
model_details: {  // Fetched from model-store
  "claude-sonnet-4-5": {full_model_id: "...", provider: "..."},
  ...
}
tailscale: {full_hostname: "blueprint.tail8dd1.ts.net"}  // External config
```

**Key points:**
- `infrastructure.*` comes from schema.json (defaults or user overrides)
- `secrets.*` contains {TEMPLATE} pointers; CLI resolves to actual values
- `models.*` are references; resolution engine fetches details from model-store
- `enabled_services` computed by resolution engine from x-affects-services
- `tailscale` is external configuration passed at render time

---

## Why This Separation Matters

### Schema.json Knows
✅ What decisions users can make  
✅ What values are valid  
✅ How decisions affect each other  
✅ Which services are needed  
✅ Default infrastructure configuration (ports, addresses, etc.)

### Templates Know
✅ What environment variables to generate  
✅ What file formats to output  
✅ How to configure each service  
✅ What infrastructure details to use (from user-config.json)  
✅ How to structure Quadlet files, YAML configs, etc.

### Resolution Engine Knows
✅ How to compute enabled_services from x-affects-services  
✅ How to resolve model references from model-store  
✅ How to topologically sort startup order  
✅ How to merge defaults with user overrides

### Local CLI Knows
✅ How to inject secret values from local store  
✅ How to replace {TEMPLATE} pointers with actual secrets

### Neither Duplicates the Other
- Schema doesn't dictate env var names → Templates decide
- Templates don't define validation rules → Schema validates
- Schema doesn't store secrets → CLI injects at deployment
- Templates don't fetch models → Resolution engine fetches
- Clean separation of concerns

---

## Decision Point: ui-config.json

**Question:** Do we need a separate ui-config.json for presentation overrides?

### Option 1: Pure Schema
Everything inferred from schema.json structure:
- Widget types from JSON Schema types
- Categories from schema paths
- Display order from schema order

**Pros:** Single file, no duplication  
**Cons:** Less UI flexibility

### Option 2: Schema + UI Config
Minimal schema.json + optional ui-config.json:
- Enum labels (friendly names)
- Section icons
- Custom help text
- Display order overrides

**Pros:** Cleaner schema, flexible UI  
**Cons:** Two files to maintain (but ui-config is tiny)

### Recommendation
Start with **Option 1** (pure schema). Add ui-config.json later only if needed.

Most UI needs can be met through:
- Good field descriptions
- Sensible defaults
- Standard widget inference

---

## Architecture Decisions - Resolved

### 1. Infrastructure Configuration (Ports, Images, etc.)

**Decision:** Defined in schema.json with defaults, can be overridden

**Structure:**
```json
{
  "infrastructure": {
    "type": "object",
    "properties": {
      "openwebui": {
        "type": "object",
        "properties": {
          "port": {
            "type": "integer",
            "default": 8080,
            "description": "Internal container port"
          },
          "published_port": {
            "type": "integer",
            "default": 3000,
            "description": "Port exposed on host"
          },
          "bind_address": {
            "type": "string",
            "default": "127.0.0.1",
            "description": "Host address to bind"
          }
        }
      }
    }
  }
}
```

**Outcome:** All infrastructure config (with defaults or overrides) appears in user-config.json

**Templates access:**
```nunjucks
PublishPort={{ infrastructure.openwebui.published_port }}:{{ infrastructure.openwebui.port }}
```

---

### 2. Secrets Management

**Decision:** Handled by frontend dashboard with {template} pointers

**How it works:**
1. **Frontend:** Dedicated secret management tool in webapp
2. **User-config.json:** Contains template pointers like `{OPENAI_API_KEY}`
3. **Local CLI:** Injects actual secret values at deployment time
4. **Schema:** No secret logic needed - just validates string types

**Example in user-config.json:**
```json
{
  "secrets": {
    "openai_api_key": "{OPENAI_API_KEY}",
    "anthropic_api_key": "{ANTHROPIC_API_KEY}"
  }
}
```

**Local CLI injection:**
```bash
# CLI reads user-config.json
# Finds {TEMPLATE} patterns
# Replaces with actual values from local secret store
# Passes resolved config to templates
```

**Schema responsibility:** None. Just validate that fields are strings.

---

### 3. UI Configuration

**Decision:** No ui-config.json needed - smart RJSF generator infers everything

**Inference rules:**

**Widget types:**
- `type: boolean` → Checkbox
- `type: string` + `enum` → Select dropdown
- `type: integer` → Number input
- `type: string` + `format: uri` → URL input
- `type: string` + description contains "password/key/secret" → Password input

**Categories:**
- Path `network.*` → "Infrastructure" section
- Path `features.*` → "Features" section  
- Path `providers.*` → "Providers" section
- Path `provider_config.*` → "Configuration" section
- Path `infrastructure.*` → "Services" section
- Path `advanced.*` → "Advanced" section

**Display order:**
- Use order in schema.properties (top to bottom)
- Within sections: preserve property order from schema

**Help text:**
- Use field `description` property
- No need for separate x-rationale

**Section behavior:**
- All sections collapsible
- "Advanced" collapsed by default
- Others expanded by default

**Result:** Clean schema.json, smart generator handles all presentation

---

### 4. Model Catalog Integration

**Decision:** Fetched from leger-labs/model-store GitHub repo at webapp build time

**Flow:**

```
New release tagged in leger-schema repo
    ↓
GitHub Actions triggers
    ↓
Cloudflare Worker codebase updates
    ↓
Worker fetches model-store repo
    ↓
Webapp "data entry form" built with:
    - schema.json (validation + cascade)
    - model-store catalog (available models)
    ↓
User selects models from catalog
    ↓
Model IDs saved in user-config.json
```

**Schema structure:**
```json
{
  "models": {
    "type": "object",
    "properties": {
      "cloud_models": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "string"},
            "source": {"type": "string", "const": "cloud"}
          }
        }
      },
      "local_models": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "string"},
            "source": {"type": "string", "const": "local"}
          }
        }
      }
    }
  }
}
```

**User-config.json example:**
```json
{
  "models": {
    "cloud_models": [
      {"id": "claude-sonnet-4-5", "source": "cloud"},
      {"id": "gpt-5", "source": "cloud"}
    ],
    "local_models": [
      {"id": "qwen3-14b", "source": "local"}
    ]
  }
}
```

**Templates fetch details at render time:**
```nunjucks
{% for model in models.cloud_models %}
  {# Resolution engine has already fetched model details from model-store #}
  - model_name: {{ model.id }}
    litellm_params:
      model: {{ model.provider }}/{{ model.full_model_id }}
{% endfor %}
```

**Key points:**
- Model catalog is orthogonal to schema versioning
- Schema only defines structure (array of model references)
- Webapp fetches catalog at build time
- Resolution engine fetches model details at render time

---

## Complete schema.json Structure

### High-Level Organization

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://raw.githubusercontent.com/leger-labs/leger-schema/v0.0.1/schema.json",
  
  "title": "Leger Infrastructure Configuration",
  "description": "Schema for validating and generating infrastructure topology",
  "schema_version": "0.0.1",
  
  "type": "object",
  "required": ["network", "features", "providers", "infrastructure"],
  
  "properties": {
    "network": {...},           // Network configuration
    "infrastructure": {...},    // Service infrastructure (ports, etc.)
    "features": {...},          // 15 feature toggles
    "providers": {...},         // 13 provider selections
    "provider_config": {...},   // Provider-specific config (dynamic)
    "secrets": {...},           // {TEMPLATE} pointers
    "models": {...},            // Model references (from model-store)
    "advanced": {...}           // Optional tuning parameters
  }
}
```

### Section: network

**Purpose:** Basic network configuration

```json
{
  "network": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "default": "llm",
        "description": "Container network name"
      },
      "subnet": {
        "type": "string",
        "default": "10.89.0.0/24",
        "description": "Network CIDR subnet"
      }
    }
  }
}
```

### Section: infrastructure

**Purpose:** Service infrastructure configuration with defaults

```json
{
  "infrastructure": {
    "type": "object",
    "description": "Service infrastructure configuration",
    "properties": {
      "openwebui": {
        "type": "object",
        "properties": {
          "container_name": {
            "type": "string",
            "default": "openwebui"
          },
          "hostname": {
            "type": "string",
            "default": "openwebui"
          },
          "port": {
            "type": "integer",
            "default": 8080,
            "description": "Internal container port"
          },
          "published_port": {
            "type": "integer",
            "default": 3000,
            "description": "Port exposed on host"
          },
          "bind_address": {
            "type": "string",
            "default": "127.0.0.1",
            "description": "Host bind address"
          },
          "external_subdomain": {
            "type": "string",
            "default": "ai",
            "description": "Tailscale subdomain (for Caddy routing)"
          }
        }
      },
      "litellm": {...},
      "qdrant": {...}
      // ... all services
    }
  }
}
```

**Key points:**
- All services defined with sensible defaults
- User can override any value
- Templates access via `{{ infrastructure.openwebui.published_port }}`

### Section: features

**Purpose:** 15 boolean feature toggles

```json
{
  "features": {
    "type": "object",
    "properties": {
      "rag": {
        "type": "boolean",
        "title": "RAG (Retrieval-Augmented Generation)",
        "description": "Enable semantic search over documents",
        "default": false
      },
      "web_search": {
        "type": "boolean",
        "title": "Web Search",
        "description": "Enable LLM web search capability",
        "default": false
      }
      // ... 13 more features
    }
  }
}
```

### Section: providers

**Purpose:** 13 enum provider selections with cascade logic

```json
{
  "providers": {
    "type": "object",
    "properties": {
      "vector_db": {
        "type": "string",
        "title": "Vector Database",
        "description": "Storage for document embeddings",
        "enum": ["pgvector", "qdrant", "chroma"],
        "default": "pgvector",
        
        "x-depends-on": {
          "features.rag": true
        },
        
        "x-affects-services": {
          "pgvector": [],
          "qdrant": ["qdrant"],
          "chroma": []
        },
        
        "x-provider-fields": {
          "qdrant": ["qdrant_url", "qdrant_api_key"]
        }
      }
      // ... 12 more providers
    }
  }
}
```

### Section: provider_config

**Purpose:** Dynamic configuration fields per provider

```json
{
  "provider_config": {
    "type": "object",
    "properties": {
      "qdrant_url": {
        "type": "string",
        "title": "Qdrant URL",
        "default": "http://qdrant:6333",
        "x-depends-on": {
          "providers.vector_db": "qdrant"
        }
      },
      "qdrant_api_key": {
        "type": "string",
        "title": "Qdrant API Key",
        "default": "",
        "x-depends-on": {
          "providers.vector_db": "qdrant"
        }
      }
      // ... all provider-specific fields
    }
  }
}
```

### Section: secrets

**Purpose:** Secret template pointers (CLI injects actual values)

```json
{
  "secrets": {
    "type": "object",
    "description": "Secret template pointers - actual values injected by CLI",
    "properties": {
      "openai_api_key": {
        "type": "string",
        "default": "{OPENAI_API_KEY}",
        "description": "OpenAI API key template pointer"
      },
      "anthropic_api_key": {
        "type": "string",
        "default": "{ANTHROPIC_API_KEY}"
      }
      // ... all secrets as {TEMPLATE} pointers
    }
  }
}
```

**Note:** Frontend secret management tool sets these. CLI resolves at deployment.

### Section: models

**Purpose:** Model references (details fetched from model-store)

```json
{
  "models": {
    "type": "object",
    "properties": {
      "cloud_models": {
        "type": "array",
        "description": "Cloud-based models via API",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "Model ID from model-store"
            },
            "source": {
              "type": "string",
              "const": "cloud"
            }
          }
        },
        "default": []
      },
      "local_models": {
        "type": "array",
        "description": "Locally-run models",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "Model ID from model-store"
            },
            "source": {
              "type": "string",
              "const": "local"
            }
          }
        },
        "default": []
      }
    }
  }
}
```

**Note:** Resolution engine fetches full model definitions from model-store GitHub repo at render time.

### Section: advanced

**Purpose:** Optional performance tuning parameters

```json
{
  "advanced": {
    "type": "object",
    "description": "Optional tuning parameters",
    "properties": {
      "rag_top_k": {
        "type": "integer",
        "default": 5,
        "minimum": 1,
        "maximum": 50,
        "x-depends-on": {
          "features.rag": true
        }
      },
      "chunk_size": {
        "type": "integer",
        "default": 1500,
        "x-depends-on": {
          "features.rag": true
        }
      }
      // ... other tuning parameters
    }
  }
}
```

---

## Summary: Minimal x-* Set

Final recommendation for schema.json extensions:

```json
{
  "x-depends-on": {
    "features.rag": true
  },
  
  "x-affects-services": {
    "qdrant": ["qdrant"]
  },
  
  "x-provider-fields": {
    "qdrant": ["qdrant_url", "qdrant_api_key"]
  }
}
```

**That's it.** Three extensions, all focused on cascade logic and progressive disclosure.

Everything else (widget types, categories, display order) inferred from schema structure.

---

## Next Steps (High-Level Implementation Plan)

### Phase 1: Complete schema.json Definition
1. **Define all 29 decision variables**
   - 15 features (boolean)
   - 13 providers (enum with x-depends-on, x-affects-services, x-provider-fields)
   - 1 advanced (object with optional tuning params)

2. **Define infrastructure section**
   - All services with default ports, hostnames, bind addresses
   - External subdomain mappings for Caddy routing
   - Allow overrides for all values

3. **Define provider_config section**
   - All provider-specific fields
   - Each with appropriate x-depends-on condition

4. **Define secrets section**
   - All required secrets as {TEMPLATE} pointers
   - Clear documentation of what each secret is for

5. **Define models section**
   - Structure for cloud_models array
   - Structure for local_models array

6. **Validate complete schema**
   - All x-depends-on paths resolve
   - All x-affects-services reference valid services
   - All x-provider-fields reference valid fields
   - No circular dependencies

---

### Phase 2: Build Smart RJSF Generator

1. **Widget inference engine**
   - Map JSON Schema types to RJSF widgets
   - Handle special cases (passwords, URLs, etc.)

2. **Category extraction**
   - Parse schema paths to determine sections
   - Generate sidebar navigation

3. **Dependency evaluator**
   - Implement x-depends-on logic (AND conditions)
   - Handle nested dependencies
   - Real-time field visibility updates

4. **Provider field manager**
   - Show/hide fields based on x-provider-fields
   - Handle provider switching

5. **Form builder**
   - Generate complete RJSF form from schema.json
   - Apply all inference rules
   - Handle validation errors

---

### Phase 3: Implement Resolution Engine

1. **Service enablement logic**
   - Read x-affects-services from schema
   - Compute enabled_services array based on user selections
   - Handle service dependencies

2. **Model detail fetcher**
   - Query leger-labs/model-store repo
   - Fetch full model definitions by ID
   - Cache model details

3. **Topological sort**
   - Build dependency graph
   - Compute startup_order array
   - Handle circular dependency detection

4. **Config merger**
   - Merge schema defaults with user overrides
   - Produce complete user-config.json
   - Validate final output

---

### Phase 4: Integrate with Cloudflare Worker

1. **Worker setup**
   - Accept POST requests with user-config.json
   - Load schema.json from release
   - Load model-store catalog

2. **Validation endpoint**
   - Validate user-config.json against schema
   - Return validation errors
   - Handle partial configs (for auto-save)

3. **Resolution endpoint**
   - Run resolution engine
   - Compute enabled_services and startup_order
   - Return augmented config

4. **Rendering endpoint**
   - Load Nunjucks templates
   - Render all templates for enabled services
   - Return generated files

5. **Deployment**
   - GitHub Actions on release tag
   - Update Worker code with new schema version
   - Fetch latest model-store catalog

---

### Phase 5: Template Updates

1. **Verify template contract**
   - Ensure all templates access correct paths
   - Remove any hardcoded values
   - Use infrastructure.* for ports/addresses

2. **Secret handling**
   - Templates should expect resolved secrets (CLI injected)
   - Use {{ secrets.openai_api_key }} not ${OPENAI_API_KEY}

3. **Model rendering**
   - Access model_details for full definitions
   - Render model lists in configs (litellm.yaml, etc.)

4. **Conditional rendering**
   - Check enabled_services array
   - Use feature flags from user-config
   - Handle provider-specific configurations

---

### Phase 6: Local CLI Tool

1. **Secret injection**
   - Read user-config.json
   - Find {TEMPLATE} patterns
   - Replace with actual values from local store

2. **Deployment**
   - Copy resolved configs to systemd directory
   - Generate Quadlet files
   - Reload systemd
   - Start services in startup_order

3. **Secret management**
   - Secure storage of actual secret values
   - Integration with system keyrings
   - Secret rotation support

---

### Phase 7: Frontend Dashboard

1. **Form generation**
   - Use schema.json to build RJSF form
   - Apply smart inference rules
   - Progressive disclosure based on x-depends-on

2. **Model selection UI**
   - Query model-store catalog (fetched at build time)
   - Searchable/filterable model list
   - Add models to config

3. **Secret management**
   - Dedicated secret input interface
   - Masked input fields
   - Store as {TEMPLATE} pointers in config

4. **Validation feedback**
   - Real-time validation against schema
   - Clear error messages
   - Field-level validation indicators

5. **Config export**
   - Download user-config.json
   - Generate deployment command for CLI
   - Instructions for local deployment

---

## Implementation Priority

**Critical Path:**
1. Complete schema.json ← START HERE
2. RJSF generator ← Enables frontend
3. Resolution engine ← Enables rendering
4. Template updates ← Ensures correct output

**Parallel Track:**
1. Local CLI (can develop independently)
2. Frontend dashboard (uses schema.json + RJSF generator)
3. Cloudflare Worker (integrates resolution engine)

---

## Success Criteria

### Schema Complete
- [ ] All 29 variables defined
- [ ] Infrastructure defaults for all services
- [ ] All x-* extensions correct
- [ ] Validates example user-config.json

### RJSF Generator Works
- [ ] Generates form from schema.json
- [ ] Infers widgets correctly
- [ ] Handles x-depends-on
- [ ] Shows/hides provider fields

### Resolution Engine Works
- [ ] Computes enabled_services
- [ ] Fetches model details
- [ ] Topological sort correct
- [ ] Merges defaults with overrides

### Templates Render
- [ ] All enabled services generate files
- [ ] Configs use correct paths from user-config
- [ ] Secrets resolved by CLI
- [ ] Output files valid and deployable

### End-to-End Flow
- [ ] User fills form in webapp
- [ ] Saves valid user-config.json
- [ ] CLI injects secrets
- [ ] Rendering produces working configs
- [ ] Deployment succeeds on local machine

---

**Key Takeaway:** Schema defines the CONTRACT, templates implement the LOGIC. No mixing of concerns.

---

## Final Summary for Next Implementer

### Core Architecture Principles

1. **Single Source of Truth: schema.json**
   - Validates user input structure
   - Defines cascade logic (x-depends-on, x-affects-services, x-provider-fields)
   - Provides infrastructure defaults
   - Generates RJSF UI through smart inference
   - Documents template contract

2. **Data Flows ONE Direction**
   ```
   schema.json → user-config.json → Templates → Output Files
   ```
   Schema never reads from templates. Templates never modify schema.

3. **3 Critical x-* Extensions Only**
   - `x-depends-on` - Field visibility conditions
   - `x-affects-services` - Service enablement mapping
   - `x-provider-fields` - Dynamic field groups
   
   Everything else inferred from standard JSON Schema.

4. **Templates Own Their Logic**
   - Templates decide environment variable names
   - Templates decide configuration structure
   - Templates access user-config.json paths directly
   - Templates are NOT just env var generators

5. **Smart RJSF Generator (No ui-config.json)**
   - Widget types inferred from JSON Schema types
   - Categories inferred from schema paths
   - Display order from schema property order
   - Help text from field descriptions
   - All presentation logic in generator, not schema

6. **Infrastructure in Schema**
   - All ports, hostnames, bind addresses defined in schema
   - Sensible defaults provided
   - User can override any value
   - Final config in user-config.json

7. **Secrets Are Pointers**
   - user-config.json contains {TEMPLATE} pointers
   - Frontend dashboard manages secret mapping
   - Local CLI injects actual values at deployment
   - Schema only validates string types

8. **Models Are References**
   - Schema defines structure (array of {id, source})
   - Webapp fetches catalog from model-store at build time
   - Resolution engine fetches details at render time
   - Model-store is orthogonal to schema versioning

### The 29 Decision Variables

**15 Features (boolean):**
1. rag
2. web_search
3. image_generation
4. speech_to_text
5. text_to_speech
6. code_execution
7. code_interpreter
8. google_drive
9. onedrive
10. oauth_signup
11. ldap
12. title_generation
13. autocomplete_generation
14. tags_generation
15. websocket_support

**13 Providers (enum):**
1. vector_db
2. rag_embedding
3. content_extraction
4. text_splitter
5. web_search_engine
6. web_loader
7. image_engine
8. stt_engine
9. tts_engine
10. code_execution_engine
11. code_interpreter_engine
12. storage_provider
13. auth_provider

**1 Advanced (object):**
- Optional tuning parameters (rag_top_k, chunk_size, etc.)

### What Goes Where

**schema.json contains:**
- Validation rules (types, enums, patterns)
- Infrastructure defaults (ports, addresses)
- Cascade logic (x-* extensions)
- Field metadata (titles, descriptions)
- Secret template definitions
- Model reference structure

**user-config.json contains:**
- The 29 decisions (with defaults or user choices)
- Infrastructure config (defaults or user overrides)
- Secret pointers ({TEMPLATE} format)
- Model references (IDs only)
- Advanced overrides (optional)

**Templates contain:**
- Environment variable name mappings
- Configuration file structures
- Quadlet file definitions
- Service-specific logic
- Conditional rendering rules

**Resolution engine computes:**
- enabled_services (from x-affects-services)
- startup_order (topological sort)
- model_details (from model-store)
- Config merging (defaults + overrides)

**Local CLI handles:**
- Secret injection ({TEMPLATE} → actual values)
- Systemd file deployment
- Service startup orchestration

### Critical Don'ts

❌ **Don't put x-env-var in schema** - Templates decide env var names  
❌ **Don't put container versions in schema** - Hardcoded in templates  
❌ **Don't create ui-config.json** - Smart generator infers everything  
❌ **Don't store actual secrets in user-config** - Use {TEMPLATE} pointers  
❌ **Don't put model definitions in schema** - Reference model-store  
❌ **Don't mix validation and presentation** - Keep schema clean  

### Critical Do's

✅ **Do define infrastructure defaults in schema** - Users need working system  
✅ **Do use minimal x-* extensions** - Only 3 for cascade logic  
✅ **Do make templates read user-config directly** - Clean data flow  
✅ **Do infer UI from schema structure** - Convention over configuration  
✅ **Do validate all x-* references** - Ensure paths exist  
✅ **Do document template contract** - What paths are available  

### Start Here

1. **Read existing templates** - Understand what they need from config
2. **Create schema.json skeleton** - Define structure with 29 variables
3. **Add infrastructure section** - All services with defaults
4. **Test RJSF generation** - Ensure form renders correctly
5. **Implement resolution engine** - Compute enabled_services
6. **Update templates** - Use correct paths from user-config
7. **Build end-to-end flow** - Form → Config → Rendering → Deployment

### Questions? Check These

- **Data flow confused?** → See "Complete Data Flow" section
- **What x-* extensions?** → See "Minimal x-* Extensions Required" section
- **Where does X live?** → See "What Goes Where" section above
- **Template contract unclear?** → See "Template Contract" section
- **Infrastructure defaults?** → See "Architecture Decisions - Resolved" section

---

**This is the final architecture. All decisions made. Ready for implementation.** 🚀
