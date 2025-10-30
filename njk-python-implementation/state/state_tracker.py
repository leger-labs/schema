#!/usr/bin/env python3
"""
State Tracker

Tracks which configuration values are:
- Using defaults (from schema)
- User-configured (overridden)
- Unset (required but not provided)

Enables:
- Diff-based configuration updates
- Migration between versions
- Configuration rollback
- Audit trail of changes
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Set, Optional, Any, Tuple
from datetime import datetime
from copy import deepcopy


class StateTracker:
    """Track configuration state and changes"""

    def __init__(self, topology: Dict):
        """
        Initialize state tracker

        Args:
            topology: Topology dictionary
        """
        self.topology = topology
        self.services = topology.get('topology', {}).get('services', {})

    def compute_state(self) -> Dict:
        """
        Compute current configuration state

        Returns:
            State dictionary with default vs configured tracking
        """
        state = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'schema_version': self.topology.get('schema_version', 'unknown'),
            'services': {}
        }

        for service_name, service in self.services.items():
            service_state = self._compute_service_state(service_name, service)
            if service_state['fields']:
                state['services'][service_name] = service_state

        return state

    def _compute_service_state(self, service_name: str, service: Dict) -> Dict:
        """Compute state for a single service"""
        config = service.get('configuration', {})
        properties = config.get('properties', {})
        required = set(config.get('required', []))

        service_state = {
            'fields': {},
            'summary': {
                'total': len(properties),
                'using_defaults': 0,
                'user_configured': 0,
                'unset_required': 0
            }
        }

        for field_name, field_def in properties.items():
            field_state = self._compute_field_state(
                field_name, field_def, is_required=(field_name in required)
            )
            service_state['fields'][field_name] = field_state

            # Update summary
            if field_state['state'] == 'default':
                service_state['summary']['using_defaults'] += 1
            elif field_state['state'] == 'configured':
                service_state['summary']['user_configured'] += 1
            elif field_state['state'] == 'unset':
                service_state['summary']['unset_required'] += 1

        return service_state

    def _compute_field_state(
        self, field_name: str, field_def: Dict, is_required: bool
    ) -> Dict:
        """Compute state for a single field"""
        has_default = 'default' in field_def
        default_handling = field_def.get('x-default-handling', 'preloaded')

        # Determine state
        if default_handling == 'user-configured':
            state = 'configured'
        elif default_handling == 'unset':
            state = 'unset' if is_required else 'optional_unset'
        else:  # preloaded
            state = 'default'

        field_state = {
            'state': state,
            'value': field_def.get('default'),
            'required': is_required,
            'type': field_def.get('type', 'unknown'),
            'sensitive': field_def.get('x-sensitive', False),
            'visibility': field_def.get('x-visibility', 'exposed')
        }

        # Add metadata
        if field_def.get('x-template-path'):
            field_state['template_path'] = field_def['x-template-path']

        if field_def.get('x-secret-ref'):
            field_state['secret_ref'] = field_def['x-secret-ref']

        return field_state

    def compare_states(self, old_state: Dict, new_state: Dict) -> Dict:
        """
        Compare two states and generate diff

        Args:
            old_state: Previous state
            new_state: Current state

        Returns:
            Diff dictionary
        """
        diff = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'old_version': old_state.get('schema_version'),
            'new_version': new_state.get('schema_version'),
            'changes': {
                'services_added': [],
                'services_removed': [],
                'services_modified': {}
            }
        }

        old_services = set(old_state.get('services', {}).keys())
        new_services = set(new_state.get('services', {}).keys())

        # Services added/removed
        diff['changes']['services_added'] = sorted(new_services - old_services)
        diff['changes']['services_removed'] = sorted(old_services - new_services)

        # Services modified
        for service_name in sorted(old_services & new_services):
            old_service = old_state['services'][service_name]
            new_service = new_state['services'][service_name]

            service_diff = self._compare_service_states(old_service, new_service)
            if service_diff:
                diff['changes']['services_modified'][service_name] = service_diff

        return diff

    def _compare_service_states(self, old_service: Dict, new_service: Dict) -> Optional[Dict]:
        """Compare two service states"""
        old_fields = old_service.get('fields', {})
        new_fields = new_service.get('fields', {})

        changes = {
            'fields_added': [],
            'fields_removed': [],
            'fields_changed': {}
        }

        old_field_names = set(old_fields.keys())
        new_field_names = set(new_fields.keys())

        # Fields added/removed
        changes['fields_added'] = sorted(new_field_names - old_field_names)
        changes['fields_removed'] = sorted(old_field_names - new_field_names)

        # Fields changed
        for field_name in sorted(old_field_names & new_field_names):
            old_field = old_fields[field_name]
            new_field = new_fields[field_name]

            field_changes = {}

            # Check for value changes
            if old_field.get('value') != new_field.get('value'):
                field_changes['value'] = {
                    'old': old_field.get('value'),
                    'new': new_field.get('value')
                }

            # Check for state changes
            if old_field.get('state') != new_field.get('state'):
                field_changes['state'] = {
                    'old': old_field.get('state'),
                    'new': new_field.get('state')
                }

            if field_changes:
                changes['fields_changed'][field_name] = field_changes

        # Return None if no changes
        if not any([
            changes['fields_added'],
            changes['fields_removed'],
            changes['fields_changed']
        ]):
            return None

        return changes

    def generate_report(self, state: Dict) -> str:
        """
        Generate human-readable state report

        Args:
            state: State dictionary

        Returns:
            Formatted report string
        """
        lines = []

        lines.append("# Configuration State Report")
        lines.append("")
        lines.append(f"Generated: {state['timestamp']}")
        lines.append(f"Schema Version: {state['schema_version']}")
        lines.append("")

        # Overall summary
        total_services = len(state['services'])
        total_fields = sum(s['summary']['total'] for s in state['services'].values())
        total_defaults = sum(s['summary']['using_defaults'] for s in state['services'].values())
        total_configured = sum(s['summary']['user_configured'] for s in state['services'].values())
        total_unset = sum(s['summary']['unset_required'] for s in state['services'].values())

        lines.append("## Overall Summary")
        lines.append("")
        lines.append(f"- **Services**: {total_services}")
        lines.append(f"- **Total Fields**: {total_fields}")
        lines.append(f"- **Using Defaults**: {total_defaults} ({total_defaults*100//total_fields if total_fields else 0}%)")
        lines.append(f"- **User Configured**: {total_configured}")
        lines.append(f"- **Unset Required**: {total_unset}")
        lines.append("")

        # Service details
        lines.append("## Service Details")
        lines.append("")

        for service_name in sorted(state['services'].keys()):
            service_state = state['services'][service_name]
            summary = service_state['summary']

            lines.append(f"### {service_name}")
            lines.append("")
            lines.append(f"- Total Fields: {summary['total']}")
            lines.append(f"- Using Defaults: {summary['using_defaults']}")
            lines.append(f"- User Configured: {summary['user_configured']}")

            if summary['unset_required'] > 0:
                lines.append(f"- **⚠️  Unset Required**: {summary['unset_required']}")

            # List unset required fields
            unset_fields = [
                field_name for field_name, field_state in service_state['fields'].items()
                if field_state['state'] == 'unset'
            ]
            if unset_fields:
                lines.append("")
                lines.append("  **Unset Required Fields**:")
                for field in unset_fields:
                    lines.append(f"  - `{field}`")

            # List user-configured fields
            configured_fields = [
                field_name for field_name, field_state in service_state['fields'].items()
                if field_state['state'] == 'configured'
            ]
            if configured_fields:
                lines.append("")
                lines.append("  **User-Configured Fields**:")
                for field in configured_fields:
                    field_state = service_state['fields'][field]
                    if field_state.get('sensitive'):
                        lines.append(f"  - `{field}`: `<sensitive>`")
                    else:
                        value = field_state.get('value', 'N/A')
                        lines.append(f"  - `{field}`: `{value}`")

            lines.append("")

        return '\n'.join(lines)

    def generate_diff_report(self, diff: Dict) -> str:
        """Generate human-readable diff report"""
        lines = []

        lines.append("# Configuration Change Report")
        lines.append("")
        lines.append(f"Generated: {diff['timestamp']}")
        lines.append(f"Old Version: {diff.get('old_version', 'unknown')}")
        lines.append(f"New Version: {diff.get('new_version', 'unknown')}")
        lines.append("")

        changes = diff['changes']

        # Services added/removed
        if changes['services_added']:
            lines.append("## Services Added")
            lines.append("")
            for service in changes['services_added']:
                lines.append(f"- `{service}`")
            lines.append("")

        if changes['services_removed']:
            lines.append("## Services Removed")
            lines.append("")
            for service in changes['services_removed']:
                lines.append(f"- `{service}`")
            lines.append("")

        # Services modified
        if changes['services_modified']:
            lines.append("## Services Modified")
            lines.append("")

            for service_name in sorted(changes['services_modified'].keys()):
                service_changes = changes['services_modified'][service_name]

                lines.append(f"### {service_name}")
                lines.append("")

                if service_changes['fields_added']:
                    lines.append("**Fields Added**:")
                    for field in service_changes['fields_added']:
                        lines.append(f"- `{field}`")
                    lines.append("")

                if service_changes['fields_removed']:
                    lines.append("**Fields Removed**:")
                    for field in service_changes['fields_removed']:
                        lines.append(f"- `{field}`")
                    lines.append("")

                if service_changes['fields_changed']:
                    lines.append("**Fields Changed**:")
                    for field_name, field_change in service_changes['fields_changed'].items():
                        lines.append(f"- `{field_name}`:")
                        if 'value' in field_change:
                            old_val = field_change['value']['old']
                            new_val = field_change['value']['new']
                            lines.append(f"  - Value: `{old_val}` → `{new_val}`")
                        if 'state' in field_change:
                            old_state = field_change['state']['old']
                            new_state = field_change['state']['new']
                            lines.append(f"  - State: `{old_state}` → `{new_state}`")
                    lines.append("")

        if not any([
            changes['services_added'],
            changes['services_removed'],
            changes['services_modified']
        ]):
            lines.append("*No changes detected*")

        return '\n'.join(lines)


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Track configuration state",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  compute     Compute current configuration state
  diff        Compare two states and show changes
  report      Generate human-readable state report

Examples:
  %(prog)s compute topology.json
  %(prog)s compute topology.json --output state.json
  %(prog)s diff old-state.json new-state.json
  %(prog)s report state.json
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    # Compute command
    compute_parser = subparsers.add_parser('compute', help='Compute configuration state')
    compute_parser.add_argument('topology', help='Path to topology.json')
    compute_parser.add_argument('--output', '-o', help='Output state to file')

    # Diff command
    diff_parser = subparsers.add_parser('diff', help='Compare two states')
    diff_parser.add_argument('old_state', help='Path to old state.json')
    diff_parser.add_argument('new_state', help='Path to new state.json')
    diff_parser.add_argument('--output', '-o', help='Output diff to file')

    # Report command
    report_parser = subparsers.add_parser('report', help='Generate state report')
    report_parser.add_argument('state', help='Path to state.json')
    report_parser.add_argument('--output', '-o', help='Output report to file')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Execute command
    if args.command == 'compute':
        # Load topology
        try:
            with open(args.topology, 'r') as f:
                topology = json.load(f)
        except FileNotFoundError:
            print(f"Error: Topology file not found: {args.topology}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON: {e}")
            sys.exit(1)

        # Compute state
        tracker = StateTracker(topology)
        state = tracker.compute_state()

        # Output
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(state, f, indent=2)
            print(f"State written to: {args.output}")
        else:
            print(json.dumps(state, indent=2))

    elif args.command == 'diff':
        # Load states
        try:
            with open(args.old_state, 'r') as f:
                old_state = json.load(f)
            with open(args.new_state, 'r') as f:
                new_state = json.load(f)
        except FileNotFoundError as e:
            print(f"Error: File not found: {e}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON: {e}")
            sys.exit(1)

        # Compute diff
        tracker = StateTracker({})
        diff = tracker.compare_states(old_state, new_state)

        # Generate report
        report = tracker.generate_diff_report(diff)

        # Output
        if args.output:
            with open(args.output, 'w') as f:
                f.write(report)
            print(f"Diff report written to: {args.output}")
        else:
            print(report)

    elif args.command == 'report':
        # Load state
        try:
            with open(args.state, 'r') as f:
                state = json.load(f)
        except FileNotFoundError:
            print(f"Error: State file not found: {args.state}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON: {e}")
            sys.exit(1)

        # Generate report
        tracker = StateTracker({})
        report = tracker.generate_report(state)

        # Output
        if args.output:
            with open(args.output, 'w') as f:
                f.write(report)
            print(f"State report written to: {args.output}")
        else:
            print(report)


if __name__ == '__main__':
    main()
