# Llama-Swap

Dynamic model router for local LLM inference with automatic model loading/unloading.

## Overview

Llama-Swap intelligently manages local LLM models by loading and unloading them on demand, optimizing GPU/RAM usage.

**Container:** `llama-swap`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 8000
**Published Port:** 8000
**Image:** `ghcr.io/roperi/llama-swap:latest`
**External URL:** https://llama.blueprint.tail8dd1.ts.net

## Features

- 🔄 **Dynamic Loading** - Load models on demand
- 💾 **Memory Management** - Unload unused models
- 🎯 **Smart Routing** - Route requests to appropriate models
- ⚡ **Fast Switching** - Minimize model swap time
- 📊 **Usage Tracking** - Monitor model usage patterns
- 🔌 **OpenAI Compatible** - Works with existing LLM clients

## Quick Start

```bash
systemctl --user daemon-reload
systemctl --user enable llama-swap.service
systemctl --user start llama-swap.service
```

### Configure Models

Edit `llama-swap-config.yaml.njk`:

```yaml
models:
  - name: llama-3.2-3b
    path: /models/llama-3.2-3b.gguf
    priority: high
    max_context: 8192

  - name: qwen2.5-32b
    path: /models/qwen2.5-32b.gguf
    priority: medium
    max_context: 32768

swap_settings:
  max_loaded: 1  # Maximum models in memory
  idle_timeout: 300  # Unload after 5 minutes idle
```

## Integration with LiteLLM

```yaml
# In litellm.yaml
model_list:
  - model_name: llama-3.2-3b
    litellm_params:
      model: openai/llama-3.2-3b
      api_base: http://llama-swap:8000/v1
```

## Files

```
llama-swap/
├── llama-swap.container.njk      # Quadlet container
├── llama-swap-config.yaml.njk    # Configuration
├── llama-swap.volume             # Model storage
├── llama-swap.caddy.njk          # Caddy config
└── README.md                     # This file
```

## Troubleshooting

### Models Not Loading

Check model paths and permissions:

```bash
podman exec -it llama-swap ls -la /models
```

### Out of Memory

Reduce `max_loaded` or use smaller models:

```yaml
swap_settings:
  max_loaded: 1
```

## Documentation

- **GitHub:** https://github.com/roperi/llama-swap

---

**Built with Llama-Swap**
