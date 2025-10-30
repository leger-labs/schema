# njk-schema-ts: TypeScript/JavaScript Implementation

**The RIGHT implementation** for your Cloudflare Workers webapp architecture! 🎉

This is the JavaScript/TypeScript implementation that works with your existing `.njk` templates and runs in Cloudflare Workers.

---

## Why This Version?

The Python version (`njk-schema-second/`) was a misunderstanding. **This is what you actually need:**

✅ **JavaScript/TypeScript** - Runs in Cloudflare Workers
✅ **Nunjucks templates** - Renders your existing `.njk` files
✅ **Webapp integration** - User hits "Save", quadlets are generated
✅ **No CLI required** - All tools can be imported as modules

---

## Architecture

```
User edits config in webapp
         ↓
   Hits "Save" button
         ↓
Cloudflare Workers receives topology.json
         ↓
NunjucksRenderer loads .njk templates
         ↓
Renders templates with topology data
         ↓
Returns generated .container files
```

---

## Installation

```bash
npm install
npm run build
```

### Dependencies

- `ajv` - JSON Schema validation
- `nunjucks` - Template rendering
- `typescript` - TypeScript compiler

---

## Tools

### 1. Schema Validator (ajv-based)

Validates topology files against JSON Schema.

**Usage in Cloudflare Worker:**
```typescript
import { SchemaValidator } from './validators/schemaValidator.js';

const validator = new SchemaValidator('path/to/topology-schema.json');
const result = validator.validateTopology(topology);

if (!result.valid) {
  return new Response(JSON.stringify(result.errors), { status: 400 });
}
```

**CLI Usage:**
```bash
npm run validate topology.json
```

---

### 2. Topology Validator

Extended validation rules (circular deps, cross-service refs, etc.)

**Usage in Cloudflare Worker:**
```typescript
import { TopologyValidator } from './validators/topologyValidator.js';

const validator = new TopologyValidator(topology);
const result = validator.validate();

if (!result.valid) {
  // Handle validation errors
}
```

---

### 3. Nunjucks Renderer ⭐ **KEY COMPONENT**

**This is what your webapp needs!** Renders existing `.njk` templates with topology data.

**Usage in Cloudflare Worker:**
```typescript
import { NunjucksRenderer } from './generators/nunjucksRenderer.js';

// Initialize renderer with topology and templates directory
const renderer = new NunjucksRenderer(topology, '/path/to/templates');

// Get enabled services
const { services, startup_order } = renderer.getEnabledServices();

// Render all templates
const results = renderer.renderAll({
  templatesDir: '/path/to/templates',
  outputDir: '/tmp/output'
});

// Or render a single service
const quadletContent = renderer.renderService('openwebui', 'container');

// Return to user
return new Response(quadletContent, {
  headers: { 'Content-Type': 'text/plain' }
});
```

**Features:**
- ✅ Loads your existing `.njk` template files
- ✅ Evaluates `enabled_by` conditions
- ✅ Computes dependency order (topological sort)
- ✅ Renders with full topology context
- ✅ Custom Nunjucks filters for quadlet generation
- ✅ Works in Cloudflare Workers environment

---

### 4. State Tracker

Tracks configured vs default values.

**Usage in Cloudflare Worker:**
```typescript
import { StateTracker } from './state/stateTracker.js';

const tracker = new StateTracker(topology);
const state = tracker.computeState();

// Compare with previous state
const diff = tracker.compareStates(oldState, newState);
```

---

## Nunjucks Template Examples

### Example: openwebui.container.njk

```jinja
[Unit]
Description={{ description }}
After=network-online.target {{ network }}.network.service
Requires={{ network }}.network.service
{% if requires %}
Wants={% for dep in requires %}{{ dep }}.service {% endfor %}
{% endif %}

[Container]
Image={{ image }}
AutoUpdate=registry
ContainerName={{ container_name }}
HostName={{ hostname }}
Network={{ network }}.network

{% if published_port %}
PublishPort={{ bind }}:{{ published_port }}:{{ port }}
{% endif %}

{% for volume in volumes %}
Volume={{ volume.name }}:{{ volume.mount_path }}:{{ volume.selinux_label | default('Z') }}
{% endfor %}

{% for key, value in env %}
Environment={{ key }}={{ value | boolstring }}
{% endfor %}

{% if healthcheck %}
HealthCmd={{ healthcheck.cmd }}
HealthInterval={{ healthcheck.interval | default('30s') }}
HealthTimeout={{ healthcheck.timeout | default('5s') }}
HealthRetries={{ healthcheck.retries | default(3) }}
HealthStartPeriod={{ healthcheck.start_period | default('10s') }}
{% endif %}

[Service]
Slice=llm.slice
TimeoutStartSec=900
Restart=on-failure
RestartSec=10

[Install]
WantedBy=scroll-session.target
PartOf=scroll-session.target
```

---

## How the Webapp Works

### User Flow

1. User edits configuration in webapp UI
2. User hits "Save"
3. Webapp sends POST request to Cloudflare Worker with topology.json
4. Worker validates topology
5. Worker renders .njk templates
6. Worker returns generated .container files
7. User downloads or deploys quadlets

### Cloudflare Worker Example

```typescript
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'POST' && request.url.endsWith('/generate')) {
      const topology = await request.json();

      // Validate
      const schemaValidator = new SchemaValidator(SCHEMA);
      const schemaResult = schemaValidator.validateTopology(topology);
      if (!schemaResult.valid) {
        return new Response(JSON.stringify(schemaResult.errors), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const topologyValidator = new TopologyValidator(topology);
      const topologyResult = topologyValidator.validate();
      if (!topologyResult.valid) {
        return new Response(JSON.stringify(topologyResult.errors), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Render templates
      const renderer = new NunjucksRenderer(topology, TEMPLATES_DIR);
      const results = renderer.renderAll({
        templatesDir: TEMPLATES_DIR,
        outputDir: '/tmp'
      });

      // Return as ZIP or JSON
      const files = Object.fromEntries(results);
      return new Response(JSON.stringify(files), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }
};
```

---

## Template Naming Convention

The renderer expects templates to follow this naming convention:

- `servicename.container.njk` → `servicename.container`
- `servicename.volume.njk` → `servicename.volume`
- `network.network.njk` → `llm.network`

Only enabled services will be rendered.

---

## Custom Nunjucks Filters

The renderer adds these custom filters:

### `boolstring`

Converts boolean to lowercase string for environment variables:

```jinja
Environment=WEBUI_AUTH={{ webui_auth | boolstring }}
```

Output: `Environment=WEBUI_AUTH=false`

### `shouldInclude`

Checks if a field should be included based on `x-depends-on`:

```jinja
{% if field | shouldInclude(context) %}
Environment={{ field['x-env-var'] }}={{ value }}
{% endif %}
```

---

## Context Available in Templates

When rendering templates, the following context is available:

```typescript
{
  // Service identifiers
  service_name: string,
  container_name: string,
  hostname: string,

  // Image
  image: string,

  // Network
  network: string,

  // Ports
  port: number,
  published_port: number | null,
  bind: string,

  // Dependencies
  requires: string[],

  // Volumes
  volumes: VolumeMount[],

  // Health check
  healthcheck: HealthCheck,

  // Environment variables
  env: Record<string, any>,
  environment: Record<string, any>, // alias

  // Configuration
  configuration: Record<string, ConfigurationField>,

  // Infrastructure
  infrastructure: ServiceInfrastructure,

  // Metadata
  description: string,
  websocket: boolean,
  external_subdomain: string | null,

  // Secrets
  secrets: SecretsConfig,

  // Global context
  topology: Topology,
  enabled_services: string[],
  startup_order: string[]
}
```

---

## Differences from Python Version

| Feature | Python Version | TypeScript Version |
|---------|---------------|-------------------|
| Language | Python 3.8+ | TypeScript/ES2022 |
| Runtime | Command-line | Cloudflare Workers / Node.js |
| Templates | Generates quadlets from scratch | Renders existing .njk templates |
| Validation | Same logic | Same logic (ported) |
| State tracking | Same logic | Same logic (ported) |
| Primary use case | CLI tools | Webapp backend |

---

## Development

### Build

```bash
npm run build
```

Output goes to `dist/` directory.

### Watch mode

```bash
npm run dev
```

### Test

```bash
npm test
```

---

## File Structure

```
njk-schema-ts/
├── src/
│   ├── types.ts                      # TypeScript interfaces
│   ├── validators/
│   │   ├── schemaValidator.ts        # JSON Schema validation (ajv)
│   │   └── topologyValidator.ts      # Extended validation
│   ├── generators/
│   │   └── nunjucksRenderer.ts       # Template renderer ⭐
│   └── state/
│       └── stateTracker.ts           # State management
├── dist/                             # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

---

## Example: Complete Workflow

### 1. Create topology.json

```json
{
  "schema_version": "2.0.0",
  "topology": {
    "network": {
      "name": "llm",
      "subnet": "10.89.0.0/24",
      "gateway": "10.89.0.1"
    },
    "services": {
      "openwebui": {
        "infrastructure": {
          "image": "ghcr.io/open-webui/open-webui:latest",
          "container_name": "openwebui",
          "port": 8080,
          "published_port": 3000,
          "enabled": true
        },
        "configuration": {
          "type": "object",
          "properties": {
            "WEBUI_NAME": {
              "type": "string",
              "default": "My WebUI",
              "x-env-var": "WEBUI_NAME"
            }
          }
        }
      }
    }
  }
}
```

### 2. Create openwebui.container.njk template

```jinja
[Unit]
Description={{ description }}

[Container]
Image={{ image }}
ContainerName={{ container_name }}
PublishPort={{ published_port }}:{{ port }}

{% for key, value in env %}
Environment={{ key }}={{ value }}
{% endfor %}

[Service]
Restart=on-failure

[Install]
WantedBy=default.target
```

### 3. Render in Cloudflare Worker

```typescript
import { NunjucksRenderer } from './generators/nunjucksRenderer.js';

const renderer = new NunjucksRenderer(topology, './templates');
const quadlet = renderer.renderService('openwebui', 'container');

// Returns:
// [Unit]
// Description=
//
// [Container]
// Image=ghcr.io/open-webui/open-webui:latest
// ContainerName=openwebui
// PublishPort=3000:8080
//
// Environment=WEBUI_NAME=My WebUI
//
// [Service]
// Restart=on-failure
//
// [Install]
// WantedBy=default.target
```

---

## Integration with Your Stack

### Cloudflare Workers

Deploy as a Cloudflare Worker:

```typescript
// wrangler.toml
name = "quadlet-generator"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"
```

### Template Storage

Store your `.njk` templates in:
- Cloudflare KV (for production)
- R2 (for larger template sets)
- Bundled with Worker code (for small template sets)

---

## Key Advantages

✅ **Native JavaScript** - Works in Cloudflare Workers
✅ **Template-based** - Uses your existing `.njk` files
✅ **Fast** - Renders in milliseconds
✅ **Type-safe** - Full TypeScript definitions
✅ **Modular** - Import only what you need
✅ **Validated** - Multiple validation levels
✅ **Production-ready** - Error handling and logging

---

## Migration from Python Version

The Python version (`njk-schema-second/`) is still useful as:
- Reference implementation of validation logic
- CLI tools for local development
- Batch processing scripts

But for your **webapp**, use **this TypeScript version**.

---

## Next Steps

1. **Create your `.njk` templates** for each service
2. **Integrate NunjucksRenderer** into your Cloudflare Worker
3. **Build the webapp UI** that posts topology.json to the worker
4. **Test with real topologies**
5. **Deploy to Cloudflare Workers**

---

## Support

For questions about:
- **Template syntax**: See [Nunjucks documentation](https://mozilla.github.io/nunjucks/)
- **Cloudflare Workers**: See [Workers documentation](https://developers.cloudflare.com/workers/)
- **Schema design**: See `../njk-schema-011CUP2BgHZxsGMrx3Tk7aQk/`

---

## License

Same as parent project: `quadlet-setup`
