# Multi-Service Topology Schema v2.0 - Documentation Index

## Quick Reference

| Document | Purpose | Audience |
|----------|---------|----------|
| **[README.md](README.md)** | Overview, concepts, usage | Everyone |
| **[topology-schema.json](topology-schema.json)** | JSON Schema definition | Validators, generators |
| **[topology.json](topology.json)** | Example topology | Implementers |
| **[validation-rules.json](validation-rules.json)** | Validation algorithms | Validator implementers |
| **[DESIGN-PATTERNS.md](DESIGN-PATTERNS.md)** | Best practices, anti-patterns | Schema authors |
| **[IMPLEMENTATION-GUIDE.md](IMPLEMENTATION-GUIDE.md)** | Code examples, generators | Developers |
| **[MIGRATION-FROM-BLUEPRINT.md](MIGRATION-FROM-BLUEPRINT.md)** | Migration path | Project maintainers |

---

## Getting Started

### For Schema Authors

1. **Read**: [README.md](README.md) - Understand core concepts
2. **Study**: [topology.json](topology.json) - See example services
3. **Follow**: [DESIGN-PATTERNS.md](DESIGN-PATTERNS.md) - Apply best practices
4. **Validate**: Use JSON Schema validator with [topology-schema.json](topology-schema.json)

### For Implementers

1. **Read**: [IMPLEMENTATION-GUIDE.md](IMPLEMENTATION-GUIDE.md) - Get code examples
2. **Run**: Validator, generator, UI generator examples
3. **Extend**: Add custom validation rules from [validation-rules.json](validation-rules.json)

### For Project Maintainers

1. **Read**: [MIGRATION-FROM-BLUEPRINT.md](MIGRATION-FROM-BLUEPRINT.md) - Plan migration
2. **Validate**: Ensure compatibility
3. **Deploy**: Follow phase-based rollout

---

## Core Concepts (Quick Summary)

### Dual-Layer Architecture

Every service has two layers:

```
service_name
├── infrastructure (deployment)
│   ├── image, ports, network
│   ├── requires (dependencies)
│   └── enabled_by (conditions)
└── configuration (runtime)
    ├── environment variables
    ├── feature flags
    └── provider selection
```

### Key Metadata Extensions

| Extension | Purpose | Example |
|-----------|---------|---------|
| `x-env-var` | Environment variable name | `"WEBUI_NAME"` |
| `x-category` | UI grouping | `"Features"` |
| `x-display-order` | UI sort order | `1` |
| `x-visibility` | UI visibility level | `"exposed"` |
| `x-sensitive` | Mask in UI | `true` |
| `x-depends-on` | Conditional visibility | `{"ENABLE_FEATURE": true}` |
| `x-enables-services` | Services to enable | `["searxng", "searxng_redis"]` |
| `x-provider-fields` | Provider-specific fields | `{"searxng": ["SEARXNG_URL"]}` |
| `x-affects-services` | Provider → service map | `{"qdrant": "qdrant"}` |
| `x-requires-field` | Cross-service reference | `"litellm.configuration.KEY"` |
| `x-secret-ref` | Secret storage path | `"secrets.api_keys.key"` |
| `x-rationale` | Why this field exists | `"Improves compatibility..."` |

### Validation Levels

1. **Field**: Type, enum, pattern, range
2. **Service**: Dependencies, ports, container names
3. **Topology**: Circular deps, field references, enablement expressions
4. **Runtime**: Health checks, port availability

---

## Common Patterns (Quick Reference)

### Pattern 1: Feature Flag → Service

```json
{
  "ENABLE_FEATURE": {
    "type": "boolean",
    "x-enables-services": ["feature_service"]
  }
}
```

### Pattern 2: Provider Selection

```json
{
  "PROVIDER": {
    "enum": ["option_a", "option_b"],
    "x-affects-services": {
      "option_a": "service_a",
      "option_b": "service_b"
    },
    "x-provider-fields": {
      "option_a": ["FIELD_A"],
      "option_b": ["FIELD_B"]
    }
  }
}
```

### Pattern 3: Conditional Field

```json
{
  "CHILD_FIELD": {
    "type": "string",
    "x-depends-on": {"PARENT_FIELD": "value"}
  }
}
```

### Pattern 4: Secret Reference

```json
{
  "API_KEY": {
    "type": "string",
    "x-sensitive": true,
    "x-secret-ref": "secrets.api_keys.provider"
  }
}
```

### Pattern 5: Cross-Service Reference

```json
{
  "DATABASE_URL": {
    "type": "string",
    "x-requires-field": "postgres.infrastructure.container_name"
  }
}
```

---

## File Descriptions

### [topology-schema.json](topology-schema.json)

**JSON Schema definition** for validating topology files.

- Defines `service`, `infrastructure`, `configuration` objects
- Lists all `x-*` metadata extensions
- Provides validation rules for types, enums, patterns

**Usage**:
```python
import jsonschema
jsonschema.validate(topology, schema)
```

### [topology.json](topology.json)

**Example topology** with real services:
- OpenWebUI + PostgreSQL + Redis
- LiteLLM + PostgreSQL + Redis
- SearXNG + Redis (conditional)
- Qdrant (conditional)
- ComfyUI (conditional)

**Demonstrates**:
- Feature flags (web search, image generation)
- Provider selection (vector DB, search engine)
- Conditional enablement
- Cross-service configuration
- Secret references

### [validation-rules.json](validation-rules.json)

**Extended validation rules** beyond JSON Schema:
- Circular dependency detection
- Enablement expression validation
- Cross-service field reference checking
- Provider field consistency
- Secret reference validation

**Structure**:
```json
{
  "validation_levels": {
    "field_level": { "rules": [...] },
    "service_level": { "rules": [...] },
    "topology_level": { "rules": [...] },
    "runtime_level": { "rules": [...] }
  }
}
```

### [DESIGN-PATTERNS.md](DESIGN-PATTERNS.md)

**Best practices** for schema design:
- 8 common patterns
- Anti-patterns to avoid
- Real-world examples
- Pattern selection guide

**Key Sections**:
- Core Principles
- Pattern Catalog (8 patterns)
- Anti-Patterns (4 anti-patterns)
- Best Practices

### [IMPLEMENTATION-GUIDE.md](IMPLEMENTATION-GUIDE.md)

**Code examples** for:
- Schema validator (Python)
- Quadlet generator (Python)
- UI form generator (Python)
- Expression evaluator
- Dependency graph builder

**Includes**:
- Complete working code
- Practical examples
- Integration patterns

### [MIGRATION-FROM-BLUEPRINT.md](MIGRATION-FROM-BLUEPRINT.md)

**Migration path** from `blueprint-config.json`:
- Comparison: before/after
- Phase-based migration (6 weeks)
- Migration checklist
- Benefits summary

**Timeline**:
- Week 1: Infrastructure
- Week 2: Configuration schema
- Week 3-4: Metadata enrichment
- Week 5: Testing
- Week 6: Deployment

---

## Schema Features

### What This Schema Enables

✅ **Single Source of Truth**: One file defines infrastructure + configuration
✅ **Automatic Service Management**: Feature flags control service lifecycle
✅ **Provider Flexibility**: Easy to add/swap providers
✅ **Type Safety**: Multi-level validation catches errors early
✅ **UI Generation**: Forms generated from metadata
✅ **Documentation**: Embedded rationale and descriptions
✅ **State Tracking**: Know what's configured vs default
✅ **Cross-Service Validation**: Prevent invalid configurations

### What You Can Generate

From this schema, you can automatically generate:
- **Podman Quadlet files** (.container, .volume, .network)
- **Web UI forms** (from x-category, x-display-order, x-visibility)
- **Documentation** (from description, x-rationale)
- **Validation rules** (from types, enums, x-depends-on)
- **Dependency graphs** (from requires, enabled_by)
- **Secret templates** (from x-secret-ref)

---

## Quick Start Examples

### Example 1: Validate a Topology

```python
import json
import jsonschema

with open('topology-schema.json') as f:
    schema = json.load(f)

with open('topology.json') as f:
    topology = json.load(f)

try:
    jsonschema.validate(topology, schema)
    print("✓ Valid")
except jsonschema.ValidationError as e:
    print(f"✗ {e.message}")
```

### Example 2: Get Enabled Services

```python
def get_enabled_services(topology):
    enabled = set()
    for name, service in topology['topology']['services'].items():
        infra = service['infrastructure']
        if infra.get('enabled', False):
            enabled.add(name)
        # Check enabled_by conditions...
    return enabled

enabled = get_enabled_services(topology)
print(f"Enabled: {enabled}")
```

### Example 3: Generate Quadlet

```python
def generate_quadlet(service_name, service):
    lines = ["[Unit]"]
    lines.append(f"Description={service['infrastructure']['description']}")
    lines.append("")

    lines.append("[Container]")
    lines.append(f"Image={service['infrastructure']['image']}")
    # ... more fields

    return '\n'.join(lines)
```

---

## Next Steps

### Phase 1: Schema Definition ✅

- [x] Create topology-schema.json
- [x] Create example topology.json
- [x] Define validation rules
- [x] Document patterns and migration path

### Phase 2: Validation & Generation

- [ ] Implement JSON Schema validator
- [ ] Implement topology-level validator
- [ ] Build quadlet generator
- [ ] Build UI form generator
- [ ] Build documentation generator

### Phase 3: State Management

- [ ] Track configured vs default state
- [ ] Implement diff-based updates
- [ ] Generate migration paths between versions
- [ ] Conditional service lifecycle management

### Phase 4: Integration

- [ ] Migrate blueprint-config.json
- [ ] Update Nunjucks templates
- [ ] Build web UI for configuration
- [ ] Implement secret encryption/storage

---

## Support

### Questions?

1. **Schema design**: See [DESIGN-PATTERNS.md](DESIGN-PATTERNS.md)
2. **Implementation**: See [IMPLEMENTATION-GUIDE.md](IMPLEMENTATION-GUIDE.md)
3. **Migration**: See [MIGRATION-FROM-BLUEPRINT.md](MIGRATION-FROM-BLUEPRINT.md)

### Contributing

When adding new services:
1. Follow patterns in [DESIGN-PATTERNS.md](DESIGN-PATTERNS.md)
2. Validate with [topology-schema.json](topology-schema.json)
3. Run topology-level validation
4. Test quadlet generation

### Testing

```bash
# Validate schema
jsonschema -i topology.json topology-schema.json

# Validate topology
python validator.py topology.json

# Generate quadlets
python generator.py topology.json output/

# Run tests
pytest tests/
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Infrastructure** | Deployment layer (containers, networking, dependencies) |
| **Configuration** | Runtime layer (environment variables, feature flags) |
| **Provider** | Pluggable backend (e.g., vector DB, search engine) |
| **Enablement** | Conditions that determine if a service runs |
| **Topology** | Complete graph of services and their relationships |
| **Metadata Extension** | `x-*` fields that add semantic meaning |
| **Validation Level** | Scope of validation (field, service, topology, runtime) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-10-22 | Initial multi-service schema with dual-layer architecture |

---

## License

Same as parent project: `quadlet-setup`
