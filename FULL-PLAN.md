# V0.2.0 Strategic Implementation: Template Rendering & Configuration UI

## Executive Summary

### Core Transformation

You're migrating from a **Chezmoi-based local dotfile system** to a **Cloudflare-hosted configuration management platform** with server-side template rendering. This represents a fundamental architectural shift:

**Current State (v0.1.0):**
- Web UI manages secrets and GitHub repo URLs
- CLI clones from GitHub repositories
- Manual template management via Chezmoi locally
- No centralized configuration rendering

**Target State (v0.2.0):**
- Web UI provides declarative configuration interface (RJSF)
- Backend renders templates server-side (Nunjucks)
- R2 hosts rendered quadlets as git-cloneable repos
- CLI unchanged (still clones via git protocol)
- Semantic versioning drives entire release lifecycle

### What Gets Built

**Configuration Layer:**
- JSON Schema defining 50-100+ decision variables
- UI Schema controlling RJSF rendering behavior
- Default configurations and validation rules
- Hierarchical organization matching your sitemap structure

**Template Layer:**
- Base templates for inheritance (DRY principle)
- Macro library for reusable snippets
- Service-specific templates (20+ services)
- Conditional rendering based on configuration

**Rendering Layer:**
- Nunjucks engine in Cloudflare Workers
- Template loader from R2 or embedded
- Checksum generation for integrity
- Manifest creation for CLI consumption

**Publishing Layer:**
- R2 bucket structure per user/version
- Git-cloneable static sites
- Automatic "latest" pointer updates
- Public URLs for CLI access

**Version Control Layer:**
- Release-please automation across repos
- Conventional commits enforced
- Semantic version bumping
- Changelog generation
- GitHub releases with artifacts

---

## Phase 1: Schema Architecture & Variable Migration

### Conceptual Foundation

The JSON Schema becomes your **single source of truth specification**. Every variable that previously lived in your Chezmoi config file must be represented as a JSON Schema property with:

- Type definition (string, boolean, integer, array, object)
- Validation rules (pattern, min/max, enum)
- Required vs optional classification
- Default values
- Descriptions for UI help text
- Dependency relationships

### Schema Design Principles

**Hierarchical Organization:**
Your schema should mirror the sidebar navigation structure from your sitemap. Top-level keys represent major sections:
- General (project metadata)
- Infrastructure (network, services)
- AI Stack (LLM config, RAG, embeddings)
- Networking (domains, HTTPS, Caddy)
- Storage (volumes, databases)
- Security (authentication, secrets)
- Advanced (environment variables, custom config)

**Service Definition Pattern:**
Every service in your infrastructure follows a common schema pattern using JSON Schema definitions. Define a base service schema once, then reference it for each specific service. This includes:
- Enabled flag (boolean)
- Port configuration (internal + published)
- Bind address (localhost vs all interfaces)
- External subdomain (for Caddy routing)
- Resource limits (optional)
- Dependencies (array of service names)

**Conditional Dependencies:**
JSON Schema supports conditional logic via the dependencies keyword. Use this for:
- If RAG enabled, require embedding provider selection
- If HTTPS enabled, require certificate provider
- If custom auth, require additional credentials
- If GPU enabled, require device configuration

### Variable Extraction Strategy

**Audit Your Existing Templates:**
Scan all Chezmoi template files to identify every variable reference. Create a comprehensive mapping document showing:
- Original Chezmoi path (e.g., `.infrastructure.services.litellm.enabled`)
- New JSON Schema path (e.g., `infrastructure.services.litellm.enabled`)
- Data type and constraints
- Dependencies and related variables
- Default value and whether required

**Categorization:**
Group variables by domain:
- User identity (name, email, Tailscale info)
- System configuration (hostname, architecture, resources)
- Service toggles (enabled/disabled flags)
- Network configuration (subnets, ports, domains)
- Feature flags (RAG, web search, image generation)
- Provider selections (OpenAI, Anthropic, local)
- Model selections (which models to enable)

**Validation Rules:**
For each variable, determine appropriate validation:
- String patterns (regex for domain names, IP addresses)
- Numeric ranges (ports 1024-65535)
- Enum restrictions (provider choices)
- Array constraints (min/max items)
- Cross-field validation (if X enabled, Y required)

### UI Schema Design

The UI Schema controls **how RJSF renders** your JSON Schema. This includes:

**Widget Selection:**
Map schema types to your component library:
- Boolean → Switch or Checkbox
- String → TextField or TextArea
- String with enum → Select or Radio
- String with format:uri → URLInput
- String with format:password → SecretField
- Integer → NumberInput with up/down
- Array → Repeatable field groups

**Layout Control:**
Define field ordering, grouping, and visibility:
- Section ordering (top to bottom)
- Field ordering within sections
- Conditional display rules
- Placeholder text
- Help text positioning
- Inline vs stacked layout

**Advanced Features:**
- Repeatable array items with add/remove buttons
- Drag-to-reorder for ordered arrays
- Collapsible sections for complex objects
- Validation error display
- Auto-save indicators
- Progress tracking

---

## Phase 2: Template Conversion & Organization

### Template Repository Structure

**Three-Tier Architecture:**

**Tier 1 - Base Templates:**
Define common patterns that all specific templates inherit from. These establish the fundamental structure for:
- Container quadlets (unit definition, container config, service behavior)
- Network quadlets (subnet, gateway, options)
- Volume quadlets (driver, options, labels)

Using template inheritance eliminates duplication. Every service container extends the base container template, overriding only what's unique.

**Tier 2 - Macro Library:**
Reusable snippets that inject common functionality. Create macros for:
- Systemd unit definitions (dependencies, ordering)
- Podman features (port publishing, volume mounts, secrets)
- Caddy configurations (reverse proxy, TLS, headers)
- Health checks (command, interval, retries)
- Resource limits (memory, CPU)

Macros are imported and called within templates, not inherited. They represent discrete functionality.

**Tier 3 - Service Templates:**
Specific implementation for each service in your appstore. Each service gets its own directory containing:
- Container quadlet(s) - main service + dependencies
- Configuration files - rendered configs (YAML, ENV, etc.)
- Volume definitions - persistent storage
- Network definitions - if service-specific network needed

### Migration Strategy

**Identify Conversion Priorities:**
Start with your most complex services first, as they establish patterns for simpler ones:
1. Network definition (foundation for everything)
2. LiteLLM (complex dependencies, multiple containers, config files)
3. OpenWebUI (depends on LiteLLM, complex env vars)
4. Caddy (reverse proxy for all services)
5. Supporting services (Postgres, Redis, SearXNG)
6. Optional services (Jupyter, Ollama, Whisper)

**Syntax Transformation Patterns:**

**Variables:**
Chezmoi uses dot-prefix notation, Nunjucks uses clean names. All variable references change from `{{ .variable }}` to `{{ variable }}`.

**Conditionals:**
Chezmoi uses `if/else if/else/end` with special equality operators. Nunjucks uses standard `if/elif/else/endif` with Python-like syntax. The `eq` function becomes the `==` operator.

**Loops:**
Chezmoi's range syntax becomes Nunjucks for loops. Simple iteration over arrays and dictionary iteration both simplify. The special `.` context variable in Chezmoi becomes explicit item names in Nunjucks.

**Filters:**
Function-style filters in Chezmoi become pipe-style in Nunjucks. The syntax for default values, upper/lowercase, and length all shift to the pipe operator pattern.

**Template Inheritance:**
This is entirely new in Nunjucks. You'll wrap common patterns in base templates and use the extends keyword. Define blocks in base templates that child templates override. This is the biggest architectural improvement over Chezmoi.

**Macro Usage:**
Also new in Nunjucks. Extract repeated patterns into named macros, import them, and call them with parameters. This eliminates copy-paste between similar services.

### Service Template Patterns

**LiteLLM Example Architecture:**
The LiteLLM service demonstrates all key patterns:
- Extends base container template
- Imports macros for common operations
- Conditional rendering based on enabled models
- Dynamic environment variable injection
- Secret references via Podman secrets
- Volume mounts for persistence
- Health checks
- Dependency declaration on Postgres and Redis

The LiteLLM configuration file (YAML) is also templated. It iterates over the models array from the schema, rendering each enabled model with provider-specific configuration. This demonstrates Nunjucks rendering non-quadlet files.

**OpenWebUI Example Architecture:**
OpenWebUI shows conditional feature enablement:
- RAG configuration (enabled/disabled with provider selection)
- Web search integration (provider-dependent configuration)
- Code execution (requires Jupyter if enabled)
- Image generation (provider-specific env vars)
- Database connection string
- LiteLLM integration as upstream provider

Each feature block uses Nunjucks conditionals to include or exclude configuration based on schema values.

**Caddy Example Architecture:**
Caddy demonstrates macro-heavy templates:
- Import Caddy macros
- Iterate over all enabled services
- For each service with external_subdomain, call reverse proxy macro
- Macro generates complete reverse proxy block
- TLS configuration varies by cert provider
- Optional custom headers, rate limiting, etc.

### Base Template Design

**Container Base Template:**
The base container template defines the complete structure of a systemd quadlet file. It includes:
- Unit section with description, dependencies, ordering
- Container section with image, network, volumes, secrets
- Service section with restart policy, timeout
- Install section with target

Child templates override specific blocks:
- Container configuration block (image, environment, volumes)
- Service configuration block (custom startup scripts)

Everything else is inherited, ensuring consistency.

**Macro Library Design:**

**Systemd Macros:**
Standardize unit definitions across all services. A service unit macro takes name, description, and dependencies array. It renders the Unit section consistently.

**Podman Macros:**
Common container operations become one-line macro calls:
- Port publishing (bind address, external port, internal port)
- Volume mounting (volume name, container path, SELinux options)
- Secret injection (secret name, environment variable target)
- Health check (command, interval, timeout, retries)

**Caddy Macros:**
Reverse proxy configuration becomes standardized:
- Reverse proxy block (subdomain, tailnet, upstream port)
- TLS configuration (Let's Encrypt, ZeroSSL, Tailscale, custom)
- Header manipulation (CORS, security headers)

---

## Phase 3: Backend Rendering Engine

### Nunjucks Integration

**Environment Configuration:**
Configure Nunjucks for non-HTML rendering. Disable autoescape since you're generating configuration files, not HTML. Enable trim blocks and lstrip blocks for clean output formatting. Decide whether to throw on undefined variables or fail silently.

**Custom Filters:**
Implement essential filters that Nunjucks lacks:
- Default filter (like Jinja2) for fallback values
- Upper/lower case transformations
- JSON/YAML serialization for nested objects
- Length/count operations
- Type coercion if needed

**Template Loading Strategy:**

**Option 1 - Embedded Templates:**
For initial deployment, embed templates directly in Worker bundle. This simplifies distribution but requires Worker redeployment for template updates. Templates are hardcoded in a TypeScript object or imported as modules.

**Option 2 - R2 Dynamic Loading:**
For production flexibility, store templates in R2 and fetch on-demand. This allows template updates without Worker redeployment. Cache aggressively using Workers KV or memory. The R2 structure mirrors your repository structure.

**Option 3 - Hybrid Approach:**
Embed base templates and macros in Worker (stable, rarely changing). Load service-specific templates from R2 (frequently updated). This balances performance with flexibility.

### Rendering Pipeline

**Stage 1 - Template Discovery:**
Based on the configuration object and appstore manifest, determine which templates to render. Iterate through the manifest checking enabled flags in the configuration. Build a list of templates to process.

**Stage 2 - Dependency Resolution:**
Ensure templates are rendered in dependency order. If Service A depends on Service B, render B's templates first. This matters for cross-references and validation.

**Stage 3 - Context Preparation:**
The entire configuration object becomes the rendering context. No preprocessing needed - Nunjucks accesses nested properties naturally. Add any computed values (checksums, timestamps) to the context.

**Stage 4 - Rendering:**
For each template:
- Load template content
- Apply context
- Render to string
- Validate output (syntax check for quadlets)
- Compute checksum
- Store rendered content

**Stage 5 - Manifest Generation:**
Create the manifest.json file containing:
- Version number
- Creation timestamp
- List of all rendered files with paths, checksums, sizes
- Configuration checksum for traceability
- Required secrets list

### Error Handling

**Template Errors:**
Catch Nunjucks rendering errors and provide detailed feedback:
- Template path
- Line number
- Error message
- Context at time of error
- Suggested fix if possible

**Validation Errors:**
After rendering, validate output:
- Quadlet syntax (systemd format validation)
- YAML syntax for config files
- JSON syntax for manifests
- Required field presence
- Cross-reference integrity

**Rollback Strategy:**
If rendering fails mid-process:
- Don't publish partial results to R2
- Don't update D1 render status
- Return detailed error to frontend
- Preserve previous version if exists

---

## Phase 4: R2 Publication & Static Hosting

### Bucket Structure

**Per-User Versioned Storage:**
Each user gets a directory in R2. Within that directory, each configuration version gets its own subdirectory. The structure looks like:

```
{user_uuid}/
  v1/
    manifest.json
    llm.network
    litellm.container
    litellm-postgres.container
    openwebui.container
    config/
      litellm.yaml
      Caddyfile
  v2/
    [files]
  v3/
    [files]
  latest/
    redirect.json (points to current version)
```

**Version Incrementing:**
Each save creates a new version directory. Versions are sequential integers per user. The latest symlink always points to the highest version number.

**Git-Clone Compatibility:**
To make R2 content git-cloneable, you need a simple HTTP file structure. The CLI uses git's "dumb HTTP" protocol, which just needs the files available at predictable URLs. Run git update-server-info equivalent after each publish to generate refs/info files.

### Publishing Flow

**Upload Process:**
For each rendered file:
- Determine full R2 key (user/version/path)
- Set appropriate content type (text/plain for quadlets, application/yaml for configs)
- Add custom metadata (checksum, timestamp)
- Upload to R2
- Verify upload success

**Manifest Publishing:**
After all files uploaded:
- Generate complete manifest
- Include file list with checksums
- Upload manifest.json to version directory
- This becomes the CLI's source of truth

**Latest Pointer Update:**
After successful version publish:
- Create or update redirect.json in latest/ directory
- Contains version number and full URL
- CLI can fetch this to find current version
- Alternative: use R2 custom domains with redirects

### Static Site Access

**Public URL Structure:**
Files are accessible via static.leger.run domain (Cloudflare R2 public bucket or custom domain). URLs are predictable: `https://static.leger.run/{user_uuid}/v{N}/filename`

**Git Protocol Support:**
For git clone to work, you need:
- Standard file hierarchy (no zips or archives)
- HTTP GET support (R2 provides this)
- Optional: git update-server-info metadata files
- CORS headers configured for cross-origin access

**CDN Caching:**
Cloudflare's CDN caches R2 content globally. Set cache headers appropriately:
- Versioned content (v1, v2, etc.) - cache forever (immutable)
- Latest pointer - short TTL (5 minutes)
- Manifest files - moderate TTL (1 hour)

---

## Phase 5: Frontend RJSF Implementation

### Form Architecture

**Component Mapping:**
RJSF renders JSON Schema but needs to know which React component to use for each schema type. Create a custom widget mapping that connects schema types to your component library:

- Schema type:string → your TextField component
- Schema type:string with enum → your SelectField component  
- Schema type:boolean → your SwitchField component
- Schema format:uri → your URLInput component
- Schema format:password → your SecretField component

**Template Customization:**
RJSF provides template props for controlling layout. Override:
- FieldTemplate - wraps each individual field with label, description, error
- ObjectFieldTemplate - renders nested objects with sections
- ArrayFieldTemplate - renders arrays with add/remove/reorder controls
- ErrorListTemplate - displays validation errors

Your overrides inject your design system's styling and layout patterns.

**State Management:**

**Form Data:**
The entire configuration object lives in React state. RJSF manages this via the formData prop and onChange callback. On every field change, the entire object updates. Implement debounced auto-save to persist drafts to backend.

**Dirty State Tracking:**
Track which sections have unsaved changes. Compare current formData to last saved version. Show dirty indicators in sidebar navigation. Warn before navigating away from dirty forms.

**Validation State:**
RJSF validates against JSON Schema continuously. Extract validation errors and display them inline with fields. Show error count in sidebar sections. Prevent saving if critical errors exist.

### Sidebar Navigation

**Section Discovery:**
Dynamically generate sidebar navigation from JSON Schema structure. Top-level schema properties become main sections. Nested objects become subsections. Use schema titles for display names.

**Scroll Spy:**
Track scroll position in the main form area. Highlight the active section in sidebar based on which part of form is visible. Clicking sidebar links scrolls smoothly to that section using hash anchors.

**Progress Tracking:**
Calculate completion percentage:
- Count total fields in schema
- Count filled fields in formData
- Count required vs optional separately
- Display progress bar in sidebar
- Show remaining required fields

**Validation Summary:**
For each section, show validation status:
- Green check if all fields valid
- Warning icon if optional fields missing
- Error icon if required fields missing
- Count of errors per section

### Auto-Save Implementation

**Debounced Persistence:**
Don't save on every keystroke. Use debounced callback (2 second delay). After user stops typing, automatically save draft to backend. Show "saving..." indicator during save. Show "saved" confirmation when complete.

**Draft Storage:**
Drafts are stored in D1 configurations table with special draft flag. Each save increments version number but doesn't trigger rendering. User can have multiple draft versions.

**Conflict Resolution:**
If user opens form in multiple tabs, last save wins. Future enhancement could detect conflicts and offer merge options. For now, show warning if form data changed since last load.

### Marketplace Integration

**Context-Aware Prompts:**
Based on what user has configured, suggest relevant marketplace integrations. If RAG enabled but no vector database selected, prompt for ChromaDB/Qdrant. If code execution enabled but no Jupyter, suggest it.

**Overlay Pattern:**
Marketplace overlay appears on top of configuration form without navigating away. User can browse, filter, view details. When installing integration, it modifies current formData in place. Overlay closes, form shows new service section.

**Installation Flow:**
When user clicks install on integration:
- Fetch integration metadata (required config, dependencies)
- Merge integration defaults into current formData
- Enable service in infrastructure.services section
- Add any required secrets to security section
- Scroll to newly added service section
- Show success message with next steps

---

## Phase 6: Appstore Expansion

### Service Addition Strategy

**Prioritization Framework:**
Determine which services to add based on:
- User demand (what do you personally need?)
- Ecosystem integration (what enhances existing services?)
- Complexity level (start simple, add complex later)
- Dependencies (services that enable other services)

**Service Categories:**

**AI & Machine Learning:**
- Ollama (local LLM inference)
- LocalAI (OpenAI-compatible local API)
- Langfuse (LLM observability)
- Flowise (visual LLM workflow builder)
- Anything LLM (document processing)

**Vector Databases:**
- ChromaDB (simple, Python-based)
- Qdrant (Rust-based, performant)
- Milvus (enterprise-grade)
- Weaviate (GraphQL interface)

**Development Tools:**
- Jupyter (code execution, data science)
- code-server (VS Code in browser)
- n8n (workflow automation)
- Gitea (self-hosted Git)

**Data & Storage:**
- PostgreSQL (relational database)
- Redis (caching, pub/sub)
- MinIO (S3-compatible object storage)
- Valkey (Redis fork)

**Monitoring & Observability:**
- Grafana (visualization)
- Prometheus (metrics)
- Loki (log aggregation)
- Uptime Kuma (uptime monitoring)

**Networking & Security:**
- Caddy (reverse proxy) - already have this
- Traefik (alternative reverse proxy)
- Authentik (identity provider)
- Vaultwarden (password manager)

### Template Patterns for New Services

**Simple Stateless Service:**
Services without persistent data or dependencies follow a minimal pattern:
- Single container quadlet
- Optional environment variables
- Port publishing if external access needed
- Health check
- That's it

Example: Edge TTS service for text-to-speech.

**Stateful Service with Volume:**
Services needing persistent storage add:
- Volume quadlet definition
- Volume mount in container quadlet
- Backup considerations in documentation
- Volume in manifest

Example: Jupyter with workspace persistence.

**Multi-Container Service:**
Services requiring multiple containers (main + database + cache):
- Separate quadlet for each container
- Pod definition to group containers
- Shared network within pod
- Dependencies ensure startup order
- Configuration file coordination

Example: n8n with Postgres database.

**Configuration-Heavy Service:**
Services with complex configuration files:
- Main container quadlet
- Configuration file template (YAML/JSON/TOML)
- ConfigMap or volume mount for config
- Validation of rendered config
- Documentation of configuration options

Example: Prometheus with scrape configs.

### Service Catalog Metadata

For each service, define catalog entry with:

**Identity:**
- Unique ID (slug)
- Display name
- Category
- Icon URL
- Homepage URL
- Description (short and long)

**Technical:**
- Container image repository
- Default version/tag
- Required secrets list
- Optional secrets list
- Dependency array
- Port requirements
- Resource recommendations (CPU, RAM)

**Verification:**
- Verified badge (your approval)
- Installation count
- Last updated timestamp
- Compatibility notes
- Known issues

**Documentation:**
- README content
- Configuration guide
- Integration examples
- Troubleshooting tips

This metadata powers the marketplace UI in Phase 4.

---

## Phase 7: Version Control Integration

### Release-Please Architecture

**Multi-Repository Strategy:**
You have multiple repos in legerlabs org:
- leger (CLI + daemon)
- web (React SPA)
- appstore (templates + schema)
- docs (Starlight documentation)
- blueprint (OS builder)

Each repo gets its own release-please workflow with independent semantic versioning.

### Conventional Commits Enforcement

**Commit Format:**
Every commit must follow conventional commit specification:
- Type prefix (feat, fix, docs, chore, refactor)
- Optional scope in parentheses
- Required description
- Optional body and footer

**Type Definitions:**
- feat - New feature (triggers minor bump)
- fix - Bug fix (triggers patch bump)
- docs - Documentation only
- style - Code style changes
- refactor - Code refactoring
- perf - Performance improvements
- test - Adding tests
- chore - Maintenance tasks

**Breaking Changes:**
Add exclamation mark after type or BREAKING CHANGE in footer to trigger major version bump. Example: `feat!: redesign schema structure`

**Issue References:**
Every commit should reference an issue. Format: `feat(templates): add ollama support (#123)`. This creates automatic linking in changelogs.

### GitHub Actions Workflows

**Semantic PR Title Validation:**
Create workflow that runs on PR events. Validates PR title follows conventional format. Blocks merge if title invalid. Provides helpful error messages with examples.

**Release Please Workflow:**
Runs on push to main branch. Scans commits since last release. Determines version bump based on commit types. Creates or updates release PR. Release PR includes:
- Version bump in package.json (if applicable)
- Updated CHANGELOG.md
- Git tag creation on merge

**CI/CD Integration:**
When release PR merges:
- GitHub creates release with tag
- Triggers deployment workflow
- Builds artifacts (CLI binaries, container images)
- Publishes to distribution channels
- Updates documentation

### Cross-Repository Coordination

**Appstore Template Versioning:**
When templates change, bump appstore version. CLI can specify appstore version compatibility. Schema version tracked separately from implementation version.

**Schema Migrations:**
When JSON Schema changes significantly:
- Increment schema version field
- Provide migration guide in changelog
- Backend supports multiple schema versions
- Old configurations auto-upgrade on load

**Changelog Aggregation:**
Your changelog site (Astro Starlog) pulls from all repos. Configure loader to fetch:
- legerlabs/leger releases
- legerlabs/web releases  
- legerlabs/appstore releases
- legerlabs/docs releases

Display unified timeline showing all releases across projects.

### Version Coordination Strategy

**Semantic Versioning Alignment:**
All repos start at v0.x.x during development. Core repos (leger, web) should stay synchronized on minor versions. Appstore can version independently based on template changes.

**Breaking Change Coordination:**
If schema changes break CLI compatibility:
- Major bump in appstore
- Major or minor bump in CLI (depends on implementation)
- Clear migration guide in both repos
- Version compatibility matrix in docs

**Release Cadence:**
Don't mandate fixed release schedule. Release when significant changes accumulate. Use draft releases for internal milestones. Public releases when stable and tested.

---

## Phase 8: Testing Strategy

### Schema Validation Testing

**Schema Correctness:**
Validate JSON Schema itself is valid JSON Schema. Use AJV or similar validator. Test that all references resolve. Verify no circular dependencies.

**Example Configuration Testing:**
Maintain example configurations that exercise all schema paths. Validate examples against schema. Use examples as integration test fixtures. Document examples as reference implementations.

**Edge Case Coverage:**
Test schema with:
- Minimum required fields only
- All optional fields filled
- Maximum nesting depth
- Array limits (empty, single item, max items)
- Invalid values (should fail validation)
- Missing required fields (should fail validation)

### Template Rendering Testing

**Unit Tests per Template:**
For each template:
- Test with minimal valid context
- Test with maximal context (all features enabled)
- Test with various feature combinations
- Verify output syntax (quadlet, YAML, etc.)
- Check variable substitution
- Validate conditional logic

**Integration Tests:**
Full rendering pipeline test:
- Load complete configuration
- Render all templates
- Verify file count matches manifest
- Check checksums
- Validate no rendering errors
- Confirm output structure

**Regression Testing:**
Maintain snapshot tests of rendered output. When template changes, compare new output to snapshots. Flag unexpected changes. Update snapshots when changes intentional.

### End-to-End Flow Testing

**Configuration → Rendering:**
Test complete flow:
- User saves configuration via API
- Backend triggers rendering
- Templates render successfully
- Files upload to R2
- Manifest generates
- Latest pointer updates
- Public URL accessible

**CLI Deployment:**
Test from CLI perspective:
- CLI fetches release metadata
- CLI clones from R2 URL
- Quadlets extract correctly
- File checksums match manifest
- Secrets referenced properly
- Systemd accepts quadlets

**Service Startup:**
Test actual deployment:
- Systemd daemon-reload succeeds
- Services start in dependency order
- Health checks pass
- Services accessible on expected ports
- Cross-service communication works
- Secrets injected properly

### Manual QA Checklist

**Configuration UI:**
- Form renders all sections
- Field validation works
- Auto-save functions
- Dirty state tracking accurate
- Error messages helpful
- Progress indicator correct

**Rendering:**
- All enabled services render
- Disabled services skip
- Conditional features work
- Dependencies respect
- Checksums consistent
- Manifests complete

**Deployment:**
- CLI clone succeeds
- Files install correctly
- Services start successfully
- Access via Caddy works
- Tailscale integration functions
- Secrets accessible

---

## Phase 9: Documentation & User Guides

### Schema Documentation

**Auto-Generated Reference:**
Generate documentation from JSON Schema automatically. For each property:
- Path (dotted notation)
- Type and constraints
- Description
- Default value
- Required/optional
- Examples

Use tools like json-schema-for-humans or build custom generator.

**Configuration Guide:**
Written guide explaining:
- Overall configuration structure
- Decision variable categories
- Common configuration patterns
- Best practices
- Troubleshooting

**Migration Guide:**
For users with existing Chezmoi configs:
- Mapping table (Chezmoi → JSON Schema)
- Automated migration script
- Manual review checklist
- Validation steps

### Template Documentation

**Template Reference:**
Document each template:
- Purpose and output
- Required context variables
- Optional context variables
- Dependencies
- Examples with different configurations
- Customization points

**Template Development Guide:**
For contributors adding new services:
- Template inheritance patterns
- Macro usage guide
- Conditional rendering best practices
- Testing requirements
- Submission process

### User Documentation

**Getting Started:**
Quick start guide covering:
- Initial account setup
- First configuration
- Basic customization
- First deployment
- Verification steps

**Service Catalog:**
For each service in appstore:
- Service description
- Use cases
- Configuration options
- Required secrets
- Dependencies
- Integration examples

**Deployment Guide:**
CLI-focused guide:
- Installation
- Authentication
- Release management
- Secret syncing
- Deployment process
- Update process
- Rollback process

**Troubleshooting:**
Common issues and solutions:
- Template rendering errors
- Deployment failures
- Service startup issues
- Network connectivity
- Secret access problems
- Version conflicts

---

## Critical Success Factors

### Architecture Quality

**Single Source of Truth:**
The JSON Schema is authoritative. Everything derives from it:
- Frontend UI (RJSF rendering)
- Backend validation
- Documentation generation
- Migration tooling
- Testing fixtures

Never let configuration exist outside schema definition.

**DRY Principle:**
Template inheritance and macros eliminate duplication. If you find yourself copying configuration blocks, extract to:
- Base template (for structural patterns)
- Macro (for functional patterns)
- Helper function (for computation)

**Separation of Concerns:**
Configuration (what) separate from rendering (how):
- Schema defines what can be configured
- Templates define how configuration renders
- UI Schema defines how configuration displays
- Backend engine coordinates rendering

### User Experience

**Progressive Disclosure:**
Don't overwhelm users with all 50-100 variables at once:
- Logical section grouping
- Collapsible sections
- Conditional field display
- Smart defaults
- Helpful descriptions
- Example values

**Validation Feedback:**
Real-time validation without being annoying:
- Validate on blur, not keystroke
- Show errors inline near fields
- Summarize errors in sidebar
- Prevent saving with critical errors
- Allow saving drafts with warnings

**Performance:**
Large forms can be slow:
- Debounce validation
- Lazy load sections
- Optimize re-renders
- Cache rendered templates
- Compress R2 responses

### Reliability

**Atomic Operations:**
Rendering and publishing must be atomic:
- Either all files render successfully or none publish
- Don't leave partial versions in R2
- Rollback on any failure
- Clear error messages

**Version Integrity:**
Ensure version consistency:
- Checksums prevent corruption
- Manifests track exact state
- Git-style content addressing
- Immutable published versions

**Backward Compatibility:**
Schema evolution must maintain compatibility:
- Additive changes (new optional fields) - safe
- Removing fields - requires major version
- Changing types - requires migration
- Changing defaults - document carefully

---

## Implementation Sequencing

### Foundation Phase

Start with infrastructure that everything depends on:
1. JSON Schema design (complete structure)
2. UI Schema definition (RJSF configuration)
3. Example configurations (validation)
4. Schema documentation generation

Don't write any templates until schema is stable.

### Template Migration Phase

Convert existing Chezmoi templates systematically:
1. Create base templates first
2. Build macro library
3. Convert network definition
4. Convert complex services (LiteLLM)
5. Convert dependent services (OpenWebUI)
6. Convert supporting services
7. Batch convert remaining services
8. Validate all outputs

### Backend Implementation Phase

Build rendering engine:
1. Nunjucks environment setup
2. Custom filters
3. Template loader
4. Renderer pipeline
5. R2 publisher
6. API endpoints
7. Error handling

### Frontend Integration Phase

Connect UI to backend:
1. RJSF component mapping
2. Custom templates
3. Form page implementation
4. Sidebar navigation
5. Auto-save logic
6. Validation display
7. Marketplace integration

### Appstore Expansion Phase

Add services beyond baseline:
1. Define service catalog structure
2. Create additional service templates
3. Build marketplace UI
4. Implement service discovery
5. Add installation flow
6. Document each service

### Version Control Phase

Implement release automation:
1. Set up conventional commits
2. Add semantic PR validation
3. Configure release-please
4. Set up cross-repo changelog
5. Create deployment workflows
6. Document release process

### Testing & Validation Phase

Verify everything works:
1. Unit test individual components
2. Integration test pipelines
3. End-to-end test flows
4. Manual QA across browsers
5. Performance testing
6. Load testing R2/Workers

### Documentation Phase

Make it accessible:
1. Generate schema reference docs
2. Write configuration guide
3. Create template guide
4. Document each service
5. Write deployment guide
6. Create troubleshooting guide
7. Record video walkthroughs

---

## Post-Implementation Roadmap

### Near-Term Enhancements

**Configuration Presets:**
Offer pre-built configurations:
- Minimal setup (LiteLLM + OpenWebUI only)
- Full AI stack (all services enabled)
- Development setup (code execution, tools)
- Production setup (monitoring, backups)

Users can start from preset and customize.

**Template Marketplace:**
Allow community contributions:
- GitHub PR workflow for new templates
- Review process for quality
- Version tracking per template
- Community ratings/feedback

**Visual Configuration:**
Supplement form with visual tools:
- Service dependency graph
- Resource utilization estimator
- Port conflict detector
- Architecture diagram generator

### Medium-Term Features

**Configuration Diffing:**
Show changes between versions:
- What fields changed
- Impact analysis (which services affected)
- Rollback simulation
- Upgrade path visualization

**Deployment Tracking:**
Monitor deployed configurations:
- Which version deployed where
- Deployment history timeline
- Success/failure tracking
- Performance metrics

**Multi-Environment Support:**
Manage multiple deployments:
- Development/staging/production configs
- Environment-specific overrides
- Promotion workflows
- Sync status across environments

### Long-Term Vision

**Collaborative Configuration:**
Team features:
- Shared configurations
- Permission management
- Audit logging
- Review/approval workflows

**AI-Assisted Configuration:**
Smart configuration help:
- Recommendation engine (based on usage patterns)
- Anomaly detection (unusual configurations)
- Optimization suggestions
- Security scanning

**Ecosystem Integration:**
Connect with broader ecosystem:
- Import from Docker Compose
- Export to Kubernetes
- Integration with Terraform
- CloudFormation compatibility

---

This strategic roadmap provides the complete picture of your v0.2.0 transformation without artificial timelines. Each phase builds on previous phases, and the sequence matters. The version control integration with release-please threads through every component, ensuring professional release management from day one.
