# NJK Schema Renderer

**Simple, focused Nunjucks renderer for the new `schema.json` user-config format.**

This renderer replaces the outdated `njk-typescript-implementation` and `njk-python-implementation` which expect the old service-centric topology format. The templates in the root directory now use the user-friendly schema format, and this renderer matches that expectation.

## Quick Start

```bash
# Install dependencies
npm install

# Render templates
node render.js <user-config.json> <templates-dir> <output-dir>

# Example
node render.js ../test-configs/user-config.json .. ../test-output
```

## What It Does

1. **Loads** your user configuration (`schema.json` format)
2. **Finds** all `.njk` template files in the schema directory
3. **Renders** each template with the correct context
4. **Outputs** Podman Quadlet files ready for deployment

## User Config Format

This renderer expects the **NEW** schema format:

```json
{
  "infrastructure": {
    "network": { "name": "llm", "subnet": "10.89.0.0/24" },
    "services": {
      "openwebui": { "container_name": "openwebui", ... },
      "litellm": { "container_name": "litellm", ... }
    }
  },
  "features": {
    "rag": true,
    "web_search": true,
    "code_execution": false
  },
  "providers": {
    "vector_db": "qdrant",
    "web_search_engine": "searxng"
  },
  "provider_config": {
    "qdrant_url": "http://qdrant:6333",
    "searxng_query_url": "http://searxng:8080/search?q=<query>"
  },
  "secrets": {
    "openwebui_secret_key": "{OPENWEBUI_SECRET_KEY}",
    "litellm_master_key": "{LITELLM_MASTER_KEY}"
  }
}
```

## Template Context

Templates have access to:

```javascript
{
  infrastructure: {
    network: { name, subnet, ... },
    services: { openwebui: {...}, litellm: {...}, ... }
  },
  features: { rag, web_search, ... },
  providers: { vector_db, web_search_engine, ... },
  provider_config: { qdrant_url, ... },
  secrets: { openwebui_secret_key, ... },

  // Service-specific contexts for backward compatibility
  openwebui: { providers: {...}, features: {...} },
  litellm: { providers: {...}, features: {...} },
  // ... etc
}
```

## Generated Output

The renderer generates:
- **Container files** (`.container`) - Podman Quadlet container definitions
- **Network files** (`.network`) - Podman network definitions
- **Volume files** (`.volume`) - Podman volume definitions
- **Environment files** (`.env`) - Service environment variables
- **Config files** (`.yml`, `.conf`, etc.) - Service-specific configurations

### Naming Convention

Output files use flattened directory structure:
```
openwebui/openwebui.container.njk  →  openwebui.openwebui.container
litellm/postgres/litellm-postgres.container.njk  →  litellm.postgres.litellm-postgres.container
```

## Test Results

**Tested**: 2025-11-01
**Success Rate**: 95% (37/39 templates)
**See**: [TEST-REPORT.md](./TEST-REPORT.md) for full results

### What Works ✅
- Container definitions with dependencies
- Network configuration
- Volume mounts with SELinux labels
- Port publishing with bind addresses
- Environment variable generation
- Health checks (HTTP and TCP)
- Conditional rendering based on features/providers
- Caddy reverse proxy configs

### Known Issues ⚠️
1. **Release catalog loading** - Relative paths in subdirectories fail
   - Impact: Empty image names/versions
   - Fix: Update templates to use global `catalog` variable

2. **Two template failures**:
   - `litellm/litellm.yaml.njk` - needs null checks
   - `mcp-context-forge/mcp-context-forge.container.njk` - assumes service present

## Features

### Custom Filters
- `fromJson` - Parse JSON strings in templates

### Global Functions
- `readFile(path)` - Read files relative to templates directory

### Template Discovery
- Automatically finds all `.njk` files in service directories
- Excludes `macros.njk` and `base-*.njk` (utility files)
- Scans recursively through subdirectories

## Comparison with Old Implementations

| Feature | njk-newest | njk-typescript-implementation | njk-python-implementation |
|---------|------------|------------------------------|---------------------------|
| Works with current templates | ✅ YES | ❌ NO | ❌ NO |
| Supports schema.json format | ✅ YES | ❌ NO | ❌ NO |
| Dependencies | Just nunjucks | Many TypeScript deps | Python + jsonschema |
| Lines of code | 233 | ~2000+ | ~1500+ |
| Maintainability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

## Why Not Fix Old Implementations?

The old implementations expect a fundamentally different data structure (service-centric topology) that doesn't match how we want users to configure their deployments. The schema.json approach is:
- **More intuitive** - users think in terms of features and providers, not service topology
- **Less error-prone** - reduced duplication, centralized config
- **Better for UX** - can generate forms directly from schema
- **Easier to validate** - JSON Schema validation built-in

Rather than retrofit old implementations, this clean rewrite embraces the new format.

## Roadmap

### Immediate (P0)
- [ ] Fix release catalog loading in templates
- [ ] Add defensive null checks to failing templates
- [ ] Test with multiple configurations

### Soon (P1)
- [ ] Auto-discover service directories (remove hardcoded list)
- [ ] Add config validation using Ajv + schema.json
- [ ] Generate manifest.json for deployments
- [ ] Add actual Podman deployment test

### Later (P2)
- [ ] Colored output for better UX
- [ ] Progress bar for large template sets
- [ ] `--dry-run` mode
- [ ] `--diff` mode vs. existing deployment
- [ ] Watch mode for development

## Integration with Cloudflare Workers

Once templates are finalized, the rendering logic can be adapted for Cloudflare Workers:

```javascript
// In Workers environment
import nunjucks from 'nunjucks';

export default {
  async fetch(request, env) {
    // 1. Parse user config from request
    const userConfig = await request.json();

    // 2. Load templates from R2
    const templates = await env.TEMPLATES_BUCKET.list();

    // 3. Render with nunjucks
    const rendered = renderTemplates(userConfig, templates);

    // 4. Store in user's R2 bucket
    await storeRenderedFiles(rendered, userId);

    return new Response('Templates generated!');
  }
}
```

The core rendering logic (context preparation, template discovery) can be reused.

## Dependencies

- **nunjucks** (^3.2.4) - Template engine

That's it! No bloated dependencies, no complex build systems.

## Development

```bash
# Install
npm install

# Run with debug output
DEBUG=1 node render.js config.json . output/

# Test different configs
node render.js test-configs/minimal.json . output-minimal/
node render.js test-configs/full.json . output-full/
node render.js test-configs/custom.json . output-custom/
```

## Files

- `package.json` - Dependencies
- `render.js` - Main renderer (233 lines)
- `README.md` - This file
- `TEST-REPORT.md` - Detailed test results and findings

## Contributing

When improving this renderer:

1. **Keep it simple** - The goal is rendering templates, not building a framework
2. **Match template expectations** - Templates define the API, renderer implements it
3. **Validate thoroughly** - Test with various config combinations
4. **Document changes** - Update this README and TEST-REPORT.md

## Questions?

See [TEST-REPORT.md](./TEST-REPORT.md) for:
- Detailed test results
- Template quality assessment
- Identified improvements
- Integration recommendations

---

**Status**: ✅ Ready for production use after catalog fix

**Last Updated**: 2025-11-01
**Maintainer**: Leger Labs
**License**: Same as parent project
