#!/usr/bin/env python3
"""
Documentation Generator

Generates markdown documentation from topology:
- Service catalog with descriptions
- Configuration field reference
- Dependency graph documentation
- Provider selection guide
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Set, Optional, Any
from collections import defaultdict


class DocGenerator:
    """Generate documentation from topology"""

    def __init__(self, topology: Dict):
        """
        Initialize generator with topology

        Args:
            topology: Topology dictionary
        """
        self.topology = topology
        self.services = topology.get('topology', {}).get('services', {})
        self.network = topology.get('topology', {}).get('network', {})

    def generate_all(self, output_dir: str):
        """
        Generate all documentation

        Args:
            output_dir: Directory to write documentation files
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Generate service catalog
        self.generate_service_catalog(output_path)

        # Generate configuration reference
        self.generate_configuration_reference(output_path)

        # Generate dependency graph
        self.generate_dependency_graph(output_path)

        # Generate provider guide
        self.generate_provider_guide(output_path)

        print(f"✅ Generated documentation in {output_dir}/")

    def generate_service_catalog(self, output_dir: Path):
        """Generate service catalog documentation"""
        lines = [
            "# Service Catalog",
            "",
            "Complete catalog of all services in the topology.",
            "",
        ]

        # Group services by type
        main_services = []
        database_services = []
        cache_services = []
        conditional_services = []

        for service_name, service in sorted(self.services.items()):
            infra = service['infrastructure']

            if 'postgres' in service_name:
                database_services.append((service_name, service))
            elif 'redis' in service_name:
                cache_services.append((service_name, service))
            elif infra.get('enabled_by'):
                conditional_services.append((service_name, service))
            else:
                main_services.append((service_name, service))

        # Main services
        if main_services:
            lines.append("## Core Services")
            lines.append("")
            for service_name, service in main_services:
                lines.extend(self._format_service_entry(service_name, service))

        # Conditional services
        if conditional_services:
            lines.append("## Conditional Services")
            lines.append("")
            lines.append("These services are enabled based on configuration choices.")
            lines.append("")
            for service_name, service in conditional_services:
                lines.extend(self._format_service_entry(service_name, service))

        # Database services
        if database_services:
            lines.append("## Database Services")
            lines.append("")
            for service_name, service in database_services:
                lines.extend(self._format_service_entry(service_name, service))

        # Cache services
        if cache_services:
            lines.append("## Cache Services")
            lines.append("")
            for service_name, service in cache_services:
                lines.extend(self._format_service_entry(service_name, service))

        # Write file
        filename = output_dir / "SERVICE-CATALOG.md"
        with open(filename, 'w') as f:
            f.write('\n'.join(lines))

        print(f"Generated: {filename}")

    def _format_service_entry(self, service_name: str, service: Dict) -> List[str]:
        """Format a single service entry"""
        infra = service['infrastructure']
        lines = []

        lines.append(f"### {service_name}")
        lines.append("")
        lines.append(f"**Description**: {infra.get('description', 'No description')}")
        lines.append("")
        lines.append(f"- **Image**: `{infra['image']}`")
        lines.append(f"- **Container Name**: `{infra['container_name']}`")

        # Port info
        if infra.get('published_port') is not None:
            lines.append(f"- **Published Port**: {infra['published_port']} → {infra['port']}")
        else:
            lines.append(f"- **Internal Port**: {infra['port']} (not published)")

        # Dependencies
        requires = infra.get('requires', [])
        if requires:
            lines.append(f"- **Dependencies**: {', '.join(f'`{r}`' for r in requires)}")

        # Enablement
        if infra.get('enabled', False):
            lines.append("- **Enabled**: Unconditionally")
        elif infra.get('enabled_by'):
            lines.append("- **Enabled When**:")
            for condition in infra['enabled_by']:
                lines.append(f"  - `{condition}`")

        # External access
        if infra.get('external_subdomain'):
            lines.append(f"- **External Access**: `{infra['external_subdomain']}.*.ts.net`")

        lines.append("")

        return lines

    def generate_configuration_reference(self, output_dir: Path):
        """Generate configuration field reference"""
        lines = [
            "# Configuration Reference",
            "",
            "Complete reference of all configuration fields organized by service and category.",
            "",
        ]

        for service_name, service in sorted(self.services.items()):
            config = service.get('configuration', {})
            properties = config.get('properties', {})

            if not properties:
                continue

            lines.append(f"## {service_name}")
            lines.append("")

            # Group by category
            by_category = defaultdict(list)
            for field_name, field_def in properties.items():
                category = field_def.get('x-category', 'General')
                by_category[category].append((field_name, field_def))

            # Sort by display order within categories
            for category in by_category:
                by_category[category].sort(key=lambda x: x[1].get('x-display-order', 999))

            # Output by category
            for category in sorted(by_category.keys()):
                lines.append(f"### {category}")
                lines.append("")

                for field_name, field_def in by_category[category]:
                    lines.extend(self._format_field_entry(field_name, field_def))

        # Write file
        filename = output_dir / "CONFIGURATION-REFERENCE.md"
        with open(filename, 'w') as f:
            f.write('\n'.join(lines))

        print(f"Generated: {filename}")

    def _format_field_entry(self, field_name: str, field_def: Dict) -> List[str]:
        """Format a single field entry"""
        lines = []

        lines.append(f"#### `{field_name}`")
        lines.append("")
        lines.append(field_def.get('description', 'No description'))
        lines.append("")

        # Type and default
        field_type = field_def.get('type', 'unknown')
        lines.append(f"- **Type**: `{field_type}`")

        if 'default' in field_def:
            default = field_def['default']
            if field_def.get('x-sensitive'):
                lines.append(f"- **Default**: `<sensitive>`")
            else:
                lines.append(f"- **Default**: `{default}`")

        # Enum values
        if 'enum' in field_def:
            enum_values = ', '.join(f'`{v}`' for v in field_def['enum'])
            lines.append(f"- **Allowed Values**: {enum_values}")

        # Visibility
        visibility = field_def.get('x-visibility', 'exposed')
        if visibility != 'exposed':
            lines.append(f"- **Visibility**: {visibility}")

        # Conditional visibility
        depends_on = field_def.get('x-depends-on')
        if depends_on:
            conditions = ', '.join(f'{k}={v}' for k, v in depends_on.items())
            lines.append(f"- **Shown When**: {conditions}")

        # Environment variable
        env_var = field_def.get('x-env-var')
        if env_var:
            lines.append(f"- **Environment Variable**: `{env_var}`")

        # Rationale
        rationale = field_def.get('x-rationale')
        if rationale:
            lines.append(f"- **Rationale**: {rationale}")

        lines.append("")

        return lines

    def generate_dependency_graph(self, output_dir: Path):
        """Generate dependency graph documentation"""
        lines = [
            "# Service Dependency Graph",
            "",
            "Visual representation of service dependencies.",
            "",
        ]

        # Build dependency graph
        graph = defaultdict(list)
        for service_name, service in self.services.items():
            requires = service['infrastructure'].get('requires', [])
            for dep in requires:
                graph[service_name].append(dep)

        # Generate Mermaid diagram
        lines.append("```mermaid")
        lines.append("graph TD")

        # Add nodes
        for service_name, service in sorted(self.services.items()):
            infra = service['infrastructure']
            description = infra.get('description', service_name)

            # Style based on service type
            if infra.get('enabled', False):
                lines.append(f'    {service_name}["{description}"]')
            elif infra.get('enabled_by'):
                lines.append(f'    {service_name}["{description}"]:::conditional')
            else:
                lines.append(f'    {service_name}["{description}"]:::support')

        # Add edges
        for service_name, deps in sorted(graph.items()):
            for dep in deps:
                lines.append(f"    {service_name} --> {dep}")

        # Add styles
        lines.append("")
        lines.append("    classDef conditional fill:#fff3cd,stroke:#856404")
        lines.append("    classDef support fill:#d1ecf1,stroke:#0c5460")

        lines.append("```")
        lines.append("")

        # Add legend
        lines.append("## Legend")
        lines.append("")
        lines.append("- **Default**: Core services (always enabled)")
        lines.append("- **Yellow**: Conditional services (enabled based on configuration)")
        lines.append("- **Blue**: Support services (databases, caches)")
        lines.append("")

        # List dependencies
        lines.append("## Dependency Details")
        lines.append("")

        for service_name in sorted(self.services.keys()):
            deps = graph.get(service_name, [])
            if deps:
                deps_list = ', '.join(f'`{d}`' for d in deps)
                lines.append(f"- **{service_name}**: Requires {deps_list}")

        # Write file
        filename = output_dir / "DEPENDENCY-GRAPH.md"
        with open(filename, 'w') as f:
            f.write('\n'.join(lines))

        print(f"Generated: {filename}")

    def generate_provider_guide(self, output_dir: Path):
        """Generate provider selection guide"""
        lines = [
            "# Provider Selection Guide",
            "",
            "Guide to provider-based service enablement and configuration.",
            "",
        ]

        # Find all provider fields
        providers = []

        for service_name, service in sorted(self.services.items()):
            config = service.get('configuration', {})
            properties = config.get('properties', {})

            for field_name, field_def in properties.items():
                if field_def.get('x-affects-services') or field_def.get('x-enables-services'):
                    providers.append((service_name, field_name, field_def))

        if not providers:
            lines.append("No provider-based services found.")
        else:
            for service_name, field_name, field_def in providers:
                lines.extend(self._format_provider_entry(service_name, field_name, field_def))

        # Write file
        filename = output_dir / "PROVIDER-GUIDE.md"
        with open(filename, 'w') as f:
            f.write('\n'.join(lines))

        print(f"Generated: {filename}")

    def _format_provider_entry(
        self, service_name: str, field_name: str, field_def: Dict
    ) -> List[str]:
        """Format a provider field entry"""
        lines = []

        lines.append(f"## {service_name}.{field_name}")
        lines.append("")
        lines.append(field_def.get('description', 'No description'))
        lines.append("")

        # Choices
        if 'enum' in field_def:
            lines.append("### Available Options")
            lines.append("")

            affects = field_def.get('x-affects-services', {})
            provider_fields = field_def.get('x-provider-fields', {})

            for option in field_def['enum']:
                lines.append(f"#### `{option}`")
                lines.append("")

                # Service enablement
                if affects and option in affects:
                    affected_service = affects[option]
                    if affected_service:
                        lines.append(f"- **Enables Service**: `{affected_service}`")
                    else:
                        lines.append("- **Enables Service**: None (uses existing service)")

                # Required fields
                if provider_fields and option in provider_fields:
                    fields = provider_fields[option]
                    if fields:
                        fields_list = ', '.join(f'`{f}`' for f in fields)
                        lines.append(f"- **Required Fields**: {fields_list}")

                lines.append("")

        # Enables services (for boolean flags)
        enables = field_def.get('x-enables-services')
        if enables:
            services_list = ', '.join(f'`{s}`' for s in enables)
            lines.append(f"**Enables Services**: {services_list}")
            lines.append("")

        return lines


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate documentation from topology",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Generates:
  • SERVICE-CATALOG.md - Complete service listing
  • CONFIGURATION-REFERENCE.md - All configuration fields
  • DEPENDENCY-GRAPH.md - Service dependencies
  • PROVIDER-GUIDE.md - Provider selection guide

Examples:
  %(prog)s topology.json docs/
  %(prog)s topology.json --output ./documentation
        """
    )

    parser.add_argument(
        'topology',
        help='Path to topology.json file'
    )

    parser.add_argument(
        'output',
        nargs='?',
        default='./docs',
        help='Output directory for documentation (default: ./docs)'
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

    # Generate
    generator = DocGenerator(topology)
    generator.generate_all(args.output)


if __name__ == '__main__':
    main()
