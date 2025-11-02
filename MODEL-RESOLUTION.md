# Model Resolution Architecture

## Overview

The model resolution system separates model metadata (stored in `model-store/`) from user configuration. Users select models by ID, and the render engine automatically fetches and resolves full model definitions before rendering templates.

## Benefits

- **Users**: Simpler config (just IDs), always up-to-date model definitions
- **Templates**: Cleaner code, consistent model objects, automatic Secret= directives
- **System**: Rolling model updates independent of schema versioning

## User Configuration Format

### Before (Old Format)
```json
{
  "litellm": {
    "models": [
      {
        "name": "gpt-5",
        "provider": "openai",
        "litellm_model_name": "openai/gpt-5-2025-08-07",
        "context_window": 400000,
        "requires_api_key": "OPENAI_API_KEY"
      }
    ]
  }
}
```

### After (New Format)
```json
{
  "models": {
    "cloud": ["gpt-5", "claude-sonnet-4-5"],
    "local": ["qwen3-4b"]
  }
}
```

Everything else is auto-resolved from the model-store!

## Architecture

### Data Flow

1. **Model Store** (`/home/user/model-store/`) - Curated model definitions
   - `cloud/` - Cloud provider models (OpenAI, Anthropic, Google, etc.)
   - `local/` - Local inference models (via llama-swap/ramalama)

2. **User Config** - Simple model ID selections
   - No provider details
   - No API key configuration
   - No context window settings

3. **Render Engine** (`tools/njk-newest/render.js`) - Resolution and transformation
   - Fetches model definitions from model-store
   - Transforms to LiteLLM format (cloud models)
   - Transforms to llama-swap format (local models)
   - Detects required secrets (for manifest only)
   - Generates secrets manifest

4. **Templates** - Clean, provider-agnostic
   - Iterate over resolved models
   - Auto-generate Secret= directives based on providers used
   - No conditional provider logic needed

5. **Output** - Ready for deployment
   - Quadlet files with Secret= directives
   - `required-secrets.json` manifest

## Secrets Management (Orthogonal Flow)

The model resolution system NEVER touches actual secret values. It only:

1. Detects which providers are used
2. Generates Secret= directive names in quadlets
3. Creates a manifest of required secrets for user reference

Actual secrets are managed separately via:

```bash
# Stage 1: User stores secrets (via web UI or CLI)
leger secrets set openai_api_key sk-proj-...

# Stage 2: User syncs to local daemon
leger secrets sync  # Pulls from Cloudflare KV → stores in legerd

# Stage 3: User deploys
leger deploy install  # Reads Secret= directives → fetches from legerd → creates Podman secrets

# Stage 4: Podman injects at runtime
systemctl --user start litellm  # Podman reads Secret= → injects from secret store
```

## Model Store Structure

### Cloud Model Example (`cloud/gpt-5.json`)

```json
{
  "id": "gpt-5",
  "name": "GPT-5",
  "provider": "openai",
  "litellm_model_name": "openai/gpt-5-2025-08-07",
  "context_window": 400000,
  "max_output": 128000,
  "requires_api_key": "OPENAI_API_KEY",
  "description": "OpenAI's flagship model",
  "capabilities": ["chat", "reasoning", "multimodal"],
  "enabled": true
}
```

### Local Model Example (`local/qwen3-4b.json`)

```json
{
  "id": "qwen3-4b",
  "name": "Qwen3 4B",
  "model_uri": "huggingface://Qwen/Qwen3-4B-GGUF/qwen3-4b-q4_k_m.gguf",
  "quantization": "Q4_K_M",
  "ram_required_gb": 3,
  "context_window": 32768,
  "group": "task",
  "description": "Balanced task model",
  "ctx_size": 8192,
  "ttl": 0,
  "vulkan_driver": "RADV",
  "flash_attn": true,
  "enabled": true
}
```

## Render Engine Functions

### Core Functions

- `fetchModelDefinition(modelId, type, modelStorePath)` - Fetch and validate model definition
- `resolveModels(userConfig, modelStorePath)` - Resolve all model IDs to full definitions
- `transformCloudModelsForLiteLLM(cloudModels)` - Transform to LiteLLM format
- `transformLocalModelsForLlamaSwap(localModels)` - Transform to llama-swap format
- `detectRequiredSecrets(cloudModels)` - Detect which secrets are needed (names only)
- `generateSecretsManifest(requiredSecrets, outputDir)` - Generate manifest for user reference
- `buildContextWithModels(userConfig, resolvedModels, releaseCatalog)` - Build enriched template context

## Template Updates

### LiteLLM Config (`litellm.yaml.njk`)

```nunjucks
{% for model in litellm.models %}
  # {{ model.name }}{% if model.description %} - {{ model.description }}{% endif %}
  - model_name: {{ model.name }}
    litellm_params:
      model: {{ model.litellm_model_name }}
      api_key: os.environ/{{ model.requires_api_key }}
{% if model.max_output %}      max_tokens: {{ model.max_output }}
{% endif %}      stream: true
{% endfor %}
```

### LiteLLM Container (`litellm.container.njk`)

Auto-generated Secret= directives:

```nunjucks
{% set has_openai = false %}
{% set has_anthropic = false %}
{% for model in litellm.models %}
  {% if model.provider == 'openai' %}{% set has_openai = true %}{% endif %}
  {% if model.provider == 'anthropic' %}{% set has_anthropic = true %}{% endif %}
{% endfor %}

{% if has_openai %}
Secret=openai_api_key,type=env,target=OPENAI_API_KEY
{% endif %}
{% if has_anthropic %}
Secret=anthropic_api_key,type=env,target=ANTHROPIC_API_KEY
{% endif %}
```

## Testing

### Test Configurations

1. **Minimal** (`test-configs/minimal-config.json`) - 1 cloud, 1 local model
2. **Multi-Provider** (`test-configs/multi-provider-config.json`) - Multiple cloud providers
3. **Local-Only** (`test-configs/local-only-config.json`) - No cloud models

### Running Tests

```bash
# Minimal test
node tools/njk-newest/render.js test-configs/minimal-config.json releases/v0.0.1/templates test-output/minimal

# Multi-provider test
node tools/njk-newest/render.js test-configs/multi-provider-config.json releases/v0.0.1/templates test-output/multi

# Local-only test
node tools/njk-newest/render.js test-configs/local-only-config.json releases/v0.0.1/templates test-output/local
```

### Validation

```bash
# Check Secret= directives
grep "Secret=" test-output/minimal/services.litellm.litellm.container

# Check secrets manifest
cat test-output/minimal/required-secrets.json

# Check model definitions
head -30 test-output/minimal/services.litellm.litellm.yaml
```

## Output Files

### required-secrets.json

```json
{
  "version": "0.0.1",
  "required_secrets": [
    "openai_api_key",
    "anthropic_api_key"
  ],
  "note": "Run 'leger secrets sync' to sync these secrets from Cloudflare KV to legerd"
}
```

### Generated Quadlets

Quadlet files contain:
- Service definitions
- Secret= directives (names only, not values)
- Environment variables
- Volume mounts
- Network configuration

## Usage

1. User creates config with model IDs only
2. Render engine resolves models from model-store
3. Templates generate quadlets with Secret= directives
4. User downloads bundle with `required-secrets.json`
5. User runs `leger secrets sync` to sync secrets
6. User runs `leger deploy install` to deploy
7. Podman injects secrets at runtime

## Critical Points

✅ **Render engine NEVER touches actual secret values**
✅ **User config has NO secrets section**
✅ **Secrets managed via**: leger CLI → Cloudflare KV → legerd → Podman secrets
✅ **Render engine outputs**: Secret= directives (names only) + manifest
✅ **Model definitions update independently** from user configs

## Success Criteria

✅ Users can specify models by ID only
✅ Render engine resolves models from model-store
✅ Templates use resolved model objects
✅ Secret= directives auto-generated based on providers
✅ required-secrets.json manifest generated
✅ NO actual secret values touched by render engine
✅ Output is Podman-compliant

## File Changes

### Modified Files

- `tools/njk-newest/render.js` - Added model resolution functions
- `releases/v0.0.1/templates/services/litellm/litellm.yaml.njk` - Simplified, uses resolved models
- `releases/v0.0.1/templates/services/litellm/litellm.container.njk` - Auto-generates Secret= directives

### New Files

- `test-configs/minimal-config.json` - Test configuration (1 cloud, 1 local)
- `test-configs/multi-provider-config.json` - Test configuration (multiple providers)
- `test-configs/local-only-config.json` - Test configuration (local only)
- `MODEL-RESOLUTION.md` - This documentation

### External Dependencies

- `/home/user/model-store/` - Cloned from `github.com/leger-labs/model-store`
  - NOTE: Not committed to this repo (separate repository)

## Future Enhancements

- Support for model aliases
- Model deprecation warnings
- Model replacement suggestions
- Automatic model migration
- Provider fallback configuration
- Rate limiting per provider
- Cost tracking per model
