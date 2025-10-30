#!/usr/bin/env python3
"""
Quadlet Generator from Topology

Generates Podman Quadlet files from topology by:
1. Evaluating which services are enabled
2. Computing dependency order
3. Rendering configuration from topology
4. Generating .container, .volume, .network files
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Set, Optional, Any
from collections import defaultdict, deque


class QuadletGenerator:
    """Generate Podman Quadlet files from topology"""

    def __init__(self, topology: Dict):
        """
        Initialize generator with topology

        Args:
            topology: Topology dictionary
        """
        self.topology = topology
        self.services = topology.get('topology', {}).get('services', {})
        self.network = topology.get('topology', {}).get('network', {})

    def get_enabled_services(self) -> Set[str]:
        """
        Compute which services should be enabled

        Returns:
            Set of service names that are enabled
        """
        enabled = set()

        for service_name, service in self.services.items():
            infra = service['infrastructure']

            # Unconditionally enabled
            if infra.get('enabled', False):
                enabled.add(service_name)
                continue

            # Conditionally enabled (logical OR)
            enabled_by = infra.get('enabled_by', [])
            for condition in enabled_by:
                if self._evaluate_condition(condition):
                    enabled.add(service_name)
                    break

        return enabled

    def _evaluate_condition(self, condition: str) -> bool:
        """
        Evaluate enablement condition

        Format: service.configuration.FIELD == value
                service.configuration.FIELD != value

        Args:
            condition: Condition string

        Returns:
            True if condition is met, False otherwise
        """
        import re

        try:
            # Parse condition
            match = re.match(r'^(\w+)\.configuration\.(\w+)\s*(==|!=)\s*(.+)$', condition)
            if not match:
                print(f"Warning: Invalid condition format: {condition}")
                return False

            service_name, field_name, operator, expected_value = match.groups()

            # Get actual value from topology
            if service_name not in self.services:
                return False

            config = self.services[service_name].get('configuration', {})
            properties = config.get('properties', {})

            if field_name not in properties:
                return False

            field_def = properties[field_name]
            actual_value = field_def.get('default')

            # Parse expected value
            expected_value = expected_value.strip()
            if expected_value == 'true':
                expected_value = True
            elif expected_value == 'false':
                expected_value = False
            elif expected_value.startswith("'") and expected_value.endswith("'"):
                expected_value = expected_value[1:-1]

            # Compare
            if operator == '==':
                return actual_value == expected_value
            elif operator == '!=':
                return actual_value != expected_value

            return False

        except Exception as e:
            print(f"Warning: Error evaluating condition '{condition}': {e}")
            return False

    def topological_sort(self, enabled_services: Set[str]) -> List[str]:
        """
        Sort services by dependency order

        Args:
            enabled_services: Set of enabled service names

        Returns:
            List of services in dependency order (dependencies first)

        Raises:
            ValueError: If circular dependency detected
        """
        # Build dependency graph
        graph = defaultdict(list)
        in_degree = defaultdict(int)

        for service_name in enabled_services:
            service = self.services[service_name]
            requires = service['infrastructure'].get('requires', [])

            for dep in requires:
                if dep in enabled_services:
                    graph[dep].append(service_name)
                    in_degree[service_name] += 1

        # Kahn's algorithm for topological sort
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

    def generate_all(self, output_dir: str):
        """
        Generate quadlet files for all enabled services

        Args:
            output_dir: Directory to write generated files
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Get enabled services
        enabled = self.get_enabled_services()
        print(f"Enabled services: {', '.join(sorted(enabled))}\n")

        # Sort by dependency order
        try:
            startup_order = self.topological_sort(enabled)
            print(f"Startup order: {' -> '.join(startup_order)}\n")
        except ValueError as e:
            print(f"Error: {e}")
            return

        # Generate network file
        self.generate_network(output_path)

        # Generate service files
        for service_name in startup_order:
            self.generate_service(service_name, output_path)

        print(f"\n✅ Generated {len(startup_order)} service(s) + network")

    def generate_network(self, output_dir: Path):
        """
        Generate network quadlet file

        Args:
            output_dir: Output directory
        """
        network_name = self.network.get('name', 'llm')
        subnet = self.network.get('subnet', '10.89.0.0/24')
        gateway = self.network.get('gateway', '10.89.0.1')

        lines = [
            "[Network]",
            f"Subnet={subnet}",
            f"Gateway={gateway}",
            "Label=app=scroll",
            "",
            "[Install]",
            "WantedBy=scroll-session.target",
        ]

        filename = output_dir / f"{network_name}.network"
        with open(filename, 'w') as f:
            f.write('\n'.join(lines))

        print(f"Generated: {filename}")

    def generate_service(self, service_name: str, output_dir: Path):
        """
        Generate quadlet files for a service

        Args:
            service_name: Name of the service
            output_dir: Output directory
        """
        service = self.services[service_name]
        infra = service['infrastructure']
        config = service.get('configuration', {})

        # Generate .container file
        self._generate_container_file(service_name, infra, config, output_dir)

        # Generate .volume files
        volumes = infra.get('volumes', [])
        for volume in volumes:
            if volume.get('type', 'volume') == 'volume':
                self._generate_volume_file(volume['name'], output_dir)

    def _generate_container_file(
        self, service_name: str, infra: Dict, config: Dict, output_dir: Path
    ):
        """Generate .container quadlet file"""
        lines = []

        # [Unit] section
        lines.append("[Unit]")
        lines.append(f"Description={infra.get('description', service_name)}")
        lines.append("After=network-online.target")

        network_name = self.network.get('name', 'llm')
        lines.append(f"After={network_name}.network.service")
        lines.append(f"Requires={network_name}.network.service")

        # Add dependencies
        requires = infra.get('requires', [])
        if requires:
            wants = ' '.join(f"{r}.service" for r in requires)
            lines.append(f"Wants={wants}")

        lines.append("")

        # [Container] section
        lines.append("[Container]")
        lines.append(f"Image={infra['image']}")
        lines.append("AutoUpdate=registry")
        lines.append(f"ContainerName={infra['container_name']}")

        # Hostname
        if infra.get('hostname'):
            lines.append(f"HostName={infra['hostname']}")

        # Network
        lines.append(f"Network={network_name}.network")

        # Published port
        if infra.get('published_port') is not None:
            bind = infra.get('bind', '0.0.0.0')
            port = infra['port']
            published = infra['published_port']
            lines.append(f"PublishPort={bind}:{published}:{port}")

        # Volumes
        for volume in infra.get('volumes', []):
            mount_path = volume['mount_path']
            selinux = volume.get('selinux_label', 'Z')

            if volume.get('type', 'volume') == 'volume':
                vol_name = volume['name']
                lines.append(f"Volume={vol_name}:{mount_path}:{selinux}")
            else:
                # Bind mount
                vol_name = volume['name']
                lines.append(f"Volume=%h/.config/containers/{vol_name}:{mount_path}:{selinux}")

        # Environment variables from configuration
        properties = config.get('properties', {})
        for field_name, field_def in properties.items():
            env_var = field_def.get('x-env-var')
            if env_var:
                default = field_def.get('default')
                if default is not None:
                    # Handle boolean values
                    if isinstance(default, bool):
                        default = str(default).lower()
                    lines.append(f"Environment={env_var}={default}")

        # Healthcheck
        healthcheck = infra.get('healthcheck')
        if healthcheck:
            lines.append(f"HealthCmd={healthcheck['cmd']}")
            lines.append(f"HealthInterval={healthcheck.get('interval', '30s')}")
            lines.append(f"HealthTimeout={healthcheck.get('timeout', '5s')}")
            lines.append(f"HealthRetries={healthcheck.get('retries', 3)}")
            lines.append(f"HealthStartPeriod={healthcheck.get('start_period', '10s')}")

        lines.append("")

        # [Service] section
        lines.append("[Service]")
        lines.append("Slice=llm.slice")
        lines.append("TimeoutStartSec=900")
        lines.append("Restart=on-failure")
        lines.append("RestartSec=10")
        lines.append("")

        # [Install] section
        lines.append("[Install]")
        lines.append("WantedBy=scroll-session.target")
        lines.append("PartOf=scroll-session.target")

        # Write file
        filename = output_dir / f"{service_name}.container"
        with open(filename, 'w') as f:
            f.write('\n'.join(lines))

        print(f"Generated: {filename}")

    def _generate_volume_file(self, volume_name: str, output_dir: Path):
        """Generate .volume quadlet file"""
        lines = [
            "[Volume]",
            "Label=app=scroll",
        ]

        filename = output_dir / volume_name
        with open(filename, 'w') as f:
            f.write('\n'.join(lines))

        print(f"Generated: {filename}")


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate Podman Quadlet files from topology",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s topology.json output/
  %(prog)s topology.json --output /path/to/quadlets
        """
    )

    parser.add_argument(
        'topology',
        help='Path to topology.json file'
    )

    parser.add_argument(
        'output',
        nargs='?',
        default='./output',
        help='Output directory for generated files (default: ./output)'
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
    generator = QuadletGenerator(topology)
    generator.generate_all(args.output)


if __name__ == '__main__':
    main()
