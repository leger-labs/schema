# Cockpit System Management

Web-based system administration interface for managing containers and services.

## Overview

Cockpit provides a web UI for monitoring and managing the Linux system, including Podman containers and systemd services.

**Container:** `cockpit`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 9090
**Published Port:** 9090
**Image:** `quay.io/cockpit/ws:latest`
**External URL:** https://cockpit.blueprint.tail8dd1.ts.net

## Features

- 🖥️ **System Monitoring** - CPU, memory, disk, network
- 📦 **Container Management** - Podman integration
- 🔧 **Service Management** - Start/stop/restart systemd services
- 📊 **Performance Graphs** - Real-time metrics
- 🔍 **Log Viewer** - Browse system logs
- 📁 **File Manager** - Browse and edit files
- 🔐 **Secure Access** - HTTPS with authentication

## Quick Start

```bash
systemctl --user daemon-reload
systemctl --user enable cockpit.service
systemctl --user start cockpit.service
```

### Access Cockpit

- **Local:** http://localhost:9090
- **Tailscale:** https://cockpit.blueprint.tail8dd1.ts.net

### Login

Use your system user credentials.

## Features

### Container Management

- View all running containers
- Start/stop/restart containers
- View container logs
- Inspect container details
- Pull images

### Service Management

- View all systemd services
- Enable/disable services
- Start/stop/restart services
- View service logs
- Check service status

### System Monitoring

- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- System load

## Files

```
cockpit/
├── cockpit.container.njk     # Quadlet container
├── cockpit.conf.njk          # Cockpit configuration
├── cockpit.caddy.njk         # Caddy reverse proxy
└── README.md                 # This file
```

## Troubleshooting

### Cannot Login

Ensure your system user has proper permissions:

```bash
# Add user to systemd-journal group
sudo usermod -aG systemd-journal $USER
```

### Container Not Visible

Enable Podman socket:

```bash
systemctl --user enable --now podman.socket
```

## Documentation

- **Official Docs:** https://cockpit-project.org/documentation.html
- **Podman Plugin:** https://cockpit-project.org/guide/latest/feature-podman

---

**Built with Cockpit**
