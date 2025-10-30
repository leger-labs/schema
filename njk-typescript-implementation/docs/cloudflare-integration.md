# Cloudflare Workers Integration Guide

This guide shows how to integrate the njk-schema-ts tools into your Cloudflare Workers webapp.

---

## Architecture Overview

```
┌─────────────────┐
│   User Browser  │
│                 │
│  Edit topology  │
│  in webapp UI   │
│                 │
│  [Save Button]  │
└────────┬────────┘
         │ POST /generate
         │ body: topology.json
         ↓
┌─────────────────┐
│ Cloudflare      │
│ Worker          │
│                 │
│ 1. Validate     │
│ 2. Render .njk  │
│ 3. Return files │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  User downloads │
│  .container     │
│  files          │
└─────────────────┘
```

---

## Step 1: Project Setup

### Install dependencies

```bash
npm install ajv nunjucks
npm install -D @types/nunjucks typescript wrangler
```

### wrangler.toml

```toml
name = "quadlet-generator"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"
cwd = "./"
watch_dir = "src"
```

---

## Step 2: Worker Implementation

### src/worker.ts

```typescript
import { SchemaValidator } from './validators/schemaValidator';
import { TopologyValidator } from './validators/topologyValidator';
import { NunjucksRenderer } from './generators/nunjucksRenderer';
import type { Topology } from './types';

// Import schema and templates
import topologySchema from './schema.json';
import * as templates from './templates';

export interface Env {
  // KV namespace for storing templates (optional)
  TEMPLATES: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (request.method === 'POST' && new URL(request.url).pathname === '/generate') {
        return await handleGenerate(request, corsHeaders);
      }

      if (request.method === 'GET' && new URL(request.url).pathname === '/validate') {
        const url = new URL(request.url);
        const topologyUrl = url.searchParams.get('url');

        if (topologyUrl) {
          const topology = await fetch(topologyUrl).then(r => r.json());
          return await handleValidate(topology, corsHeaders);
        }
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function handleValidate(topology: Topology, corsHeaders: Record<string, string>): Promise<Response> {
  // Schema validation
  const schemaValidator = new SchemaValidator(topologySchema);
  const schemaResult = schemaValidator.validateTopology(topology);

  if (!schemaResult.valid) {
    return new Response(JSON.stringify({
      valid: false,
      errors: schemaResult.errors
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Topology validation
  const topologyValidator = new TopologyValidator(topology);
  const topologyResult = topologyValidator.validate();

  return new Response(JSON.stringify({
    valid: topologyResult.valid,
    errors: topologyResult.errors,
    warnings: topologyResult.warnings
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleGenerate(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
  const topology: Topology = await request.json();

  // Validate first
  const schemaValidator = new SchemaValidator(topologySchema);
  const schemaResult = schemaValidator.validateTopology(topology);

  if (!schemaResult.valid) {
    return new Response(JSON.stringify({
      error: 'Schema validation failed',
      details: schemaResult.errors
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const topologyValidator = new TopologyValidator(topology);
  const topologyResult = topologyValidator.validate();

  if (!topologyResult.valid) {
    return new Response(JSON.stringify({
      error: 'Topology validation failed',
      details: topologyResult.errors
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Render templates
  const renderer = new NunjucksRenderer(topology, templates);
  const { services, startup_order } = renderer.getEnabledServices();

  // Generate quadlets
  const files: Record<string, string> = {};

  for (const serviceName of services) {
    try {
      const containerContent = renderer.renderService(serviceName, 'container');
      files[`${serviceName}.container`] = containerContent;

      // Try to render volume if template exists
      try {
        const volumeContent = renderer.renderService(serviceName, 'volume');
        files[`${serviceName}.volume`] = volumeContent;
      } catch (e) {
        // Volume template doesn't exist, skip
      }
    } catch (error) {
      console.error(`Error rendering ${serviceName}:`, error);
    }
  }

  // Return as JSON
  return new Response(JSON.stringify({
    files,
    enabled_services: Array.from(services),
    startup_order
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

---

## Step 3: Template Storage

### Option A: Bundle templates with Worker code

```typescript
// src/templates/index.ts
export const templates = {
  'openwebui.container.njk': `
[Unit]
Description={{ description }}
...
`,
  'litellm.container.njk': `
...
`
};
```

### Option B: Store in KV

```typescript
// Store templates in KV
await env.TEMPLATES.put('openwebui.container.njk', templateContent);

// Retrieve in worker
const template = await env.TEMPLATES.get('openwebui.container.njk');
```

### Option C: Store in R2 (recommended for many templates)

```typescript
// wrangler.toml
[[r2_buckets]]
binding = "TEMPLATES_BUCKET"
bucket_name = "quadlet-templates"

// worker.ts
const templateObject = await env.TEMPLATES_BUCKET.get('openwebui.container.njk');
const template = await templateObject.text();
```

---

## Step 4: Frontend Integration

### React/Vue/Svelte Example

```typescript
async function generateQuadlets(topology: Topology) {
  const response = await fetch('https://your-worker.workers.dev/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(topology)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const result = await response.json();
  return result.files; // { "openwebui.container": "...", ... }
}

// Usage in component
async function handleSave() {
  try {
    setLoading(true);
    const files = await generateQuadlets(topology);

    // Download as ZIP or show in UI
    downloadAsZip(files);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}
```

---

## Step 5: Testing Locally

### Test with wrangler dev

```bash
npm install -g wrangler
wrangler dev
```

### Test with curl

```bash
curl -X POST http://localhost:8787/generate \
  -H "Content-Type: application/json" \
  -d @topology.json
```

---

## Step 6: Deployment

```bash
wrangler deploy
```

Your worker will be available at: `https://quadlet-generator.<your-subdomain>.workers.dev`

---

## Performance Considerations

### Optimize Bundle Size

Use esbuild to tree-shake unused code:

```json
{
  "build": {
    "command": "esbuild src/worker.ts --bundle --outfile=dist/worker.js --format=esm --minify"
  }
}
```

### Cache Compiled Templates

```typescript
const TEMPLATE_CACHE = new Map<string, nunjucks.Template>();

function getCompiledTemplate(name: string, content: string) {
  if (!TEMPLATE_CACHE.has(name)) {
    const compiled = nunjucks.compile(content);
    TEMPLATE_CACHE.set(name, compiled);
  }
  return TEMPLATE_CACHE.get(name);
}
```

### Use Durable Objects for State

```typescript
export class TopologyState {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    // Store topology states
    // Compare states
    // Track changes
  }
}
```

---

## Security Considerations

### Validate Input Size

```typescript
const MAX_TOPOLOGY_SIZE = 1024 * 1024; // 1MB

if (request.headers.get('content-length') > MAX_TOPOLOGY_SIZE) {
  return new Response('Topology too large', { status: 413 });
}
```

### Sanitize Output

```typescript
// Ensure generated quadlets don't contain malicious content
function sanitizeQuadlet(content: string): string {
  // Remove dangerous patterns
  return content.replace(/`/g, '').replace(/\$\{/g, '');
}
```

### Rate Limiting

```typescript
// Use Workers KV for rate limiting
const rateLimit = await env.RATE_LIMIT.get(clientIP);
if (rateLimit && parseInt(rateLimit) > 100) {
  return new Response('Rate limit exceeded', { status: 429 });
}
await env.RATE_LIMIT.put(clientIP, String((parseInt(rateLimit || '0') + 1)), {
  expirationTtl: 3600
});
```

---

## Advanced Features

### Streaming Response

For large topology files:

```typescript
const { readable, writable } = new TransformStream();
const writer = writable.getWriter();

// Start streaming
queueMicrotask(async () => {
  for (const [filename, content] of files.entries()) {
    await writer.write(new TextEncoder().encode(
      JSON.stringify({ filename, content }) + '\n'
    ));
  }
  await writer.close();
});

return new Response(readable, {
  headers: { 'Content-Type': 'application/x-ndjson' }
});
```

### Webhook Integration

Notify when quadlets are generated:

```typescript
await fetch(env.WEBHOOK_URL, {
  method: 'POST',
  body: JSON.stringify({
    event: 'quadlets_generated',
    services: Array.from(services),
    timestamp: new Date().toISOString()
  })
});
```

---

## Monitoring

### Add Analytics

```typescript
// Track generation requests
await fetch('https://analytics.example.com/track', {
  method: 'POST',
  body: JSON.stringify({
    event: 'quadlet_generation',
    service_count: services.size,
    timestamp: Date.now()
  })
});
```

### Error Logging

```typescript
try {
  // ... worker logic
} catch (error) {
  // Log to external service
  await fetch(env.ERROR_LOGGING_URL, {
    method: 'POST',
    body: JSON.stringify({
      error: error.message,
      stack: error.stack,
      request_url: request.url,
      timestamp: Date.now()
    })
  });

  throw error;
}
```

---

## Complete Working Example

See `examples/cloudflare-worker/` for a complete, working Cloudflare Worker implementation.

---

## FAQ

**Q: Can I use this without Cloudflare Workers?**
A: Yes! It works in Node.js, Deno, Bun, or any JavaScript runtime.

**Q: How do I handle secrets in templates?**
A: Use Cloudflare Workers secrets or environment variables:
```typescript
const secrets = {
  api_keys: {
    litellm: env.LITELLM_API_KEY
  }
};
```

**Q: Can I customize the Nunjucks environment?**
A: Yes! Pass custom filters and globals when creating the renderer.

**Q: How do I debug template rendering?**
A: Enable Nunjucks debugging:
```typescript
const env = nunjucks.configure({ throwOnUndefined: true });
```

---

## Next Steps

1. Set up Cloudflare Worker project
2. Copy TypeScript files to worker
3. Add your `.njk` templates
4. Test locally with `wrangler dev`
5. Deploy with `wrangler deploy`
6. Integrate with your webapp frontend

---

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
- [Ajv JSON Schema Validator](https://ajv.js.org/)
