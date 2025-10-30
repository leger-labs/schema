#!/usr/bin/env python3
"""
Topology-Level Validator

Implements extended validation rules beyond JSON Schema:
- Circular dependency detection
- Cross-service field reference validation
- Enablement expression validation
- Provider field consistency
- Port conflict detection
- Secret reference validation
"""

import json
import sys
import re
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple, Any
from collections import defaultdict, deque


class TopologyValidator:
    """Validates topology at field, service, and topology levels"""

    def __init__(self, topology: Dict):
        """
        Initialize validator with topology

        Args:
            topology: Topology dictionary
        """
        self.topology = topology
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.services = topology.get('topology', {}).get('services', {})

    def validate(self) -> bool:
        """
        Run all validation levels

        Returns:
            True if no errors, False otherwise
        """
        self.errors = []
        self.warnings = []

        self.validate_field_level()
        self.validate_service_level()
        self.validate_topology_level()

        return len(self.errors) == 0

    # =========================================================================
    # FIELD LEVEL VALIDATION
    # =========================================================================

    def validate_field_level(self):
        """Validate individual configuration fields"""
        for service_name, service in self.services.items():
            config = service.get('configuration', {})
            properties = config.get('properties', {})

            for field_name, field_def in properties.items():
                self._validate_field(service_name, field_name, field_def)

    def _validate_field(self, service_name: str, field_name: str, field_def: Dict):
        """Validate single field definition"""
        # Check sensitive fields have secret references
        if field_def.get('x-sensitive', False):
            if not field_def.get('x-secret-ref'):
                self.warnings.append(
                    f"{service_name}.{field_name}: Sensitive field lacks x-secret-ref"
                )

        # Check env var is defined if field should be exposed
        visibility = field_def.get('x-visibility', 'exposed')
        if visibility in ['exposed', 'advanced'] and not field_def.get('x-env-var'):
            self.warnings.append(
                f"{service_name}.{field_name}: Exposed field lacks x-env-var definition"
            )

    # =========================================================================
    # SERVICE LEVEL VALIDATION
    # =========================================================================

    def validate_service_level(self):
        """Validate individual services"""
        for service_name, service in self.services.items():
            self._validate_service_dependencies(service_name, service)
            self._validate_service_healthcheck(service_name, service)

        # Port validation needs to check across all services
        self._validate_service_ports()
        self._validate_container_names()

    def _validate_service_dependencies(self, service_name: str, service: Dict):
        """Ensure all required services exist"""
        requires = service['infrastructure'].get('requires', [])

        for dep in requires:
            if dep not in self.services:
                self.errors.append(
                    f"{service_name}: Requires non-existent service '{dep}'"
                )

    def _validate_service_ports(self):
        """Check for port conflicts"""
        port_map: Dict[int, List[str]] = defaultdict(list)

        for service_name, service in self.services.items():
            published = service['infrastructure'].get('published_port')
            if published is not None:
                port_map[published].append(service_name)

        # Report conflicts
        for port, services in port_map.items():
            if len(services) > 1:
                self.errors.append(
                    f"Port conflict: Port {port} is published by multiple services: {', '.join(services)}"
                )

    def _validate_container_names(self):
        """Check for container name conflicts"""
        name_map: Dict[str, List[str]] = defaultdict(list)

        for service_name, service in self.services.items():
            container_name = service['infrastructure'].get('container_name')
            if container_name:
                name_map[container_name].append(service_name)

        # Report conflicts
        for container_name, services in name_map.items():
            if len(services) > 1:
                self.errors.append(
                    f"Container name conflict: '{container_name}' is used by multiple services: {', '.join(services)}"
                )

    def _validate_service_healthcheck(self, service_name: str, service: Dict):
        """Warn if enabled service lacks healthcheck"""
        infra = service['infrastructure']
        enabled = infra.get('enabled', False) or len(infra.get('enabled_by', [])) > 0

        if enabled and not infra.get('healthcheck'):
            self.warnings.append(
                f"{service_name}: Enabled service lacks healthcheck"
            )

    # =========================================================================
    # TOPOLOGY LEVEL VALIDATION
    # =========================================================================

    def validate_topology_level(self):
        """Validate cross-service relationships"""
        self._validate_no_circular_dependencies()
        self._validate_enablement_expressions()
        self._validate_field_references()
        self._validate_secret_references()
        self._validate_provider_consistency()
        self._validate_service_enablement_references()

    def _validate_no_circular_dependencies(self):
        """Detect circular dependencies using DFS"""
        visited: Set[str] = set()
        rec_stack: Set[str] = set()

        def has_cycle(service_name: str, path: List[str] = None) -> bool:
            if path is None:
                path = []

            visited.add(service_name)
            rec_stack.add(service_name)

            if service_name not in self.services:
                return False

            service = self.services[service_name]
            requires = service['infrastructure'].get('requires', [])

            for dep in requires:
                if dep not in visited:
                    if has_cycle(dep, path + [service_name]):
                        return True
                elif dep in rec_stack:
                    cycle = ' -> '.join(path + [service_name, dep])
                    self.errors.append(f"Circular dependency detected: {cycle}")
                    return True

            rec_stack.remove(service_name)
            return False

        for service in self.services:
            if service not in visited:
                has_cycle(service)

    def _validate_enablement_expressions(self):
        """Ensure enabled_by conditions reference valid fields"""
        for service_name, service in self.services.items():
            enabled_by = service['infrastructure'].get('enabled_by', [])

            for expression in enabled_by:
                self._validate_expression(service_name, expression)

    def _validate_expression(self, service_name: str, expression: str):
        """
        Validate expression references valid fields

        Supports formats:
        - service.configuration.FIELD == value
        - service.configuration.FIELD != value
        """
        try:
            # Parse expression
            # Pattern: service.configuration.FIELD operator value
            match = re.match(r'^(\w+)\.configuration\.(\w+)\s*(==|!=)\s*(.+)$', expression)

            if not match:
                self.errors.append(
                    f"{service_name}: Invalid expression format '{expression}'"
                )
                return

            ref_service, ref_field, operator, value = match.groups()

            # Check service exists
            if ref_service not in self.services:
                self.errors.append(
                    f"{service_name}: Expression references non-existent service '{ref_service}'"
                )
                return

            # Check field exists
            config = self.services[ref_service].get('configuration', {})
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
        for service_name, service in self.services.items():
            config = service.get('configuration', {})
            properties = config.get('properties', {})

            for field_name, field_def in properties.items():
                requires = field_def.get('x-requires-field')
                if requires:
                    self._validate_field_reference(service_name, field_name, requires)

    def _validate_field_reference(self, service_name: str, field_name: str, reference: str):
        """Check that referenced field exists"""
        segments = reference.split('.')
        if len(segments) < 2:
            self.errors.append(
                f"{service_name}.{field_name}: Invalid reference format '{reference}'"
            )
            return

        ref_service = segments[0]

        # Check service exists
        if ref_service not in self.services:
            self.errors.append(
                f"{service_name}.{field_name}: References non-existent service '{ref_service}'"
            )
            return

        # Navigate to referenced field
        try:
            obj = self.services[ref_service]
            for seg in segments[1:]:
                obj = obj.get(seg, {})

            # Check if we reached a valid endpoint
            if not obj and segments[1] in ['infrastructure', 'configuration']:
                self.warnings.append(
                    f"{service_name}.{field_name}: Reference '{reference}' may not exist at runtime"
                )

        except (KeyError, AttributeError):
            self.warnings.append(
                f"{service_name}.{field_name}: Could not fully validate reference '{reference}'"
            )

    def _validate_secret_references(self):
        """Validate x-secret-ref points to existing secrets"""
        secrets = self.topology.get('secrets', {})

        for service_name, service in self.services.items():
            config = service.get('configuration', {})
            properties = config.get('properties', {})

            for field_name, field_def in properties.items():
                secret_ref = field_def.get('x-secret-ref')
                if secret_ref:
                    self._validate_secret_reference(
                        service_name, field_name, secret_ref, secrets
                    )

    def _validate_secret_reference(
        self, service_name: str, field_name: str, reference: str, secrets: Dict
    ):
        """Check that secret path exists"""
        # Parse: "secrets.api_keys.litellm_master"
        segments = reference.split('.')

        if segments[0] != 'secrets':
            self.errors.append(
                f"{service_name}.{field_name}: Secret reference must start with 'secrets.'"
            )
            return

        # Navigate secrets object
        obj = secrets
        for seg in segments[1:]:
            if not isinstance(obj, dict) or seg not in obj:
                self.errors.append(
                    f"{service_name}.{field_name}: Secret '{reference}' does not exist"
                )
                return
            obj = obj[seg]

    def _validate_provider_consistency(self):
        """Validate provider fields are consistent with x-provider-fields definitions"""
        for service_name, service in self.services.items():
            config = service.get('configuration', {})
            properties = config.get('properties', {})

            for field_name, field_def in properties.items():
                provider_fields = field_def.get('x-provider-fields')
                if provider_fields and isinstance(provider_fields, dict):
                    # Validate that referenced provider fields exist
                    for provider, fields in provider_fields.items():
                        for required_field in fields:
                            if required_field not in properties:
                                self.errors.append(
                                    f"{service_name}.{field_name}: Provider '{provider}' requires non-existent field '{required_field}'"
                                )

    def _validate_service_enablement_references(self):
        """Validate services referenced in x-enables-services and x-affects-services exist"""
        for service_name, service in self.services.items():
            config = service.get('configuration', {})
            properties = config.get('properties', {})

            for field_name, field_def in properties.items():
                # Check x-enables-services
                enables = field_def.get('x-enables-services', [])
                for enabled_service in enables:
                    if enabled_service not in self.services:
                        self.errors.append(
                            f"{service_name}.{field_name}: Enables non-existent service '{enabled_service}'"
                        )

                # Check x-affects-services
                affects = field_def.get('x-affects-services', {})
                if isinstance(affects, dict):
                    for provider, affected_service in affects.items():
                        if affected_service and affected_service not in self.services:
                            self.errors.append(
                                f"{service_name}.{field_name}: Affects non-existent service '{affected_service}'"
                            )

    # =========================================================================
    # UTILITY METHODS
    # =========================================================================

    def print_results(self, verbose: bool = False):
        """Print validation results"""
        if self.errors:
            print("❌ TOPOLOGY VALIDATION FAILED\n")
            print("Errors:")
            for error in self.errors:
                print(f"  • {error}")

        if self.warnings:
            print("\n⚠️  WARNINGS:")
            for warning in self.warnings:
                print(f"  • {warning}")

        if not self.errors and not self.warnings:
            print("✅ TOPOLOGY VALIDATION PASSED")
            print("All cross-service relationships are valid")

        elif not self.errors:
            print(f"\n✅ TOPOLOGY VALIDATION PASSED with {len(self.warnings)} warnings")

        if verbose and not self.errors:
            self._print_topology_summary()

    def _print_topology_summary(self):
        """Print summary of topology structure"""
        print("\n📊 TOPOLOGY SUMMARY:")
        print(f"  Services: {len(self.services)}")

        # Count enabled services
        enabled = sum(
            1 for s in self.services.values()
            if s['infrastructure'].get('enabled', False)
        )
        conditional = sum(
            1 for s in self.services.values()
            if s['infrastructure'].get('enabled_by', [])
        )

        print(f"  Enabled unconditionally: {enabled}")
        print(f"  Enabled conditionally: {conditional}")

        # Count published ports
        published = sum(
            1 for s in self.services.values()
            if s['infrastructure'].get('published_port') is not None
        )
        print(f"  Services with published ports: {published}")


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate topology cross-service relationships",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Validation Rules:
  • No circular dependencies
  • All service dependencies exist
  • All enablement expressions reference valid fields
  • All cross-service field references are valid
  • All secret references exist
  • No port or container name conflicts
  • Provider field consistency

Examples:
  %(prog)s topology.json
  %(prog)s topology.json --verbose
        """
    )

    parser.add_argument(
        'topology',
        help='Path to topology.json file to validate'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show verbose output with topology summary'
    )

    args = parser.parse_args()

    # Load topology
    try:
        with open(args.topology, 'r') as f:
            topology = json.load(f)
    except FileNotFoundError:
        print(f"Error: Topology file not found: {args.topology}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in topology file: {e}")
        sys.exit(1)

    # Validate
    validator = TopologyValidator(topology)
    valid = validator.validate()

    # Print results
    validator.print_results(verbose=args.verbose)

    # Exit with appropriate code
    sys.exit(0 if valid else 1)


if __name__ == '__main__':
    main()
