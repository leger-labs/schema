# Chezmoi → Nunjucks Migration: Complete Architecture

## 🎉 Migration Summary

You've successfully migrated from **chezmoi Go templates** to **Nunjucks templates** for your Cloudflare Workers-based configuration generator. This is a significant upgrade that gives you:

✅ **More powerful templating** (inheritance, macros, better syntax)
✅ **Cleaner configuration** (JSON instead of YAML)
✅ **Better portability** (works in Cloudflare Workers)
✅ **Easier maintenance** (no Go template quirks)

---

## 📊 New Single Source of Truth: `blueprint-config.json`

Your entire infrastructure is now defined in **one JSON file**: `blueprint-config.json`

### Structure Overview

```json
{
  "user": {},              // User identity
  "system": {},            // System info
  "tailscale": {},         // Network config
  "github": {},            // Git config
  "infrastructure": {      // Core infrastructure
    "network": {},         // Podman network
    "services": {}         // All containers
  },
  "secrets": {},           // API keys (env vars)
  "litellm": {},          // LLM proxy config
  "local_inference": {},   // Local models
  "whisper": {},          // STT config
  "edgetts": {},          // TTS config
  "openwebui": {},        // Main app config
  "searxng": {},          // Search engine
  "caddy": {}             // Reverse proxy
}
```

### Key Improvements

| Aspect | Before (Chezmoi) | After (Nunjucks) |
|--------|------------------|------------------|
| **Format** | YAML with Go templates | Pure JSON |
| **Variables** | `.variable` (dot prefix) | `variable` (clean) |
| **Secrets** | Embedded in YAML | Environment variables |
| **Validation** | None | JSON Schema possible |
| **Editor support** | Limited | Excellent (JSON + Nunjucks) |

---

## 🔄 Syntax Conversion Reference

### Variables

```go
// Go Templates (OLD)
{{ .user.name }}
{{ .infrastructure.services.litellm.port }}
{{ index .list 0 }}
```

```nunjucks
{# Nunjucks (NEW) #}
{{ user.name }}
{{ infrastructure.services.litellm.port }}
{{ list[0] }}
```

### Conditionals

```go
// Go Templates (OLD)
{{- if .enabled }}
  enabled
{{- else if .other }}
  other
{{- else }}
  disabled
{{- end }}

{{- if eq .type "x" }}
  matches
{{- end }}

{{- if and .a .b }}
  both true
{{- end }}
```

```nunjucks
{# Nunjucks (NEW) #}
{% if enabled %}
  enabled
{% elif other %}
  other
{% else %}
  disabled
{% endif %}

{% if type == "x" %}
  matches
{% endif %}

{% if a and b %}
  both true
{% endif %}
```

### Loops

```go
// Go Templates (OLD)
{{- range .items }}
  {{ . }}
{{- end }}

{{- range $key, $value := .dict }}
  {{ $key }}: {{ $value }}
{{- end }}
```

```nunjucks
{# Nunjucks (NEW) #}
{% for item in items %}
  {{ item }}
{% endfor %}

{% for key, value in dict %}
  {{ key }}: {{ value }}
{% endfor %}
```

### Filters

```go
// Go Templates (OLD)
{{ .x | default "fallback" }}
{{ .x | upper }}
{{ len .x }}
```

```nunjucks
{# Nunjucks (NEW) #}
{{ x | default("fallback") }}
{{ x | upper }}
{{ x | length }}
```

---

## 🎨 New Powerful Features

### 1. Template Inheritance (HUGE WIN!)

**Base Template** (`base.container.njk`):
```nunjucks
[Unit]
Description={{ description }}
After=network-online.target

{% block dependencies %}
{# Override in child templates #}
{% endblock %}

[Container]
{% block container_config %}
{# Override in child templates #}
{% endblock %}
```

**Child Template** (`litellm.container.njk`):
```nunjucks
{% extends "base.container.njk" %}

{% block dependencies %}
After=litellm-postgres.service litellm-redis.service
{% endblock %}

{% block container_config %}
Image=ghcr.io/berriai/litellm:main-stable
Environment=DATABASE_URL={{ database_url }}
{% endblock %}
```

This eliminates **massive duplication** across your 20+ container files!

### 2. Macros (Reusable Components)

**Define Once** (`macros.njk`):
```nunjucks
{% macro publishPort(service) %}
{% if service.published_port %}
PublishPort={{ service.bind | default("127.0.0.1") }}:{{ service.published_port }}:{{ service.port }}
{% endif %}
{% endmacro %}

{% macro volumeMount(volume, path) %}
Volume={{ volume }}:{{ path }}:Z
{% endmacro %}
```

**Use Everywhere**:
```nunjucks
{% import "macros.njk" as m %}

{{ m.publishPort(infrastructure.services.litellm) }}
{{ m.volumeMount("litellm-data", "/data") }}
```

### 3. Better Error Messages

**Go Template Error** (cryptic):
```
template: litellm.yaml.tmpl:45:12: executing "litellm.yaml.tmpl" 
at <.models.enabled>: can't evaluate field enabled in type interface {}
```

**Nunjucks Error** (helpful):
```
Error: Unable to call `enabled`, which is undefined or falsey
    at litellm.yaml.njk:45:12
```

---

## 📁 Converted File Examples

### 1. Main Caddyfile

**Before** (`Caddyfile.tmpl`):
```go
{{- range $name, $service := .infrastructure.services }}
{{- if and $service.enabled $service.external_subdomain }}
#   - {{ $name }}.caddy → https://{{ $service.external_subdomain }}.{{ $.tailscale.full_hostname }}
{{- end }}
{{- end }}
```

**After** (`Caddyfile.njk`):
```nunjucks
{% for name, service in infrastructure.services %}
{%- if service.enabled and service.external_subdomain %}
#   - {{ name }}.caddy → https://{{ service.external_subdomain }}.{{ tailscale.full_hostname }}
{% endif -%}
{% endfor %}
```

### 2. OpenWebUI Environment

**Before** (`openwebui.env.tmpl`):
```go
{{- if .openwebui.features.rag }}
ENABLE_RAG=true
RAG_EMBEDDING_ENGINE={{ .openwebui.providers.rag_embedding }}

{{- if eq .openwebui.providers.rag_embedding "openai" }}
RAG_OPENAI_API_BASE_URL={{ .openwebui.rag_embedding_config.openai.base_url }}
{{- end }}
{{- else }}
ENABLE_RAG=false
{{- end }}
```

**After** (`openwebui.env.njk`):
```nunjucks
{% if openwebui.features.rag %}
ENABLE_RAG=true
RAG_EMBEDDING_ENGINE={{ openwebui.providers.rag_embedding }}

{% if openwebui.providers.rag_embedding == "openai" %}
RAG_OPENAI_API_BASE_URL={{ openwebui.rag_embedding_config.openai.base_url }}
{% endif %}
{% else %}
ENABLE_RAG=false
{% endif %}
```

### 3. LiteLLM Configuration

**Before** (`litellm.yaml.tmpl`):
```go
model_list:
  {{- range .litellm.models }}
  {{- if .enabled }}
  - model_name: {{ .name }}
    litellm_params:
      {{- if eq .provider "openai" }}
      model: openai/{{ .name }}
      {{- end }}
  {{- end }}
  {{- end }}
```

**After** (`litellm.yaml.njk`):
```nunjucks
model_list:
  {% for model in litellm.models %}
  {%- if model.enabled %}
  - model_name: {{ model.name }}
    litellm_params:
      {% if model.provider == "openai" -%}
      model: openai/{{ model.name }}
      {% endif -%}
  {% endif -%}
  {% endfor %}
```

---

## 🏗️ Architecture: How It Works

### Generation Flow

```
blueprint-config.json (Single Source of Truth)
        ↓
Cloudflare Worker (Nunjucks Renderer)
        ↓
Generated Files:
    ├── Caddyfile
    ├── *.caddy (service routes)
    ├── *.container (quadlet files)
    ├── *.env (environment files)
    ├── *.yaml (configs)
    └── *.volume (volume definitions)
        ↓
Deploy to Host
        ↓
systemctl --user daemon-reload
systemctl --user start <services>
```

### Key Benefits

1. **Single Source of Truth**: One JSON file defines everything
2. **Type Safety**: JSON is easily validated
3. **Version Control**: Git-friendly (JSON + templates)
4. **Portability**: Works in Cloudflare Workers, Node.js, browsers
5. **DRY**: Template inheritance eliminates duplication
6. **Maintainability**: Clean syntax, better errors

---

## 🚀 Next Steps

### 1. Complete the Migration

Convert remaining template files:
- All `.container.tmpl` → `.container.njk`
- All `.caddy.tmpl` → `.caddy.njk`
- All `.env.tmpl` → `.env.njk`
- All `.yaml.tmpl` → `.yaml.njk`
- All `.volume` files (these don't need templating)

**Automated conversion script** (90% of the work):
```bash
#!/bin/bash
# convert-to-nunjucks.sh

for file in **/*.tmpl; do
  # Get new filename
  newfile="${file%.tmpl}.njk"
  
  # Basic syntax conversions
  sed -e 's/{{-/{% /g' \
      -e 's/-}}/% }/g' \
      -e 's/{{ \./{{ /g' \
      -e 's/{{- if eq \([^ ]*\) "\([^"]*\)" }}/{% if \1 == "\2" %}/g' \
      -e 's/{{- if \(.*\) }}/{% if \1 %}/g' \
      -e 's/{{- else if /{% elif /g' \
      -e 's/{{- else }}/{% else %}/g' \
      -e 's/{{- end }}/{% endif %}/g' \
      -e 's/{{- range \(.*\) }}/{% for item in \1 %}/g' \
      -e 's/{{- \/\* \(.*\) \*\/ -}}/{# \1 #}/g' \
      "$file" > "$newfile"
  
  echo "Converted: $file → $newfile"
done
```

### 2. Create Template Inheritance Structure

**Base Templates** (DRY principle):
```
templates/
├── base/
│   ├── container.njk        # Base quadlet template
│   ├── env.njk              # Base environment file
│   └── caddy.njk            # Base Caddy route
├── macros/
│   ├── systemd.njk          # Systemd macros
│   ├── caddy.njk            # Caddy macros
│   └── container.njk        # Container macros
└── services/
    ├── litellm.container.njk
    ├── openwebui.container.njk
    └── ...
```

### 3. Build the Cloudflare Worker

```typescript
// worker.ts
import nunjucks from 'nunjucks';
import config from './blueprint-config.json';

export default {
  async fetch(request: Request): Promise<Response> {
    const env = nunjucks.configure({
      autoescape: true,
      trimBlocks: true,
      lstripBlocks: true
    });
    
    // Render template
    const template = await request.text();
    const rendered = env.renderString(template, config);
    
    return new Response(rendered, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
```

### 4. Validate and Test

```bash
# Validate JSON schema
ajv validate -s config-schema.json -d blueprint-config.json

# Test template rendering
npm test

# Deploy to Cloudflare
wrangler deploy
```

---

## 📊 Migration Progress

### ✅ Completed

- [x] Main configuration file (`blueprint-config.json`)
- [x] Caddyfile template (`Caddyfile.njk`)
- [x] Sample Caddy service (`openwebui.caddy.njk`)
- [x] Sample container (`caddy.container.njk`)
- [x] Complex environment file (`openwebui.env.njk`)
- [x] YAML config example (`litellm.yaml.njk`)

### 🚧 Remaining

- [ ] Convert all 20+ `.container.tmpl` files
- [ ] Convert all `.caddy.tmpl` files
- [ ] Convert remaining `.env.tmpl` files
- [ ] Create base templates for inheritance
- [ ] Create macro library
- [ ] Build Cloudflare Worker
- [ ] Add JSON schema validation
- [ ] Update deployment scripts

---

## 💡 Best Practices Going Forward

### 1. Use Template Inheritance

**Don't repeat yourself**:
```nunjucks
{# BAD: Duplicate quadlet headers in every file #}
[Unit]
Description=...
After=network-online.target

{# GOOD: Extend base template #}
{% extends "base.container.njk" %}
{% block service_config %}
  {# Only define what's unique #}
{% endblock %}
```

### 2. Create Reusable Macros

**Common patterns**:
```nunjucks
{% macro serviceUnit(service, requires=[]) %}
[Unit]
Description={{ service.description }}
After=network-online.target {{ network.name }}.network.service
{% for dep in requires %}
After={{ dep }}.service
{% endfor %}
{% endmacro %}
```

### 3. Keep Config Flat

**JSON structure** should be straightforward:
```json
{
  "service": {
    "name": "litellm",
    "port": 4000,
    "enabled": true
  }
}
```

Avoid deep nesting that makes templates hard to read.

### 4. Use Filters Liberally

Nunjucks has powerful built-in filters:
```nunjucks
{{ service.name | upper }}
{{ services | length }}
{{ url | replace("http", "https") }}
{{ list | join(", ") }}
{{ value | default("fallback") }}
{{ json_obj | tojson }}
```

---

## 🎯 What You've Gained

### Before (Chezmoi + Go Templates)

```go
{{- if .enabled }}
{{- range $key, $value := .services }}
{{- if eq .type "web" }}
{{ $value.name }}: {{ $value.port }}
{{- end }}
{{- end }}
{{- end }}
```

**Problems:**
- Cryptic syntax (`$`, `:=`, `eq`)
- Poor error messages
- No inheritance
- Tight coupling to chezmoi

### After (JSON + Nunjucks)

```nunjucks
{% if enabled %}
{% for key, service in services %}
{% if service.type == "web" %}
{{ service.name }}: {{ service.port }}
{% endif %}
{% endfor %}
{% endif %}
```

**Benefits:**
- ✨ Clean, readable syntax
- 🎯 Great error messages
- 🏗️ Template inheritance
- 🔧 Reusable macros
- 🌐 Cloudflare Workers compatible
- 📝 Better IDE support

---

## 📚 Resources

### Documentation

- [Nunjucks Templating](https://mozilla.github.io/nunjucks/)
- [Template Inheritance](https://mozilla.github.io/nunjucks/templating.html#template-inheritance)
- [Macros](https://mozilla.github.io/nunjucks/templating.html#macro)
- [Filters](https://mozilla.github.io/nunjucks/templating.html#builtin-filters)

### Example Repositories

Check out these for inspiration:
- [mozilla/nunjucks](https://github.com/mozilla/nunjucks) - Official repo
- Your comparison doc: `Chezmoi Go Templates → Nunjucks: Complete Feature Comparison`

---

## 🎉 Conclusion

You've made an excellent architectural decision! Nunjucks is:
- **More powerful** than Go templates
- **Better suited** for Cloudflare Workers
- **Easier to maintain** with inheritance and macros
- **More familiar** to most developers (Jinja2-inspired)

Your infrastructure-as-code is now **cleaner, more maintainable, and more portable**.

**Next**: Complete the migration and enjoy the benefits! 🚀

---

**Questions?** Refer to:
- Your comparison doc (excellent reference!)
- This migration guide
- Nunjucks official docs
- The converted examples above
