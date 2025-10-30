# Chezmoi → Nunjucks Migration: Quick Reference & Roadmap

## 📁 What You Have Now

### Core Files Created

```
/home/claude/
├── blueprint-config.json          # ⭐ NEW: Single source of truth
├── MIGRATION-SUMMARY.md            # 📚 Complete migration guide
│
├── Caddyfile.njk                   # ✅ Converted: Main Caddy config
├── openwebui.caddy.njk             # ✅ Converted: Caddy service route
├── caddy.container.njk             # ✅ Converted: Caddy container quadlet
├── openwebui.env.njk               # ✅ Converted: Complex env file
├── litellm.yaml.njk                # ✅ Converted: YAML with loops
│
└── templates/
    ├── base-container.njk          # 🎨 NEW: Template inheritance
    ├── litellm.container.njk       # 🎨 NEW: Example extending base
    ├── macros.njk                  # 🔧 NEW: Reusable components
    └── openwebui.container-with-macros.njk  # 💎 NEW: Clean final result
```

---

## 🎯 Your New Architecture

### Before (Chezmoi)

```
.chezmoi.yaml.tmpl (YAML + Go templates)
        ↓
    chezmoi apply
        ↓
Multiple .tmpl files scattered everywhere
        ↓
Generated configs on local machine
```

### After (Nunjucks + Cloudflare Workers)

```
blueprint-config.json (Clean JSON)
        ↓
Cloudflare Worker (Nunjucks renderer)
        ↓
Template library (inheritance + macros)
        ↓
Generated configs (any platform)
```

---

## 🚀 Quick Start: Using Your New Templates

### 1. Render a Template (Local Testing)

```javascript
// test-render.js
const nunjucks = require('nunjucks');
const config = require('./blueprint-config.json');
const fs = require('fs');

// Configure Nunjucks
const env = nunjucks.configure('templates', {
    autoescape: true,
    trimBlocks: true,
    lstripBlocks: true
});

// Render a template
const template = fs.readFileSync('Caddyfile.njk', 'utf8');
const rendered = env.renderString(template, config);

console.log(rendered);
```

### 2. Using Macros

```nunjucks
{# In your template #}
{% import "macros.njk" as m %}

{# Clean, readable code #}
{{ m.unitSection(service, network.name, service.requires) }}
{{ m.publishPort(service) }}
{{ m.healthCheck(service.port) }}
{{ m.volumeMount("data.volume", "/data") }}
```

### 3. Using Template Inheritance

```nunjucks
{# Child template #}
{% extends "base-container.njk" %}

{# Only define what's unique #}
{% block volumes %}
Volume=my-volume:/data:Z
{% endblock %}

{% block environment %}
Environment=MY_VAR=value
{% endblock %}
```

---

## 📊 Migration Progress Tracker

### ✅ Phase 1: Foundation (COMPLETE)

- [x] Create JSON config file
- [x] Convert representative templates
- [x] Create base templates
- [x] Create macro library
- [x] Write documentation

### 🚧 Phase 2: Convert Remaining Files

**Container Files** (20+ files):
```bash
# Priority order:
- [ ] litellm.container.njk
- [ ] openwebui.container.njk
- [ ] llama-swap.container.njk
- [ ] whisper.container.njk
- [ ] edgetts.container.njk
- [ ] jupyter.container.njk
- [ ] searxng.container.njk
- [ ] tika.container.njk
- [ ] qdrant.container.njk
- [ ] cockpit.container.njk
- [ ] All postgres containers
- [ ] All redis containers
```

**Caddy Files** (10+ files):
```bash
- [ ] litellm.caddy.njk
- [ ] openwebui.caddy.njk (✅ DONE)
- [ ] jupyter.caddy.njk
- [ ] llama-swap.caddy.njk
- [ ] whisper.caddy.njk
- [ ] edgetts.caddy.njk
- [ ] searxng.caddy.njk
- [ ] qdrant.caddy.njk
- [ ] cockpit.caddy.njk
```

**Config Files**:
```bash
- [ ] litellm.yaml.njk (✅ DONE)
- [ ] llama-swap/config.yml.njk
- [ ] searxng/settings.yml.njk
- [ ] cockpit.conf.njk
```

### 🔮 Phase 3: Cloudflare Worker

```bash
- [ ] Set up Wrangler project
- [ ] Configure Nunjucks in Worker
- [ ] Add JSON schema validation
- [ ] Create API endpoints
- [ ] Add authentication
- [ ] Deploy to production
```

### 🎨 Phase 4: Polish

```bash
- [ ] Create more macros for common patterns
- [ ] Add more base templates
- [ ] Write comprehensive tests
- [ ] Create CI/CD pipeline
- [ ] Update deployment scripts
```

---

## 🛠️ Conversion Cheat Sheet

### Common Patterns

| Pattern | Go Templates | Nunjucks |
|---------|--------------|----------|
| **Variable** | `{{ .var }}` | `{{ var }}` |
| **Nested** | `{{ .a.b.c }}` | `{{ a.b.c }}` |
| **Array** | `{{ index .arr 0 }}` | `{{ arr[0] }}` |
| **If** | `{{- if .x }}` | `{% if x %}` |
| **Else** | `{{- else }}` | `{% else %}` |
| **Elif** | `{{- else if .x }}` | `{% elif x %}` |
| **End** | `{{- end }}` | `{% endif %}` |
| **Loop** | `{{- range .items }}` | `{% for item in items %}` |
| **Loop end** | `{{- end }}` | `{% endfor %}` |
| **Equals** | `{{- if eq .a "b" }}` | `{% if a == "b" %}` |
| **Not equals** | `{{- if ne .a "b" }}` | `{% if a != "b" %}` |
| **And** | `{{- if and .a .b }}` | `{% if a and b %}` |
| **Or** | `{{- if or .a .b }}` | `{% if a or b %}` |
| **Not** | `{{- if not .x }}` | `{% if not x %}` |
| **Default** | `{{ .x \| default "y" }}` | `{{ x \| default("y") }}` |
| **Upper** | `{{ .x \| upper }}` | `{{ x \| upper }}` |
| **Length** | `{{ len .x }}` | `{{ x \| length }}` |
| **Comment** | `{{- /* comment */ }}` | `{# comment #}` |

### Automated Conversion

```bash
#!/bin/bash
# convert-syntax.sh - Quick and dirty converter

for file in **/*.tmpl; do
  newfile="${file%.tmpl}.njk"
  
  cat "$file" | \
    # Variables: {{ .var }} → {{ var }}
    sed 's/{{ \./{{ /g' | \
    sed 's/{{- \./{{- /g' | \
    
    # Control structures: {{- if → {% if
    sed 's/{{-/{% /g' | \
    sed 's/-}}/ %}/g' | \
    
    # Comparisons: eq → ==
    sed 's/{% if eq /{% if /g' | \
    sed 's/ }}/{% if \1 == /g' | \
    
    # End statements
    sed 's/{% end %}/{% endif %}/g' | \
    sed 's/{% else if /{% elif /g' | \
    
    # Range → for
    sed 's/{% range /{% for item in /g' | \
    sed 's/{% endfor %}/{% endfor %}/g' | \
    
    # Comments: {{- /* → {#
    sed 's/{{- \/\* /{# /g' | \
    sed 's/\*\/ -}}/ #}/g' \
    > "$newfile"
  
  echo "✓ $file → $newfile"
done
```

---

## 💡 Pro Tips

### 1. Use Template Inheritance Everywhere

**DON'T** repeat yourself:
```nunjucks
{# BAD: Duplicate in every container file #}
[Unit]
Description=...
After=network-online.target
# ... 50 lines of boilerplate ...
```

**DO** extend base templates:
```nunjucks
{# GOOD: One line to get all boilerplate #}
{% extends "base-container.njk" %}

{# Only define what's unique #}
{% block volumes %}
Volume=my-data:/data:Z
{% endblock %}
```

### 2. Create Macros for Repeated Patterns

If you write the same code 3+ times, make it a macro:

```nunjucks
{# macros.njk #}
{% macro publishPort(service) %}
{% if service.published_port %}
PublishPort={{ service.bind | default("127.0.0.1") }}:{{ service.published_port }}:{{ service.port }}
{% endif %}
{% endmacro %}

{# Use it everywhere #}
{% import "macros.njk" as m %}
{{ m.publishPort(service) }}
```

### 3. Keep Your JSON Flat

**BAD** (hard to template):
```json
{
  "infrastructure": {
    "services": {
      "litellm": {
        "container": {
          "config": {
            "environment": {
              "variables": {
                "API_KEY": "..."
              }
            }
          }
        }
      }
    }
  }
}
```

**GOOD** (easy to template):
```json
{
  "infrastructure": {
    "services": {
      "litellm": {
        "port": 4000,
        "api_key": "...",
        "enabled": true
      }
    }
  }
}
```

### 4. Use Filters Liberally

Nunjucks has great built-in filters:

```nunjucks
{{ name | upper }}                    {# MECATTAF #}
{{ items | length }}                  {# 5 #}
{{ url | replace("http", "https") }}  {# https://... #}
{{ list | join(", ") }}               {# a, b, c #}
{{ value | default("fallback") }}     {# fallback if empty #}
{{ data | tojson }}                   {# JSON string #}
```

### 5. Comments Are Your Friend

```nunjucks
{# TODO: Add GPU support #}
{# FIXME: This breaks on ARM #}
{# NOTE: Requires litellm to be running #}

{# 
Long explanation of complex logic:
- Step 1
- Step 2
- Step 3
#}
```

---

## 🔍 Debugging Tips

### 1. Render Templates Locally

```bash
npm install nunjucks
node test-render.js
```

### 2. Check for Common Mistakes

```nunjucks
{# WRONG: Go template syntax #}
{{ .variable }}
{{- if eq .a "b" }}

{# RIGHT: Nunjucks syntax #}
{{ variable }}
{% if a == "b" %}
```

### 3. Use `nunjucks-validate` (VSCode Extension)

Install "Nunjucks Template" extension for:
- Syntax highlighting
- Error checking
- Auto-completion

### 4. Test Each Template

```bash
# Test a single template
node -e "
const nunjucks = require('nunjucks');
const config = require('./blueprint-config.json');
const fs = require('fs');
const template = fs.readFileSync('litellm.container.njk', 'utf8');
console.log(nunjucks.renderString(template, config));
"
```

---

## 📚 Resources

### Your Files

- `MIGRATION-SUMMARY.md` - Complete guide
- `blueprint-config.json` - Single source of truth
- `templates/` - Template library

### Documentation

- [Nunjucks Official Docs](https://mozilla.github.io/nunjucks/)
- [Template Inheritance](https://mozilla.github.io/nunjucks/templating.html#template-inheritance)
- [Macros](https://mozilla.github.io/nunjucks/templating.html#macro)
- [Filters](https://mozilla.github.io/nunjucks/templating.html#builtin-filters)

### Comparison Doc

Your `Chezmoi Go Templates → Nunjucks: Complete Feature Comparison` document - excellent reference!

---

## ✅ Next Steps

### Immediate (Today)

1. ✅ Review the converted examples
2. ✅ Understand the new architecture
3. ✅ Read MIGRATION-SUMMARY.md

### Short Term (This Week)

1. Convert all container files using base template
2. Convert all Caddy files
3. Test rendering locally
4. Validate all outputs

### Medium Term (Next Week)

1. Set up Cloudflare Worker project
2. Add JSON schema validation
3. Create deployment pipeline
4. Update documentation

### Long Term (Next Month)

1. Add more macros
2. Create additional base templates
3. Write comprehensive tests
4. Optimize for performance

---

## 🎉 What You've Achieved

### Before

- ❌ Cryptic Go template syntax
- ❌ Duplicate code everywhere
- ❌ Poor error messages
- ❌ Tied to chezmoi
- ❌ YAML configuration hell

### After

- ✅ Clean Nunjucks syntax
- ✅ Template inheritance (DRY)
- ✅ Helpful error messages
- ✅ Platform-independent
- ✅ Simple JSON config

**You've made an excellent architectural decision!** 🚀

Your infrastructure-as-code is now:
- **More maintainable**
- **More portable**
- **More powerful**
- **More developer-friendly**

---

## 🤝 Questions?

Refer to:
1. `MIGRATION-SUMMARY.md` (comprehensive guide)
2. This quick reference (fast lookup)
3. Your comparison doc (Go vs Nunjucks)
4. Nunjucks official docs (deep dive)
5. The converted examples (real-world patterns)

**Happy templating!** 🎨✨
