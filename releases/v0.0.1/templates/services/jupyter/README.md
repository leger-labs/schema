# Jupyter Notebook

Interactive code interpreter for data analysis, machine learning, and AI experimentation.

## Overview

Jupyter provides an interactive Python environment for data analysis, ML/AI experiments, and code execution integrated with Open WebUI.

**Container:** `jupyter`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 8888
**Published Port:** 8889
**Image:** `docker.io/jupyter/scipy-notebook:latest`
**External URL:** https://jupyter.blueprint.tail8dd1.ts.net

## Features

- 📊 **Interactive Notebooks** - Mix code, text, and visualizations
- 🐍 **Python + Libraries** - NumPy, Pandas, Matplotlib, SciPy
- 🤖 **ML Libraries** - Scikit-learn, TensorFlow, PyTorch
- 📁 **Persistent Storage** - Notebooks saved in volume
- 🔌 **LLM Integration** - Access LiteLLM and other services
- 🎯 **Code Interpreter** - Open WebUI can execute code via Jupyter

## Quick Start

### 1. Enable and Start Service

```bash
systemctl --user daemon-reload
systemctl --user enable jupyter.service
systemctl --user start jupyter.service
systemctl --user status jupyter.service
```

### 2. Get Access Token

```bash
# View logs to find the access token/URL
journalctl --user -u jupyter.service -n 50 | grep "http://127.0.0.1"
```

### 3. Access Jupyter

- **Local:** http://localhost:8889 (use token from logs)
- **Tailscale:** https://jupyter.blueprint.tail8dd1.ts.net

## Configuration

### blueprint-config.json

```json
{
  "jupyter": {
    "hostname": "jupyter",
    "port": 8888,
    "published_port": 8889,
    "external_subdomain": "jupyter",
    "enabled": true,
    "volume": "jupyter.volume"
  }
}
```

### Environment

```bash
# Disable authentication for local use
JUPYTER_ENABLE_LAB=yes
JUPYTER_TOKEN=""  # Empty = no token required (local only!)
```

## Integration with Open WebUI

Open WebUI can use Jupyter as a code interpreter:

```bash
# In openwebui.env
ENABLE_CODE_INTERPRETER=true
CODE_INTERPRETER_URL=http://jupyter:8888
```

## Files

```
jupyter/
├── jupyter.container.njk     # Quadlet container
├── jupyter.volume            # Notebook storage
├── jupyter.caddy.njk         # Caddy config
└── README.md                 # This file
```

## Troubleshooting

### Check Logs

```bash
journalctl --user -u jupyter.service -f
```

### Common Issues

#### Cannot Access Notebook

Check if token authentication is required:

```bash
# View logs for token
journalctl --user -u jupyter.service | grep token
```

#### Notebooks Not Persisting

Verify volume is mounted:

```bash
podman volume inspect jupyter.volume
```

## Documentation

- **Official Docs:** https://jupyter.org/documentation
- **JupyterLab Docs:** https://jupyterlab.readthedocs.io/
- **GitHub:** https://github.com/jupyter/jupyter

---

**Built with Jupyter**
