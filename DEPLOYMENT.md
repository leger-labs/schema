# Deployment Guide

Complete step-by-step guide for deploying the Blueprint LLM Infrastructure Stack.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Template Rendering](#template-rendering)
- [Service Deployment](#service-deployment)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Production Setup](#production-setup)
- [Backup & Recovery](#backup--recovery)

---

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 16GB
- Disk: 100GB
- OS: Linux with systemd (Fedora 38+, Ubuntu 22.04+, RHEL 9+)

**Recommended:**
- CPU: 8+ cores
- RAM: 32GB+
- Disk: 500GB+ SSD
- GPU: Optional (for local model inference)

### Software Requirements

```bash
# Update system
sudo dnf update -y  # Fedora/RHEL
# or
sudo apt update && sudo apt upgrade -y  # Ubuntu

# Install Podman 4.0+
sudo dnf install -y podman podman-compose
# or
sudo apt install -y podman podman-compose

# Verify Podman version
podman --version  # Should be 4.0 or higher

# Install Node.js (for Nunjucks)
sudo dnf install -y nodejs npm
# or
sudo apt install -y nodejs npm

# Verify Node.js
node --version  # Should be 18.0 or higher
npm --version
```

### Optional: Tailscale

For external HTTPS access:

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate
sudo tailscale up

# Verify
tailscale status
```

---

## Installation

### 1. Clone Repository

```bash
# Clone to preferred location
cd ~
git clone <repository-url> llm-infrastructure
cd llm-infrastructure/njk/

# Verify structure
ls -la
```

### 2. Install Nunjucks Renderer

```bash
# Install nunjucks-cli globally
npm install -g nunjucks-cli

# Verify installation
which nunjucks
```

### 3. Create Directories

```bash
# Create systemd user directory
mkdir -p ~/.config/containers/systemd/

# Create data directories (if needed)
mkdir -p ~/.local/share/containers/storage/
```

---

## Configuration

### 1. Edit blueprint-config.json

```bash
# Open in your editor
nano blueprint-config.json
# or
vim blueprint-config.json
```

### 2. Configure User Settings

```json
{
  "user": {
    "name": "your-username",
    "email": "your@email.com"
  },
  "system": {
    "hostname": "your-hostname",
    "timezone": "America/New_York"
  }
}
```

### 3. Configure Tailscale (if using)

```json
{
  "tailscale": {
    "hostname": "llm-stack",
    "tailnet": "your-tailnet.ts.net",
    "full_hostname": "llm-stack.your-tailnet.ts.net"
  }
}
```

### 4. Configure LLM Providers

```json
{
  "llm_providers": {
    "anthropic": {
      "enabled": true,
      "api_key": "${ANTHROPIC_API_KEY}",
      "models": [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022"
      ]
    },
    "openai": {
      "enabled": true,
      "api_key": "${OPENAI_API_KEY}",
      "models": [
        "gpt-4o",
        "gpt-4o-mini"
      ]
    },
    "ollama": {
      "enabled": false,
      "base_url": "http://localhost:11434",
      "models": []
    }
  }
}
```

### 5. Enable/Disable Services

```json
{
  "infrastructure": {
    "services": {
      "litellm": { "enabled": true },
      "openwebui": { "enabled": true },
      "searxng": { "enabled": true },
      "qdrant": { "enabled": true },
      "jupyter": { "enabled": true },
      "tika": { "enabled": true },
      "whisper": { "enabled": true },
      "edgetts": { "enabled": true },
      "comfyui": { "enabled": false },
      "cockpit": { "enabled": true },
      "llama-swap": { "enabled": false }
    }
  }
}
```

### 6. Set Environment Variables

```bash
# Create environment file
cat > ~/.config/llm-stack.env << 'EOF'
# LLM Provider API Keys
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
export OPENAI_API_KEY="sk-your-key-here"

# Tailscale OAuth (optional)
export TAILSCALE_OAUTH_CLIENT_ID="your-client-id"
export TAILSCALE_OAUTH_CLIENT_SECRET="your-client-secret"

# GitHub (optional)
export GITHUB_CLI_PAT="your-github-token"
EOF

# Secure the file
chmod 600 ~/.config/llm-stack.env

# Load variables
source ~/.config/llm-stack.env

# Add to shell profile for persistence
echo "source ~/.config/llm-stack.env" >> ~/.bashrc
```

---

## Template Rendering

### 1. Render Templates

```bash
# From the njk/ directory
cd ~/llm-infrastructure/njk/

# Render all .njk templates
for template in $(find . -name "*.njk"); do
  output_path="${template%.njk}"  # Remove .njk extension
  output_dir=$(dirname "$output_path")

  # Create output directory
  mkdir -p ~/.config/containers/systemd/$output_dir

  # Render template
  nunjucks blueprint-config.json \
    --path . \
    --template "$template" \
    > ~/.config/containers/systemd/$output_path
done

# Verify rendered files
ls -la ~/.config/containers/systemd/
```

### 2. Alternative: Use Render Script

Create a helper script:

```bash
cat > render.sh << 'EOF'
#!/bin/bash
set -e

CONFIG_FILE="blueprint-config.json"
TEMPLATE_DIR="."
OUTPUT_DIR="$HOME/.config/containers/systemd"

echo "Rendering Nunjucks templates..."
echo "Config: $CONFIG_FILE"
echo "Output: $OUTPUT_DIR"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Find and render all .njk files
find "$TEMPLATE_DIR" -name "*.njk" -type f | while read template; do
  # Calculate relative path
  relative_path="${template#./}"

  # Remove .njk extension for output
  output_file="${relative_path%.njk}"
  output_path="$OUTPUT_DIR/$output_file"

  # Create subdirectories
  mkdir -p "$(dirname "$output_path")"

  # Render template
  echo "  Rendering: $relative_path -> $output_file"
  nunjucks "$CONFIG_FILE" --path . --template "$template" > "$output_path"
done

echo "✅ Templates rendered to $OUTPUT_DIR"
EOF

chmod +x render.sh
./render.sh
```

### 3. Verify Rendered Files

```bash
# Check that .container files were created
find ~/.config/containers/systemd/ -name "*.container" | head -5

# Verify a rendered file
cat ~/.config/containers/systemd/openwebui/openwebui.container
```

---

## Service Deployment

### 1. Create Network

```bash
# Reload systemd to pick up new quadlets
systemctl --user daemon-reload

# Enable and start network
systemctl --user enable llm.network.service
systemctl --user start llm.network.service

# Verify network
podman network inspect llm.network
```

### 2. Deploy Core Services

```bash
# Start in dependency order

# 1. Reverse proxy
systemctl --user enable --now caddy.service

# 2. LiteLLM + dependencies
systemctl --user enable --now litellm-postgres.service
systemctl --user enable --now litellm-redis.service
systemctl --user enable --now litellm.service

# 3. Open WebUI + dependencies
systemctl --user enable --now openwebui-postgres.service
systemctl --user enable --now openwebui-redis.service
systemctl --user enable --now openwebui.service

# 4. Supporting services
systemctl --user enable --now searxng-redis.service
systemctl --user enable --now searxng.service
systemctl --user enable --now qdrant.service
systemctl --user enable --now tika.service
systemctl --user enable --now jupyter.service
```

### 3. Deploy Optional Services

```bash
# Voice I/O
systemctl --user enable --now whisper.service
systemctl --user enable --now edgetts.service

# System management
systemctl --user enable --now cockpit.service

# Image generation (if enabled)
systemctl --user enable --now comfyui.service

# Local model routing (if enabled)
systemctl --user enable --now llama-swap.service
```

### 4. Enable Persistent Services

```bash
# Enable lingering so services start on boot (not just login)
loginctl enable-linger $USER

# Verify lingering
loginctl show-user $USER | grep Linger
```

---

## Verification

### 1. Check Service Status

```bash
# List all running services
systemctl --user list-units --type=service | grep -E "(llm|caddy|openwebui|litellm)"

# Check specific services
systemctl --user status caddy.service
systemctl --user status litellm.service
systemctl --user status openwebui.service
```

### 2. Check Health Endpoints

```bash
# LiteLLM
curl http://localhost:4000/health

# Open WebUI
curl http://localhost:3000/health

# Qdrant
curl http://localhost:6333/health

# SearXNG
curl "http://localhost:8888/search?q=test"
```

### 3. Test LLM API

```bash
# List models
curl http://localhost:4000/v1/models | jq .

# Test chat completion
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }' | jq .
```

### 4. Access Web Interfaces

#### Local Access

- **Open WebUI:** http://localhost:3000
- **LiteLLM:** http://localhost:4000/ui
- **Cockpit:** http://localhost:9090
- **Qdrant:** http://localhost:6333/dashboard
- **Jupyter:** http://localhost:8889

#### Tailscale Access (if configured)

- **Open WebUI:** https://ai.llm-stack.your-tailnet.ts.net
- **LiteLLM:** https://llm.llm-stack.your-tailnet.ts.net
- **Cockpit:** https://cockpit.llm-stack.your-tailnet.ts.net

### 5. View Logs

```bash
# Real-time logs for all services
journalctl --user -f

# Specific service logs
journalctl --user -u openwebui.service -f

# Last 100 lines
journalctl --user -u litellm.service -n 100

# Logs since 1 hour ago
journalctl --user --since "1 hour ago"
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check service status
systemctl --user status <service>.service

# Check logs for errors
journalctl --user -u <service>.service -n 50

# Check dependencies
systemctl --user list-dependencies <service>.service

# Restart service
systemctl --user restart <service>.service
```

### Port Already in Use

```bash
# Find process using port
sudo lsof -i :4000

# Or use ss
ss -tlnp | grep 4000

# Kill process
kill <PID>

# Or change port in blueprint-config.json and re-render
```

### Database Connection Errors

```bash
# Check database service
systemctl --user status openwebui-postgres.service

# Connect to database
podman exec -it openwebui-postgres psql -U openwebui -d openwebui

# View database logs
journalctl --user -u openwebui-postgres.service -n 50
```

### Network Issues

```bash
# Verify network exists
podman network inspect llm.network

# Recreate network if needed
systemctl --user stop llm.network.service
podman network rm llm.network
systemctl --user start llm.network.service
```

### Cannot Access via Tailscale

```bash
# Check Tailscale status
tailscale status

# Verify Caddy is running
systemctl --user status caddy.service

# Test local access first
curl http://localhost:3000

# Check Caddy logs
journalctl --user -u caddy.service -n 50
```

---

## Production Setup

### 1. Security Hardening

```bash
# Set secure passwords
# Edit blueprint-config.json and set strong passwords

# Disable debug logging
# In blueprint-config.json, set log levels to INFO or WARNING

# Enable firewall (if using local access only)
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 2. Enable Auto-Updates

All services use `AutoUpdate=registry` by default. Enable automatic updates:

```bash
# Enable Podman auto-update timer
systemctl --user enable --now podman-auto-update.timer

# Verify timer
systemctl --user list-timers | grep podman-auto-update

# Manual update
podman auto-update

# Check what would be updated
podman auto-update --dry-run
```

### 3. Configure Backups

```bash
# Create backup script
cat > ~/backup-llm-stack.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/backups/llm-stack"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL databases
for service in openwebui litellm; do
  echo "Backing up ${service} database..."
  podman exec -t ${service}-postgres pg_dumpall -U ${service} \
    > "$BACKUP_DIR/backup-${service}-${DATE}.sql"
done

# Backup Podman volumes
echo "Backing up volumes..."
for volume in $(podman volume ls -q | grep -E "(openwebui|qdrant|jupyter)"); do
  podman volume export "$volume" > "$BACKUP_DIR/backup-${volume}-${DATE}.tar"
done

# Backup configuration
echo "Backing up configuration..."
cp ~/llm-infrastructure/njk/blueprint-config.json "$BACKUP_DIR/config-${DATE}.json"

echo "✅ Backup complete: $BACKUP_DIR"
EOF

chmod +x ~/backup-llm-stack.sh

# Run backup manually
~/backup-llm-stack.sh

# Schedule with cron (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup-llm-stack.sh") | crontab -
```

### 4. Monitoring

```bash
# Install systemd monitoring (optional)
sudo dnf install -y cockpit-pcp cockpit-podman

# Access Cockpit
xdg-open http://localhost:9090
```

### 5. Resource Limits

Edit quadlet files if needed:

```bash
# Edit service
nano ~/.config/containers/systemd/openwebui/openwebui.container

# Add resource limits
[Container]
Memory=4G
CPUs=2.0
```

Then reload:

```bash
systemctl --user daemon-reload
systemctl --user restart openwebui.service
```

---

## Backup & Recovery

### Backup

```bash
# Full backup
~/backup-llm-stack.sh

# Manual database backup
podman exec -t openwebui-postgres pg_dumpall -U openwebui > backup.sql

# Manual volume backup
podman volume export openwebui.volume > openwebui-volume-backup.tar
```

### Recovery

```bash
# Restore database
cat backup.sql | podman exec -i openwebui-postgres psql -U openwebui

# Restore volume
podman volume import openwebui.volume < openwebui-volume-backup.tar

# Restart services
systemctl --user restart openwebui.service
```

### Disaster Recovery

```bash
# Complete reinstall

# 1. Stop all services
systemctl --user stop llm.network.service

# 2. Remove all volumes (⚠️ DELETES DATA)
podman volume prune -af

# 3. Remove all containers
podman rm -af

# 4. Re-render templates
cd ~/llm-infrastructure/njk/
./render.sh

# 5. Reload systemd
systemctl --user daemon-reload

# 6. Restore backups (if available)
cat backup.sql | podman exec -i openwebui-postgres psql -U openwebui

# 7. Restart services
systemctl --user start llm.network.service
systemctl --user start caddy.service
systemctl --user start litellm.service
systemctl --user start openwebui.service
```

---

## Next Steps

1. ✅ **Access Open WebUI:** http://localhost:3000
2. ✅ **Create admin account** (first user becomes admin)
3. ✅ **Configure models** in LiteLLM
4. ✅ **Upload documents** to test RAG
5. ✅ **Enable voice I/O** if needed
6. ✅ **Set up backups** for production

---

## Additional Resources

- **Main README:** [README.md](README.md)
- **Service Documentation:** See each service's README.md
- **Quick Reference:** [QUICK-REFERENCE.md](QUICK-REFERENCE.md)
- **Architecture:** [STATE-OF-MIGRATION.md](STATE-OF-MIGRATION.md)

---

**🚀 Happy deploying!**
