# MCP Context Forge

Enterprise-ready Model Context Protocol Gateway that federates MCP and REST services with A2A, SSO, observability, and multi-tenancy.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [MCP Server Registration](#registering-mcp-servers)
- [Database Options](#database-options)
- [Authentication](#authentication)
- [Observability](#observability)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

---

## Features

- 🌐 **Federation** - Unify multiple MCP servers and REST APIs
- 🔐 **Authentication** - JWT, OAuth, SSO (GitHub, Google, Keycloak, Entra, etc.)
- 🤖 **A2A Integration** - External AI agent support (OpenAI, Anthropic, AWS Bedrock, Ollama)
- 💬 **LLM Chat** - Built-in chat interface with multiple LLM providers
- 🎨 **Admin UI** - Real-time management dashboard at `/admin`
- 📊 **Observability** - OpenTelemetry with Phoenix, Jaeger, Zipkin support
- 🚀 **Multi-Transport** - HTTP, SSE, WebSocket, stdio
- 👥 **Multi-Tenancy** - Email authentication, teams, RBAC
- 🔌 **Plugin System** - Extensible architecture with custom plugins

---

## Quick Start

### 1. Create Directories

```bash
mkdir -p ~/.local/share/mcp-context-forge
mkdir -p ~/.config/mcp-context-forge
```

### 2. Configure Secrets

Generate strong secrets and save them:

```bash
cat > ~/.config/mcp-context-forge/secrets.env << 'EOF'
# JWT Secret Key (for HMAC-based JWT signing)
JWT_SECRET_KEY=$(openssl rand -hex 32)

# Admin Password
ADMIN_PASSWORD=$(openssl rand -base64 24)
BASIC_AUTH_PASSWORD=$(openssl rand -base64 24)
PLATFORM_ADMIN_PASSWORD=$(openssl rand -base64 24)

# Auth Encryption Secret (for encrypting stored credentials)
AUTH_ENCRYPTION_SECRET=$(openssl rand -hex 32)

# SSO Secrets (optional - uncomment and configure if using SSO)
# SSO_GITHUB_CLIENT_ID=your-github-oauth-client-id
# SSO_GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
# SSO_GOOGLE_CLIENT_ID=your-google-oauth-client-id
# SSO_GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# LLM Provider Keys (optional - for built-in chat)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# AZURE_OPENAI_KEY=...
# AWS_ACCESS_KEY=...
# AWS_SECRET_KEY=...

# Database Password (if using PostgreSQL/MariaDB)
# DB_PASSWORD=your-secure-db-password
EOF

# Secure the secrets file
chmod 600 ~/.config/mcp-context-forge/secrets.env
```

### 3. Enable and Start Service

```bash
# Enable the service
systemctl --user enable mcp-context-forge.service

# Start the service
systemctl --user start mcp-context-forge.service

# Check status
systemctl --user status mcp-context-forge.service
```

### 4. Access the Service

- **Admin UI:** http://localhost:4444/admin
- **API Docs:** http://localhost:4444/docs
- **Health Check:** http://localhost:4444/health
- **External Access:** https://mcp.your-hostname.ts.net (if Caddy + Tailscale configured)

### 5. Login

Default credentials:
- **Username:** admin
- **Email:** admin@example.com
- **Password:** Check your `secrets.env` for the `ADMIN_PASSWORD` value

---

## Configuration

### blueprint-config.json

The service is configured via `blueprint-config.json` under `infrastructure.services.mcp_context_forge`. Key settings:

```json
{
  "mcp_context_forge": {
    "enabled": true,
    "port": 4444,
    "database": "postgresql",
    "catalog_enabled": true,
    "ui_enabled": true,
    "admin_api_enabled": true,
    "auth_required": true,
    "redis_enabled": false,
    "federation_enabled": true,
    "a2a_enabled": true,
    "llmchat_enabled": false,
    "observability_enabled": false,
    "requires": ["mcp_context_forge_postgres"]
  }
}
```

### Environment Variables

Most environment variables are set in the Nunjucks template. Sensitive values are loaded from `~/.config/mcp-context-forge/secrets.env`.

**Common Variables:**

```bash
# Basic Settings
APP_NAME=MCP_Gateway
HOST=0.0.0.0
PORT=4444
ENVIRONMENT=production
LOG_LEVEL=INFO

# Database (PostgreSQL - default)
DATABASE_URL=postgresql://mcp@mcp-context-forge-postgres:5432/mcp

# Authentication
BASIC_AUTH_USER=admin
PLATFORM_ADMIN_EMAIL=admin@example.com
AUTH_REQUIRED=true
JWT_ALGORITHM=HS256

# Features
MCPGATEWAY_UI_ENABLED=true
MCPGATEWAY_A2A_ENABLED=true
FEDERATION_ENABLED=true
```

---

## Registering MCP Servers

**IMPORTANT:** Individual MCP servers are **NOT** configured in the quadlet file. They are registered through:

### Option 1: Via Admin UI (Recommended)

1. Navigate to http://localhost:4444/admin
2. Login with admin credentials
3. Click **"Gateways"** → **"Add Gateway"**
4. Enter server details:
   - **Name:** `my-mcp-server`
   - **URL:** `http://mcp-server:8080/sse`
   - **Transport:** `sse` (or `http`, `ws`, `stdio`)
   - **Description:** Optional description
5. Click **"Save"**

### Option 2: Via API

```bash
# Get authentication token
export TOKEN=$(curl -X POST http://localhost:4444/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-admin-password"
  }' | jq -r '.token')

# Register MCP server
curl -X POST http://localhost:4444/gateways \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-mcp-server",
    "url": "http://mcp-server:8080/sse",
    "transport": "sse",
    "description": "My MCP Server"
  }'

# List all registered gateways
curl -X GET http://localhost:4444/gateways \
  -H "Authorization: Bearer $TOKEN"
```

### Option 3: Via MCP Catalog (Pre-configuration)

Create `~/.config/mcp-context-forge/mcp-catalog.yml`:

```yaml
servers:
  - name: filesystem
    url: http://mcp-filesystem:8080/sse
    transport: sse
    description: Filesystem access tools
    tags: [filesystem, tools]
    enabled: true

  - name: git
    url: http://mcp-git:8080/sse
    transport: sse
    description: Git repository tools
    tags: [git, vcs, tools]
    enabled: true

  - name: postgres
    url: http://mcp-postgres:8080/sse
    transport: sse
    description: PostgreSQL database tools
    tags: [database, postgres, tools]
    enabled: false
    auth_type: bearer
    # auth_value configured via UI after registration
```

Enable in `blueprint-config.json`:

```json
{
  "catalog_enabled": true
}
```

Servers in the catalog are automatically discovered and available for registration via the Admin UI.

### Creating Virtual Servers

Bundle tools from multiple MCP servers into a unified endpoint:

```bash
# Create virtual server
curl -X POST http://localhost:4444/servers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-virtual-server",
    "associatedTools": ["filesystem_read", "git_status", "postgres_query"],
    "description": "Bundled tools for development workflow"
  }'

# Access virtual server
# Connect MCP clients to: http://localhost:4444/servers/my-virtual-server/sse
```

---

## Database Options

### PostgreSQL (Default - Recommended)

**Best for:** Production, multi-user deployments, high concurrency

MCP Context Forge is configured with a dedicated PostgreSQL database by default.

```json
{
  "database": "postgresql",
  "requires": ["mcp_context_forge_postgres"]
}
```

**Configuration:**

The PostgreSQL service is automatically configured:
- **Service:** `mcp-context-forge-postgres`
- **Image:** `docker.io/postgres:17`
- **Database:** `mcp`
- **User:** `mcp`
- **Authentication:** Trust (internal network only, no password required)
- **Volume:** `mcp-context-forge-postgres.volume`

The template automatically sets: `DATABASE_URL=postgresql://mcp@mcp-context-forge-postgres:5432/mcp`

**Pros:**
- Production-ready, high performance
- Supports high concurrency
- ACID compliance
- Excellent scalability
- Automatic backups via volume snapshots

**No additional setup required!** The PostgreSQL container is automatically created and managed.

### SQLite (Alternative)

**Best for:** Development, testing, single-user deployments

To switch to SQLite, update `blueprint-config.json`:

```json
{
  "database": "sqlite",
  "requires": []
}
```

Database file: `~/.local/share/mcp-context-forge/mcp.db`

**Pros:**
- No additional services required
- Simple setup
- File-based, easy backups

**Cons:**
- Not suitable for high concurrency
- Limited scalability
- Not recommended for production

### MariaDB / MySQL

**Best for:** Alternative to PostgreSQL, compatibility requirements

```json
{
  "database": "mariadb",
  "requires": ["mariadb"]
}
```

Update `secrets.env`:

```bash
DB_PASSWORD=your-secure-mysql-password
```

The template will set: `DATABASE_URL=mysql+pymysql://mysql:${DB_PASSWORD}@mariadb:3306/mcp`

---

## Authentication

### Email-Based Authentication (Default)

Users log in with email and password. Passwords are hashed using Argon2id.

**Create Users via Admin UI:**
1. Navigate to `/admin/users`
2. Click "Add User"
3. Enter email, name, password
4. Assign role (admin, user)

**Password Policy (configurable):**

```bash
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=false
PASSWORD_REQUIRE_LOWERCASE=false
PASSWORD_REQUIRE_NUMBERS=false
PASSWORD_REQUIRE_SPECIAL=false
```

### JWT Tokens

**Symmetric (HMAC - Default):**

Uses `JWT_SECRET_KEY` from `secrets.env`.

```bash
JWT_ALGORITHM=HS256
JWT_SECRET_KEY=$(openssl rand -hex 32)
```

**Asymmetric (RSA/ECDSA - Recommended for Production):**

Generate keys:

```bash
mkdir -p ~/.config/mcp-context-forge/jwt

# RSA keys
openssl genrsa -out ~/.config/mcp-context-forge/jwt/private.pem 4096
openssl rsa -in ~/.config/mcp-context-forge/jwt/private.pem \
  -pubout -out ~/.config/mcp-context-forge/jwt/public.pem

# Secure keys
chmod 600 ~/.config/mcp-context-forge/jwt/private.pem
chmod 644 ~/.config/mcp-context-forge/jwt/public.pem
```

Update `blueprint-config.json`:

```json
{
  "jwt_algorithm": "RS256"
}
```

Update `secrets.env`:

```bash
JWT_ALGORITHM=RS256
JWT_PUBLIC_KEY_PATH=/etc/jwt/public.pem
JWT_PRIVATE_KEY_PATH=/etc/jwt/private.pem
```

### SSO (Single Sign-On)

**Supported Providers:**
- GitHub OAuth
- Google OAuth
- Microsoft Entra ID (Azure AD)
- Keycloak
- Okta
- IBM Security Verify
- Generic OIDC (Auth0, Authentik, etc.)

**Enable GitHub SSO Example:**

Update `secrets.env`:

```bash
# Enable SSO
SSO_ENABLED=true
SSO_AUTO_CREATE_USERS=true

# GitHub OAuth
SSO_GITHUB_ENABLED=true
SSO_GITHUB_CLIENT_ID=your-github-oauth-client-id
SSO_GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
SSO_GITHUB_ADMIN_ORGS=["your-org"]  # Optional: Auto-admin for org members
```

**Create GitHub OAuth App:**
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set **Homepage URL:** `https://mcp.your-hostname.ts.net`
4. Set **Callback URL:** `https://mcp.your-hostname.ts.net/auth/github/callback`
5. Copy Client ID and Client Secret to `secrets.env`

**Enable Google SSO Example:**

```bash
SSO_ENABLED=true
SSO_GOOGLE_ENABLED=true
SSO_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
SSO_GOOGLE_CLIENT_SECRET=your-google-client-secret
SSO_GOOGLE_ADMIN_DOMAINS=["yourdomain.com"]  # Optional: Auto-admin for domain users
```

---

## Observability

### OpenTelemetry Support

MCP Context Forge supports OpenTelemetry for distributed tracing, metrics, and observability.

**Supported Exporters:**
- OTLP (gRPC/HTTP)
- Jaeger
- Zipkin
- Console (for debugging)

### Phoenix (LLM-Focused Observability)

**Phoenix** by Arize AI provides LLM-specific tracing and evaluation.

**Setup:**

```bash
# Start Phoenix
podman run -d --name phoenix \
  --network llm.network \
  -p 6006:6006 -p 4317:4317 \
  docker.io/arizephoenix/phoenix:latest

# Update blueprint-config.json
{
  "observability_enabled": true,
  "otel_exporter": "otlp",
  "otel_endpoint": "http://phoenix:4317"
}

# Restart MCP Context Forge
systemctl --user restart mcp-context-forge.service

# Access Phoenix UI
# http://localhost:6006
```

### Jaeger

```bash
# Start Jaeger
podman run -d --name jaeger \
  --network llm.network \
  -p 16686:16686 -p 14268:14268 \
  docker.io/jaegertracing/all-in-one:latest

# Update blueprint-config.json
{
  "observability_enabled": true,
  "otel_exporter": "jaeger"
}

# Update secrets.env
OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces

# Restart service
systemctl --user restart mcp-context-forge.service

# Access Jaeger UI
# http://localhost:16686
```

---

## Security

### Production Checklist

- [ ] **Change all default passwords** in `secrets.env`
- [x] **PostgreSQL database** (configured by default)
- [ ] **Enable HTTPS** via Caddy/Tailscale
- [ ] **Set `SECURE_COOKIES=true`** (requires HTTPS)
- [ ] **Configure SSO** for user authentication
- [ ] **Use asymmetric JWT** (RS256/ES256, not HS256)
- [ ] **Set `ENVIRONMENT=production`** (configured by default)
- [ ] **Disable admin API** (`ADMIN_API_ENABLED=false`) if not needed
- [ ] **Enable observability** for monitoring
- [ ] **Regular backups** of PostgreSQL database volume
- [ ] **Review and limit** CORS allowed origins
- [ ] **Enable rate limiting** in Caddy (see caddy.njk)
- [ ] **Rotate JWT secret keys** periodically
- [ ] **Monitor logs** for suspicious activity

### Secrets Management

**Never commit secrets to version control!**

Store secrets in:
- `~/.config/mcp-context-forge/secrets.env` (local development)
- Environment variables (production)
- Secret management systems (Vault, AWS Secrets Manager, etc.)

### File Permissions

```bash
# Secure secrets file
chmod 600 ~/.config/mcp-context-forge/secrets.env

# Secure JWT private key (if using asymmetric)
chmod 600 ~/.config/mcp-context-forge/jwt/private.pem
chmod 644 ~/.config/mcp-context-forge/jwt/public.pem

# Data directory
chmod 700 ~/.local/share/mcp-context-forge
```

### Network Security

- MCP Context Forge listens on `127.0.0.1:4444` by default (localhost only)
- External access via Caddy reverse proxy with Tailscale (encrypted)
- All MCP servers communicate over internal `llm.network` (isolated)

---

## Troubleshooting

### Check Service Status

```bash
systemctl --user status mcp-context-forge.service
```

### View Logs

```bash
# Real-time logs
journalctl --user -u mcp-context-forge.service -f

# Recent logs
journalctl --user -u mcp-context-forge.service -n 100

# Logs since yesterday
journalctl --user -u mcp-context-forge.service --since yesterday
```

### Health Check

```bash
curl http://localhost:4444/health
```

**Expected response:**
```json
{
  "status": "ok",
  "version": "0.8.0",
  "timestamp": "2025-10-21T12:00:00Z"
}
```

### Common Issues

#### Service Won't Start

**Check directories exist:**
```bash
ls -la ~/.local/share/mcp-context-forge
ls -la ~/.config/mcp-context-forge
```

**Check secrets file exists:**
```bash
cat ~/.config/mcp-context-forge/secrets.env
```

**Check database:**
```bash
# Check PostgreSQL is running (default)
systemctl --user status mcp-context-forge-postgres.service

# Check PostgreSQL logs
journalctl --user -u mcp-context-forge-postgres.service -n 50

# Connect to database
podman exec -it mcp-context-forge-postgres psql -U mcp -d mcp
```

#### Cannot Login

**Reset admin password:**
```bash
# Generate new password
NEW_PASSWORD=$(openssl rand -base64 24)
echo "New password: $NEW_PASSWORD"

# Update secrets.env
sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$NEW_PASSWORD/" \
  ~/.config/mcp-context-forge/secrets.env

# Restart service
systemctl --user restart mcp-context-forge.service
```

#### Database Errors

**Reset database (⚠️ DELETES ALL DATA):**
```bash
# Stop both services
systemctl --user stop mcp-context-forge.service
systemctl --user stop mcp-context-forge-postgres.service

# Remove PostgreSQL volume
podman volume rm mcp-context-forge-postgres.volume

# Restart services (will recreate database)
systemctl --user start mcp-context-forge-postgres.service
systemctl --user start mcp-context-forge.service
```

#### MCP Servers Not Connecting

**Check network:**
```bash
podman network inspect llm.network
```

**Test server connectivity:**
```bash
# From inside MCP Context Forge container
podman exec -it mcp-context-forge curl http://mcp-server:8080/health
```

**Check server registration:**
```bash
# List registered gateways
curl http://localhost:4444/gateways \
  -H "Authorization: Bearer $TOKEN"
```

### Performance Issues

**Check database pool:**
```bash
# Increase pool size in secrets.env
DB_POOL_SIZE=400
DB_MAX_OVERFLOW=20

# Restart
systemctl --user restart mcp-context-forge.service
```

**Enable Redis caching:**
```json
{
  "redis_enabled": true,
  "requires": ["redis"]
}
```

---

## Documentation

### Official Resources

- **Official Docs:** https://ibm.github.io/mcp-context-forge/
- **GitHub Repository:** https://github.com/IBM/mcp-context-forge
- **Issues/Support:** https://github.com/IBM/mcp-context-forge/issues
- **MCP Specification:** https://spec.modelcontextprotocol.io/

### API Documentation

- **OpenAPI Spec:** http://localhost:4444/openapi.json
- **Interactive Docs:** http://localhost:4444/docs
- **ReDoc:** http://localhost:4444/redoc (if enabled)

### Example Workflows

#### Registering an MCP Server and Creating a Virtual Server

```bash
# 1. Get auth token
TOKEN=$(curl -X POST http://localhost:4444/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' | jq -r '.token')

# 2. Register filesystem MCP server
curl -X POST http://localhost:4444/gateways \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "filesystem",
    "url": "http://mcp-filesystem:8080/sse",
    "transport": "sse",
    "description": "Filesystem access tools"
  }'

# 3. Register git MCP server
curl -X POST http://localhost:4444/gateways \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "git",
    "url": "http://mcp-git:8080/sse",
    "transport": "sse",
    "description": "Git repository tools"
  }'

# 4. List available tools
curl -X GET http://localhost:4444/tools \
  -H "Authorization: Bearer $TOKEN"

# 5. Create virtual server with selected tools
curl -X POST http://localhost:4444/servers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "dev-tools",
    "associatedTools": ["filesystem_read", "filesystem_write", "git_status", "git_commit"],
    "description": "Development workflow tools"
  }'

# 6. Connect MCP client to virtual server
# SSE: http://localhost:4444/servers/dev-tools/sse
# WebSocket: ws://localhost:4444/servers/dev-tools/ws
```

#### Configuring A2A (Agent-to-Agent)

Allow external AI agents (OpenAI, Anthropic) to access your MCP tools:

```bash
# Enable A2A in blueprint-config.json
{
  "a2a_enabled": true
}

# Register an external agent
curl -X POST http://localhost:4444/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-openai-agent",
    "provider": "openai",
    "api_key": "sk-...",
    "model": "gpt-4",
    "allowed_tools": ["filesystem_read", "git_status"]
  }'

# Agent can now call MCP tools via OpenAI function calling
```

---

## License

MCP Context Forge is licensed under the Apache License 2.0.

See: https://github.com/IBM/mcp-context-forge/blob/main/LICENSE

---

## Support

For issues, questions, or feature requests:

- **GitHub Issues:** https://github.com/IBM/mcp-context-forge/issues
- **Discussions:** https://github.com/IBM/mcp-context-forge/discussions

---

**Built with MCP Context Forge 0.8.0**
