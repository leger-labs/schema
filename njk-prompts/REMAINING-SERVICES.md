# Appstore Submission: Remaining Services

## ✅ Already Converted (Foundation Complete)

From your `oct-projects/njk/` directory:

**Core Services:**
- ✅ litellm.container.njk
- ✅ litellm.yaml.njk  
- ✅ openwebui.container-with-macros.njk
- ✅ openwebui.env.njk
- ✅ openwebui.caddy.njk
- ✅ caddy.container.njk
- ✅ Caddyfile.njk

**Infrastructure:**
- ✅ base-container.njk (template inheritance)
- ✅ macros.njk (reusable components)
- ✅ blueprint-config.json (config structure)

**Documentation:**
- ✅ STATE-OF-MIGRATION.md
- ✅ MIGRATION-SUMMARY.md
- ✅ QUICK-REFERENCE.md
- ✅ INDEX.md

---

## 🚧 Remaining Services to Convert

Based on your blueprint-config.json, here are the services NOT yet converted:

### Tier 1: Audio Services
1. **whisper** - Speech-to-text
   - whisper.container.tmpl → .njk
   - whisper.caddy.tmpl → .njk
   
2. **edgetts** - Text-to-speech  
   - edgetts.container.tmpl → .njk
   - edgetts.caddy.tmpl → .njk

### Tier 2: Code Execution
3. **jupyter** - Code interpreter
   - jupyter.container.tmpl → .njk
   - jupyter.caddy.tmpl → .njk

### Tier 3: Local Inference
4. **llama-swap** - Model router
   - llama-swap.container.tmpl → .njk
   - llama-swap.caddy.tmpl → .njk
   - llama-swap/config.yml.tmpl → .njk

### Tier 4: Search
5. **searxng-redis** - Cache for search
   - searxng-redis.container.tmpl → .njk

6. **searxng** - Meta search engine
   - searxng.container.tmpl → .njk
   - searxng.caddy.tmpl → .njk
   - searxng/settings.yml.tmpl → .njk

### Tier 5: Document Processing
7. **tika** - Content extraction
   - tika.container.tmpl → .njk

### Tier 6: Vector Database
8. **qdrant** - Vector DB (conditional)
   - qdrant.container.tmpl → .njk
   - qdrant.caddy.tmpl → .njk

### Tier 7: System Management
9. **cockpit** - System dashboard
   - cockpit.container.tmpl → .njk
   - cockpit.caddy.tmpl → .njk (if exists)
   - cockpit.conf.tmpl → .njk (if exists)

### Tier 8: MCP
10. **mcp** - Model Context Protocol
    - mcp.container.tmpl → .njk

---

## 🔄 Conversion Strategy

### Automated Conversion (90% done)

Use your existing script:
```bash
cd ~/oct-projects/njk
./convert-to-nunjucks.sh ~/home/dot_config/containers/systemd/
```

This handles:
- ✅ {{ . }} → {{ variable }}
- ✅ {{- if → {% if
- ✅ {{- range → {% for
- ✅ Comments conversion
- ✅ Basic syntax transformation

### Manual Cleanup (10% remaining)

After automated conversion, review each file for:
1. Template inheritance opportunities
2. Macro usage
3. Complex conditionals
4. Provider-specific logic

---

## 📋 Claude Code Prompt Series

Use these prompts ONE AT A TIME with Claude Code in `leger-run/appstore`:

### Service Order (Dependencies First → Features)

**Session 1: Audio Services**
```
whisper → edgetts
(independent, can be done together)
```

**Session 2: Code Execution**  
```
jupyter
(depends on litellm - already done)
```

**Session 3: Local Inference**
```
llama-swap
(independent)
```

**Session 4: Search Stack**
```
searxng-redis → searxng  
(redis first, then main service)
```

**Session 5: Document Processing**
```
tika
(independent, conditional service)
```

**Session 6: Vector Database**
```
qdrant
(independent, conditional service)
```

**Session 7: System Management**
```
cockpit
(independent)
```

**Session 8: MCP**
```
mcp
(independent)
```

---

## 📁 Appstore Repository Structure

Based on your heuristic (satellite services per main service):

```
leger-run/appstore/
├── README.md
│
├── reference/                          # Your completed work
│   ├── base-container.njk
│   ├── macros.njk
│   ├── blueprint-config.json
│   └── examples/
│       ├── litellm.container.njk
│       ├── openwebui.container.njk
│       └── caddy.container.njk
│
├── whisper/
│   ├── whisper.container.njk
│   └── whisper.caddy.njk
│
├── edgetts/
│   ├── edgetts.container.njk
│   └── edgetts.caddy.njk
│
├── jupyter/
│   ├── jupyter.container.njk
│   └── jupyter.caddy.njk
│
├── llama-swap/
│   ├── llama-swap.container.njk
│   ├── llama-swap.caddy.njk
│   └── config.yml.njk
│
├── searxng/
│   ├── searxng-redis.container.njk    # Satellite service
│   ├── searxng.container.njk
│   ├── searxng.caddy.njk
│   └── settings.yml.njk
│
├── tika/
│   └── tika.container.njk
│
├── qdrant/
│   ├── qdrant.container.njk
│   └── qdrant.caddy.njk
│
├── cockpit/
│   ├── cockpit.container.njk
│   └── cockpit.caddy.njk
│
└── mcp/
    └── mcp.container.njk
```

---

## 🎯 Next Steps

1. **Run conversion script on remaining services**
   ```bash
   cd ~/oct-projects/njk
   ./convert-to-nunjucks.sh ~/home/dot_config/containers/systemd/whisper.container.tmpl
   ./convert-to-nunjucks.sh ~/home/dot_config/containers/systemd/edgetts.container.tmpl
   # ... etc
   ```

2. **Review automated conversions**
   - Check for template inheritance opportunities
   - Add macro usage where applicable
   - Verify complex conditionals

3. **Submit to appstore one service at a time**
   - Each service in its own directory
   - Include all related files (container + caddy + config)
   - Use Claude Code for final polish

4. **Git workflow**
   ```bash
   cd ~/repos/appstore
   git checkout -b add-whisper
   # Add files
   git commit -m "Add whisper audio service"
   git push
   ```

---

## 💡 Key Insights from Your Migration

From your STATE-OF-MIGRATION.md:

**What you've achieved:**
- ✅ Single source of truth (blueprint-config.json)
- ✅ Template inheritance (base-container.njk)
- ✅ Reusable macros (20+ components)
- ✅ Clean syntax (40% code reduction)
- ✅ Feature-centric design (29 decision variables)

**Your architecture:**
- Satellite services per main service (postgres/redis per app)
- Conditional service enabling (enabled_by field)
- Provider selection (13+ configurable providers)
- Feature flags (15+ toggleable features)

**Next phase:**
- Complete batch conversion of remaining 10 services
- Submit to appstore
- Enable Cloudflare Worker generation

---

**Ready to start? Begin with whisper (simplest standalone service).**
