# Appstore Conversion Workflow

## 📊 Current Status

### ✅ Completed (Foundation)
From your `oct-projects/njk/`:
- litellm (container + yaml + dependencies)
- openwebui (container + env + caddy + dependencies)
- caddy (main reverse proxy)
- Base infrastructure (base-container.njk, macros.njk)
- Complete documentation

### 🚧 Remaining (10 Services)

| Service | Files | Complexity | Priority |
|---------|-------|------------|----------|
| whisper | container + caddy | Simple | High |
| edgetts | container + caddy | Simple | High |
| jupyter | container + caddy | Medium | High |
| llama-swap | container + caddy + config | Medium | High |
| searxng | redis + container + caddy + settings | Complex | Medium |
| tika | container | Simple | Low |
| qdrant | container + caddy | Medium | Low |
| mcp | container | Simple | Low |
| cockpit | container + caddy | Medium | Low |

---

## 🔄 Workflow

### Step 1: Automated Conversion

Run your conversion script:
```bash
cd ~/oct-projects/njk

# Convert one service
./convert-to-nunjucks.sh ~/home/dot_config/containers/systemd/whisper.container.tmpl

# Or batch convert
for service in whisper edgetts jupyter llama-swap tika qdrant mcp cockpit; do
  ./convert-to-nunjucks.sh ~/home/dot_config/containers/systemd/${service}.container.tmpl
done
```

This gives you 90% converted .njk files.

### Step 2: Manual Refinement (Claude Code)

For each service, use Claude Code to:
1. Apply template inheritance
2. Add macro usage
3. Handle conditionals
4. Create related files (caddy, config)

**Workflow per service:**
```bash
cd ~/repos/appstore

# Create service directory
mkdir -p <service-name>

# Start Claude Code
claude-code

# In Claude Code session:
# - Reference: prompts/<service>.md
# - Read source: oct-projects/njk/<service>.container.njk (after conversion)
# - Refine and place in appstore/<service>/
```

### Step 3: Commit

```bash
git add <service-name>/
git commit -m "Add <service-name> quadlet

- Convert from Go templates to Nunjucks
- [specific features]"
git push
```

---

## 📋 Service-by-Service Guide

### Session 1: Audio Services (1-2 hours)

**Whisper** (STT)
```bash
# Prompt: prompts/whisper.md
# Output: appstore/whisper/
#   - whisper.container.njk
#   - whisper.caddy.njk
#   - README.md
```

**EdgeTTS** (TTS)
```bash
# Prompt: prompts/edgetts.md
# Output: appstore/edgetts/
#   - edgetts.container.njk
#   - edgetts.caddy.njk
#   - README.md
```

### Session 2: Code Execution (1 hour)

**Jupyter**
```bash
# Prompt: prompts/jupyter.md
# Output: appstore/jupyter/
#   - jupyter.container.njk
#   - jupyter.caddy.njk
#   - README.md
```

### Session 3: Local Inference (1-2 hours)

**Llama-Swap**
```bash
# Prompt: prompts/llama-swap.md
# Output: appstore/llama-swap/
#   - llama-swap.container.njk
#   - llama-swap.caddy.njk
#   - config.yml.njk
#   - README.md
```

### Session 4: Search Stack (2 hours)

**SearXNG**
```bash
# Prompt: prompts/searxng.md
# Output: appstore/searxng/
#   - searxng-redis.container.njk  (satellite)
#   - searxng.container.njk
#   - searxng.caddy.njk
#   - settings.yml.njk
#   - README.md
```

### Session 5-8: Optional Services (30 min each)

**Tika, Qdrant, MCP, Cockpit**
```bash
# Prompt: prompts/remaining.md
# Output: appstore/<service>/
```

---

## 🎯 Claude Code Prompts

Each prompt file in `prompts/` contains:
- Service configuration from blueprint-config.json
- Files to convert
- Specific patterns to follow
- Expected output structure

**Usage:**
1. Open prompt file: `prompts/<service>.md`
2. Copy content
3. Start Claude Code in `~/repos/appstore`
4. Paste prompt
5. Follow along as Claude converts

---

## 📁 Expected Appstore Structure

```
leger-run/appstore/
│
├── reference/                  # Your completed work (read-only)
│   ├── base-container.njk
│   ├── macros.njk
│   ├── blueprint-config.json
│   └── examples/
│       ├── litellm.container.njk
│       └── openwebui.container.njk
│
├── whisper/
│   ├── whisper.container.njk
│   ├── whisper.caddy.njk
│   └── README.md
│
├── edgetts/
│   ├── edgetts.container.njk
│   ├── edgetts.caddy.njk
│   └── README.md
│
├── jupyter/
│   ├── jupyter.container.njk
│   ├── jupyter.caddy.njk
│   └── README.md
│
├── llama-swap/
│   ├── llama-swap.container.njk
│   ├── llama-swap.caddy.njk
│   ├── config.yml.njk
│   └── README.md
│
├── searxng/
│   ├── searxng-redis.container.njk
│   ├── searxng.container.njk
│   ├── searxng.caddy.njk
│   ├── settings.yml.njk
│   └── README.md
│
├── tika/
│   └── tika.container.njk
│
├── qdrant/
│   ├── qdrant.container.njk
│   └── qdrant.caddy.njk
│
├── mcp/
│   └── mcp.container.njk
│
└── cockpit/
    ├── cockpit.container.njk
    └── cockpit.caddy.njk
```

---

## ✅ Validation Checklist

For each service:

### Rendering
- [ ] Template renders without errors
- [ ] All variables resolve from blueprint-config.json
- [ ] Output is valid Quadlet syntax

### Quality
- [ ] Extends base-container.njk (where applicable)
- [ ] Uses macros for common patterns
- [ ] Conditionals properly handle enabled_by
- [ ] Dependencies correctly specified

### Documentation
- [ ] README.md explains service purpose
- [ ] Dependencies listed
- [ ] Config requirements documented

### Git
- [ ] Clean commit message
- [ ] All files in correct directory
- [ ] No leftover .backup files

---

## 🚀 Quick Start

**Today:**
```bash
# 1. Set up repo
cd ~/repos
git clone git@github.com:leger-run/appstore.git
cd appstore

# 2. Copy reference materials
mkdir -p reference/examples
cp ~/oct-projects/njk/base-container.njk reference/
cp ~/oct-projects/njk/macros.njk reference/
cp ~/oct-projects/njk/blueprint-config.json reference/
cp ~/oct-projects/njk/litellm.container.njk reference/examples/
cp ~/oct-projects/njk/openwebui.container-with-macros.njk reference/examples/

# 3. Copy prompts
cp ~/prompts/*.md .

# 4. Start with whisper
claude-code
# Then paste: prompts/whisper.md
```

**This week:**
- Complete audio services (whisper, edgetts)
- Complete jupyter
- Complete llama-swap

**Next week:**
- Complete searxng
- Complete optional services

---

## 💡 Tips

### Keep Sessions Focused
One service per Claude Code session. Stay focused on that service's files only.

### Reference Your Own Work
Your completed litellm and openwebui examples are the best references - they follow your patterns.

### Test Incrementally
After each service, test rendering:
```bash
nunjucks-cli <service>/<service>.container.njk -p reference/blueprint-config.json
```

### Commit Often
One service = one commit. Makes it easy to track progress.

---

## 📞 Questions?

- Check your completed examples in `reference/examples/`
- Review your documentation in `oct-projects/njk/*.md`
- Look at the conversion script for patterns

**Remember:** You've already done the hard part (foundation). Now it's just applying the pattern 10 more times!
