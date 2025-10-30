# Implementation Guide: Multi-Service Schema System

## Table of Contents

1. [Quick Start](#quick-start)
2. [Schema Validator](#schema-validator)
3. [Quadlet Generator](#quadlet-generator)
4. [UI Generator](#ui-generator)
5. [State Management](#state-management)
6. [Expression Evaluator](#expression-evaluator)
7. [Practical Examples](#practical-examples)

---

## Quick Start

### Step 1: Validate Your Topology

```python
import json
import jsonschema

# Load schema
with open('topology-schema.json') as f:
    schema = json.load(f)

# Load topology
with open('topology.json') as f:
    topology = json.load(f)

# Validate
try:
    jsonschema.validate(topology, schema)
    print("✓ Topology is valid")
except jsonschema.ValidationError as e:
    print(f"✗ Validation error: {e.message}")
```

### Step 2: Compute Enabled Services

```python
def evaluate_condition(condition, topology):
    """
    Evaluate conditions like:
    "openwebui.configuration.ENABLE_WEB_SEARCH == true"
    """
    # Parse: service.configuration.FIELD == value
    parts = condition.split(' == ')
    path = parts[0].strip()
    expected = eval(parts[1].strip())  # Simplified

    # Navigate topology
    segments = path.split('.')
    obj = topology
    for seg in segments:
        obj = obj.get(seg, {})

    return obj == expected

def get_enabled_services(topology):
    """Return set of services that should be running"""
    enabled = set()

    for service_name, service in topology['topology']['services'].items():
        infra = service['infrastructure']

        # Unconditionally enabled
        if infra.get('enabled', False):
            enabled.add(service_name)
            continue

        # Conditionally enabled (logical OR)
        for condition in infra.get('enabled_by', []):
            if evaluate_condition(condition, topology):
                enabled.add(service_name)
                break

    return enabled

# Usage
enabled = get_enabled_services(topology)
print(f"Enabled services: {enabled}")
```

### Step 3: Resolve Dependencies

```python
def topological_sort(topology, enabled_services):
    """
    Return services in dependency order (dependencies first)
    Raises exception if circular dependency detected
    """
    from collections import defaultdict, deque

    # Build dependency graph
    graph = defaultdict(list)
    in_degree = defaultdict(int)

    for service_name in enabled_services:
        service = topology['topology']['services'][service_name]
        requires = service['infrastructure'].get('requires', [])

        for dep in requires:
            if dep in enabled_services:
                graph[dep].append(service_name)
                in_degree[service_name] += 1

    # Kahn's algorithm
    queue = deque([s for s in enabled_services if in_degree[s] == 0])
    sorted_services = []

    while queue:
        service = queue.popleft()
        sorted_services.append(service)

        for dependent in graph[service]:
            in_degree[dependent] -= 1
            if in_degree[dependent] == 0:
                queue.append(dependent)

    # Check for cycles
    if len(sorted_services) != len(enabled_services):
        raise ValueError("Circular dependency detected")

    return sorted_services

# Usage
startup_order = topological_sort(topology, enabled)
print(f"Startup order: {startup_order}")
```

---

## Schema Validator

### Complete Validator Implementation

```python
class TopologyValidator:
    """Validates topology at field, service, and topology levels"""

    def __init__(self, topology):
        self.topology = topology
        self.errors = []
        self.warnings = []

    def validate(self):
        """Run all validation levels"""
        self.validate_field_level()
        self.validate_service_level()
        self.validate_topology_level()
        return len(self.errors) == 0

    # Field Level Validation

    def validate_field_level(self):
        """Validate individual configuration fields"""
        for service_name, service in self.topology['topology']['services'].items():
            config = service.get('configuration', {})
            properties = config.get('properties', {})

            for field_name, field_def in properties.items():
                self._validate_field(service_name, field_name, field_def)

    def _validate_field(self, service_name, field_name, field_def):
        """Validate single field definition"""
        # Check sensitive fields have secret references
        if field_def.get('x-sensitive', False):
            if not field_def.get('x-secret-ref'):
                self.warnings.append(
                    f"{service_name}.{field_name}: Sensitive field lacks x-secret-ref"
                )

    # Service Level Validation

    def validate_service_level(self):
        """Validate individual services"""
        for service_name, service in self.topology['topology']['services'].items():
            self._validate_service_dependencies(service_name, service)
            self._validate_service_ports(service_name, service)
            self._validate_service_healthcheck(service_name, service)

    def _validate_service_dependencies(self, service_name, service):
        """Ensure all required services exist"""
        requires = service['infrastructure'].get('requires', [])
        services = self.topology['topology']['services']

        for dep in requires:
            if dep not in services:
                self.errors.append(
                    f"{service_name}: Requires non-existent service '{dep}'"
                )

    def _validate_service_ports(self, service_name, service):
        """Check for port conflicts"""
        published = service['infrastructure'].get('published_port')
        if published is None:
            return

        # Check uniqueness
        for other_name, other_service in self.topology['topology']['services'].items():
            if other_name == service_name:
                continue

            other_port = other_service['infrastructure'].get('published_port')
            if other_port == published:
                self.errors.append(
                    f"Port conflict: {service_name} and {other_name} both use port {published}"
                )

    def _validate_service_healthcheck(self, service_name, service):
        """Warn if enabled service lacks healthcheck"""
        infra = service['infrastructure']
        enabled = infra.get('enabled', False) or len(infra.get('enabled_by', [])) > 0

        if enabled and not infra.get('healthcheck'):
            self.warnings.append(
                f"{service_name}: Enabled service lacks healthcheck"
            )

    # Topology Level Validation

    def validate_topology_level(self):
        """Validate cross-service relationships"""
        self._validate_no_circular_dependencies()
        self._validate_enablement_expressions()
        self._validate_field_references()
        self._validate_secret_references()

    def _validate_no_circular_dependencies(self):
        """Detect circular dependencies using DFS"""
        visited = set()
        rec_stack = set()

        def has_cycle(service_name, path=[]):
            visited.add(service_name)
            rec_stack.add(service_name)

            service = self.topology['topology']['services'][service_name]
            requires = service['infrastructure'].get('requires', [])

            for dep in requires:
                if dep not in visited:
                    if has_cycle(dep, path + [service_name]):
                        return True
                elif dep in rec_stack:
                    cycle = ' -> '.join(path + [service_name, dep])
                    self.errors.append(f"Circular dependency: {cycle}")
                    return True

            rec_stack.remove(service_name)
            return False

        for service in self.topology['topology']['services']:
            if service not in visited:
                has_cycle(service)

    def _validate_enablement_expressions(self):
        """Ensure enabled_by conditions reference valid fields"""
        for service_name, service in self.topology['topology']['services'].items():
            enabled_by = service['infrastructure'].get('enabled_by', [])

            for expression in enabled_by:
                self._validate_expression(service_name, expression)

    def _validate_expression(self, service_name, expression):
        """Validate expression references valid fields"""
        # Parse: "service.configuration.FIELD == value"
        try:
            field_path = expression.split(' == ')[0].strip()
            segments = field_path.split('.')

            if len(segments) < 3:
                self.errors.append(
                    f"{service_name}: Invalid expression '{expression}'"
                )
                return

            ref_service = segments[0]
            ref_field = segments[2]

            # Check service exists
            if ref_service not in self.topology['topology']['services']:
                self.errors.append(
                    f"{service_name}: Expression references non-existent service '{ref_service}'"
                )
                return

            # Check field exists
            config = self.topology['topology']['services'][ref_service].get('configuration', {})
            properties = config.get('properties', {})

            if ref_field not in properties:
                self.errors.append(
                    f"{service_name}: Expression references non-existent field '{ref_service}.{ref_field}'"
                )

        except Exception as e:
            self.errors.append(
                f"{service_name}: Malformed expression '{expression}': {e}"
            )

    def _validate_field_references(self):
        """Validate x-requires-field references"""
        for service_name, service in self.topology['topology']['services'].items():
            config = service.get('configuration', {})
            properties = config.get('properties', {})

            for field_name, field_def in properties.items():
                requires = field_def.get('x-requires-field')
                if requires:
                    self._validate_field_reference(service_name, field_name, requires)

    def _validate_field_reference(self, service_name, field_name, reference):
        """Check that referenced field exists"""
        segments = reference.split('.')
        if len(segments) < 2:
            self.errors.append(
                f"{service_name}.{field_name}: Invalid reference '{reference}'"
            )
            return

        ref_service = segments[0]
        ref_path = '.'.join(segments[1:])

        if ref_service not in self.topology['topology']['services']:
            self.errors.append(
                f"{service_name}.{field_name}: References non-existent service '{ref_service}'"
            )

    def _validate_secret_references(self):
        """Validate x-secret-ref points to existing secrets"""
        for service_name, service in self.topology['topology']['services'].items():
            config = service.get('configuration', {})
            properties = config.get('properties', {})

            for field_name, field_def in properties.items():
                secret_ref = field_def.get('x-secret-ref')
                if secret_ref:
                    self._validate_secret_reference(service_name, field_name, secret_ref)

    def _validate_secret_reference(self, service_name, field_name, reference):
        """Check that secret path exists"""
        # Parse: "secrets.api_keys.litellm_master"
        segments = reference.split('.')
        if segments[0] != 'secrets':
            self.errors.append(
                f"{service_name}.{field_name}: Secret reference must start with 'secrets.'"
            )
            return

        # Navigate secrets object
        obj = self.topology.get('secrets', {})
        for seg in segments[1:]:
            if seg not in obj:
                self.errors.append(
                    f"{service_name}.{field_name}: Secret '{reference}' does not exist"
                )
                return
            obj = obj[seg]

    def print_results(self):
        """Print validation results"""
        if self.errors:
            print("❌ ERRORS:")
            for error in self.errors:
                print(f"  • {error}")

        if self.warnings:
            print("⚠️  WARNINGS:")
            for warning in self.warnings:
                print(f"  • {warning}")

        if not self.errors and not self.warnings:
            print("✅ Validation passed with no errors or warnings")
        elif not self.errors:
            print(f"✅ Validation passed with {len(self.warnings)} warnings")
        else:
            print(f"❌ Validation failed with {len(self.errors)} errors, {len(self.warnings)} warnings")

# Usage
validator = TopologyValidator(topology)
if validator.validate():
    print("Topology is valid!")
else:
    validator.print_results()
```

---

## Quadlet Generator

### Generate Podman Quadlet Files from Topology

```python
class QuadletGenerator:
    """Generate Podman Quadlet .container files from topology"""

    def __init__(self, topology):
        self.topology = topology

    def generate_all(self, output_dir):
        """Generate quadlets for all enabled services"""
        enabled = get_enabled_services(self.topology)
        startup_order = topological_sort(self.topology, enabled)

        for service_name in startup_order:
            self.generate_service(service_name, output_dir)

    def generate_service(self, service_name, output_dir):
        """Generate .container file for a service"""
        service = self.topology['topology']['services'][service_name]
        infra = service['infrastructure']
        config = service.get('configuration', {})

        quadlet = []

        # [Unit]
        quadlet.append("[Unit]")
        quadlet.append(f"Description={infra.get('description', service_name)}")
        quadlet.append("After=network-online.target llm.network.service")
        quadlet.append("Requires=llm.network.service")

        requires = infra.get('requires', [])
        if requires:
            wants = ' '.join(f"{r}.service" for r in requires)
            quadlet.append(f"Wants={wants}")

        quadlet.append("")

        # [Container]
        quadlet.append("[Container]")
        quadlet.append(f"Image={infra['image']}")
        quadlet.append(f"ContainerName={infra['container_name']}")
        quadlet.append(f"Network={infra.get('network', 'llm.network')}")

        # Published port
        if infra.get('published_port'):
            bind = infra.get('bind', '0.0.0.0')
            quadlet.append(f"PublishPort={bind}:{infra['published_port']}:{infra['port']}")

        # Volumes
        for volume in infra.get('volumes', []):
            selinux = volume.get('selinux_label', 'Z')
            quadlet.append(f"Volume={volume['name']}:{volume['mount_path']}:{selinux}")

        # Environment variables from configuration
        for field_name, field_def in config.get('properties', {}).items():
            env_var = field_def.get('x-env-var')
            if env_var:
                default = field_def.get('default')
                if default is not None:
                    quadlet.append(f"Environment={env_var}={default}")

        # Healthcheck
        healthcheck = infra.get('healthcheck')
        if healthcheck:
            quadlet.append(f"HealthCmd={healthcheck['cmd']}")
            quadlet.append(f"HealthInterval={healthcheck.get('interval', '30s')}")
            quadlet.append(f"HealthTimeout={healthcheck.get('timeout', '5s')}")
            quadlet.append(f"HealthRetries={healthcheck.get('retries', 3)}")
            quadlet.append(f"HealthStartPeriod={healthcheck.get('start_period', '10s')}")

        quadlet.append("")

        # [Service]
        quadlet.append("[Service]")
        quadlet.append("Slice=llm.slice")
        quadlet.append("TimeoutStartSec=900")
        quadlet.append("Restart=on-failure")
        quadlet.append("RestartSec=10")
        quadlet.append("")

        # [Install]
        quadlet.append("[Install]")
        quadlet.append("WantedBy=scroll-session.target")

        # Write file
        filename = f"{output_dir}/{service_name}.container"
        with open(filename, 'w') as f:
            f.write('\n'.join(quadlet))

        print(f"Generated: {filename}")

# Usage
generator = QuadletGenerator(topology)
generator.generate_all('/tmp/quadlets')
```

---

## UI Generator

### Generate Web UI Forms from Configuration Schema

```python
def generate_ui_form(topology, service_name):
    """Generate HTML form for service configuration"""
    service = topology['topology']['services'][service_name]
    config = service.get('configuration', {})
    properties = config.get('properties', {})

    # Group by category
    by_category = {}
    for field_name, field_def in properties.items():
        category = field_def.get('x-category', 'General')
        if category not in by_category:
            by_category[category] = []
        by_category[category].append((field_name, field_def))

    # Sort within categories by x-display-order
    for category in by_category:
        by_category[category].sort(key=lambda x: x[1].get('x-display-order', 999))

    # Generate HTML
    html = [f"<h2>{service_name} Configuration</h2>"]

    for category, fields in sorted(by_category.items()):
        html.append(f"<h3>{category}</h3>")
        html.append("<div class='category'>")

        for field_name, field_def in fields:
            visibility = field_def.get('x-visibility', 'exposed')
            if visibility == 'hidden':
                continue

            field_html = generate_field_html(field_name, field_def)
            html.append(field_html)

        html.append("</div>")

    return '\n'.join(html)

def generate_field_html(field_name, field_def):
    """Generate HTML for a single field"""
    field_type = field_def['type']
    description = field_def.get('description', '')
    default = field_def.get('default', '')
    sensitive = field_def.get('x-sensitive', False)

    html = [f"<div class='field' data-field='{field_name}'>"]
    html.append(f"<label for='{field_name}'>{field_name}</label>")
    html.append(f"<span class='description'>{description}</span>")

    if field_type == 'boolean':
        checked = 'checked' if default else ''
        html.append(f"<input type='checkbox' id='{field_name}' name='{field_name}' {checked}>")

    elif 'enum' in field_def:
        html.append(f"<select id='{field_name}' name='{field_name}'>")
        for option in field_def['enum']:
            selected = 'selected' if option == default else ''
            html.append(f"<option value='{option}' {selected}>{option}</option>")
        html.append("</select>")

    else:
        input_type = 'password' if sensitive else 'text'
        html.append(f"<input type='{input_type}' id='{field_name}' name='{field_name}' value='{default}'>")

    # Add depends-on logic
    depends_on = field_def.get('x-depends-on')
    if depends_on:
        html.append(f"<script>")
        html.append(f"// Show only when {depends_on}")
        html.append(f"</script>")

    html.append("</div>")
    return '\n'.join(html)

# Usage
form_html = generate_ui_form(topology, 'openwebui')
print(form_html)
```

---

## Practical Examples

### Example 1: Add a New Conditional Service

```json
{
  "minio": {
    "infrastructure": {
      "image": "quay.io/minio/minio:latest",
      "container_name": "minio",
      "port": 9000,
      "published_port": 9000,
      "enabled_by": ["openwebui.configuration.STORAGE_PROVIDER == 'minio'"]
    },
    "configuration": {
      "type": "object",
      "properties": {
        "MINIO_ROOT_USER": {
          "type": "string",
          "default": "admin",
          "x-env-var": "MINIO_ROOT_USER"
        },
        "MINIO_ROOT_PASSWORD": {
          "type": "string",
          "x-env-var": "MINIO_ROOT_PASSWORD",
          "x-sensitive": true,
          "x-secret-ref": "secrets.storage.minio_password"
        }
      }
    }
  }
}
```

Then add to OpenWebUI configuration:

```json
{
  "STORAGE_PROVIDER": {
    "type": "string",
    "enum": ["local", "s3", "minio"],
    "x-affects-services": {
      "local": null,
      "s3": null,
      "minio": "minio"
    },
    "x-provider-fields": {
      "minio": ["MINIO_ENDPOINT", "MINIO_ACCESS_KEY"]
    }
  }
}
```

### Example 2: Validate and Generate

```python
# Load topology
with open('topology.json') as f:
    topology = json.load(f)

# Validate
validator = TopologyValidator(topology)
if not validator.validate():
    validator.print_results()
    exit(1)

# Compute enabled services
enabled = get_enabled_services(topology)
print(f"Enabled services: {', '.join(enabled)}")

# Get startup order
order = topological_sort(topology, enabled)
print(f"Startup order: {' → '.join(order)}")

# Generate quadlets
generator = QuadletGenerator(topology)
generator.generate_all('./output')
```

---

## Summary

This implementation guide provides:

1. **Validator**: Multi-level validation (field, service, topology)
2. **Generator**: Automatic quadlet file generation
3. **UI Generator**: Form generation from schema metadata
4. **Examples**: Practical patterns for common scenarios

Next steps:
- Integrate with Nunjucks templating
- Build state management layer
- Implement configuration diff tracking
- Create web UI for topology management
