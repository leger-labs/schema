# Appstore Conversion Prompts

Ready-to-use Claude Code prompts for converting your remaining Podman Quadlet services to Nunjucks and submitting to `leger-run/appstore`.

---

## 📦 What's Included

### Overview Documents
- **WORKFLOW.md** - Complete step-by-step workflow
- **REMAINING-SERVICES.md** - Status of what's done vs. remaining

### Service Prompts (Copy/Paste for Claude Code)
- **prompts/whisper.md** - Speech-to-text service
- **prompts/edgetts.md** - Text-to-speech service  
- **prompts/jupyter.md** - Code interpreter
- **prompts/llama-swap.md** - Local model router
- **prompts/searxng.md** - Search engine (+ redis satellite)
- **prompts/remaining.md** - Tika, Qdrant, MCP, Cockpit

---

## 🚀 Quick Start

### 1. Set Up Appstore Repo

```bash
cd ~/repos
git clone git@github.com:leger-run/appstore.git
cd appstore

# Copy your reference materials
mkdir -p reference/examples
cp ~/oct-projects/njk/{base-container.njk,macros.njk,blueprint-config.json} reference/
cp ~/oct-projects/njk/litellm.container.njk reference/examples/
cp ~/oct-projects/njk/openwebui.container-with-macros.njk reference/examples/
```

### 2. First Conversion (Whisper)

```bash
# Run automated conversion first
cd ~/oct-projects/njk
./convert-to-nunjucks.sh ~/home/dot_config/containers/systemd/whisper.container.tmpl

# Then use Claude Code for refinement
cd ~/repos/appstore
claude-code
```

In Claude Code, paste:
```
[contents of prompts/whisper.md]
```

### 3. Commit

```bash
git add whisper/
git commit -m "Add whisper speech-to-text service"
git push
```

---

## 📋 Conversion Order

**Week 1: Core Features**
1. whisper (audio input)
2. edgetts (audio output)
3. jupyter (code execution)
4. llama-swap (local inference)

**Week 2: Optional Services**
5. searxng (web search)
6. tika (document processing)
7. qdrant (vector DB)
8. mcp (tool server)
9. cockpit (system management)

---

## 📁 Expected Output

Each service gets its own directory:

```
appstore/
├── whisper/
│   ├── whisper.container.njk
│   ├── whisper.caddy.njk
│   └── README.md
├── edgetts/
│   ├── edgetts.container.njk
│   ├── edgetts.caddy.njk
│   └── README.md
└── ...
```

---

## ✅ Pattern Recognition

All prompts follow the same structure:
1. **Service Info** - Config from blueprint-config.json
2. **Files to Convert** - Source → Output mapping
3. **Key Points** - Service-specific considerations
4. **Pattern** - Template inheritance + macros
5. **Validation** - How to test

---

## 🎯 Your Foundation (Already Done)

You've completed:
- ✅ Template inheritance (base-container.njk)
- ✅ Macro library (macros.njk)
- ✅ Config structure (blueprint-config.json)
- ✅ Two complete examples (litellm, openwebui)
- ✅ Conversion script (90% automated)
- ✅ Complete documentation

Remaining work is just **applying the pattern** to 10 more services.

---

## 💡 Tips

### Use Your Completed Work
Your litellm and openwebui conversions are the gold standard - reference them heavily.

### One Service Per Session
Keep Claude Code sessions focused on one service at a time.

### Test As You Go
```bash
nunjucks-cli <service>/<service>.container.njk -p reference/blueprint-config.json
```

### Commit Often
One service = one commit.

---

## 📊 Estimated Time

- **Per service:** 15-30 minutes
- **Total remaining:** 4-6 hours
- **When:** Can complete all in one focused weekend

---

## 🎉 End Goal

A complete appstore of Nunjucks-based Podman Quadlet services that:
- ✅ Use template inheritance (DRY)
- ✅ Leverage your macro library
- ✅ Support conditional enabling
- ✅ Work with blueprint-config.json
- ✅ Are ready for Cloudflare Worker rendering

---

**Start with `WORKFLOW.md` for the complete guide, then dive into `prompts/whisper.md` for your first conversion!**
