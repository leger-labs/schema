# ComfyUI

Node-based Stable Diffusion workflow interface for advanced image generation.

## Overview

ComfyUI provides a powerful node-based interface for creating complex Stable Diffusion workflows, supporting advanced features like ControlNet, LoRA, and custom pipelines.

**Container:** `comfyui`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 8188
**Published Port:** 8188
**Image:** `ghcr.io/ai-dock/comfyui:latest`
**External URL:** https://comfy.blueprint.tail8dd1.ts.net

## Features

- 🎨 **Node-Based Workflow** - Visual programming for image generation
- 🖼️ **Advanced Models** - SDXL, SD 1.5, SD 2.x support
- 🎯 **ControlNet** - Precise control over generation
- 🔧 **LoRA Support** - Fine-tuned model integration
- 📦 **Custom Nodes** - Extensible plugin system
- ⚡ **Fast Generation** - Optimized inference
- 💾 **Workflow Saving** - Reusable generation pipelines

## Quick Start

```bash
systemctl --user daemon-reload
systemctl --user enable comfyui.service
systemctl --user start comfyui.service
```

### Access ComfyUI

- **Local:** http://localhost:8188
- **Tailscale:** https://comfy.blueprint.tail8dd1.ts.net

### Download Models

```bash
# Models are stored in comfyui-models.volume
# Download to: /models/checkpoints/
# Download from: https://civitai.com or https://huggingface.co
```

## Integration with Open WebUI

```bash
# In openwebui.env
ENABLE_IMAGE_GENERATION=true
IMAGE_GENERATION_ENGINE=comfyui
COMFYUI_BASE_URL=http://comfyui:8188
```

## Files

```
njk/
├── comfyui.container.njk     # Quadlet container
├── comfyui.volume.njk        # Output storage
├── comfyui-models.volume.njk # Model storage
├── comfyui.caddy.njk         # Caddy config
└── comfyui-README.md         # This file
```

## Model Management

### Checkpoints

Place Stable Diffusion checkpoints in:
- `/models/checkpoints/`

### LoRA

Place LoRA models in:
- `/models/loras/`

### ControlNet

Place ControlNet models in:
- `/models/controlnet/`

### VAE

Place VAE models in:
- `/models/vae/`

## Workflows

### Basic Text-to-Image

1. Load Checkpoint node
2. CLIP Text Encode (prompt)
3. KSampler (generation)
4. VAE Decode
5. Save Image

### Advanced Workflows

- ControlNet pose-guided generation
- Multi-model composition
- Upscaling pipelines
- Batch processing

## Troubleshooting

### Models Not Loading

Check model paths:

```bash
podman exec -it comfyui ls -la /models/checkpoints/
```

### Out of Memory

Use smaller models or reduce batch size in workflow.

### Generation Slow

ComfyUI optimizes for quality. For faster generation:
- Reduce steps (20-30 instead of 50)
- Use smaller models
- Lower resolution

## Documentation

- **Official Docs:** https://github.com/comfyanonymous/ComfyUI
- **Community Workflows:** https://comfyworkflows.com/
- **Custom Nodes:** https://github.com/ltdrdata/ComfyUI-Manager

---

**Built with ComfyUI**
