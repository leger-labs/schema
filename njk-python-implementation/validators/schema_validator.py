#!/usr/bin/env python3
"""
JSON Schema Validator for Multi-Service Topology

Validates topology files against the topology-schema.json JSON Schema definition.
Provides clear error messages and validation reports.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Any
import jsonschema
from jsonschema import ValidationError, SchemaError


class SchemaValidator:
    """Validates topology files against JSON Schema"""

    def __init__(self, schema_path: str):
        """
        Initialize validator with schema file

        Args:
            schema_path: Path to topology-schema.json file
        """
        self.schema_path = Path(schema_path)
        self.schema = self._load_schema()
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def _load_schema(self) -> Dict:
        """Load and parse JSON Schema"""
        try:
            with open(self.schema_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Error: Schema file not found: {self.schema_path}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in schema file: {e}")
            sys.exit(1)

    def validate_file(self, topology_path: str) -> bool:
        """
        Validate a topology file against the schema

        Args:
            topology_path: Path to topology.json file

        Returns:
            True if valid, False if validation errors occurred
        """
        topology_path = Path(topology_path)

        # Load topology file
        try:
            with open(topology_path, 'r') as f:
                topology = json.load(f)
        except FileNotFoundError:
            self.errors.append(f"Topology file not found: {topology_path}")
            return False
        except json.JSONDecodeError as e:
            self.errors.append(f"Invalid JSON in topology file: {e}")
            return False

        # Validate against schema
        return self.validate(topology)

    def validate(self, topology: Dict) -> bool:
        """
        Validate a topology object against the schema

        Args:
            topology: Topology dictionary

        Returns:
            True if valid, False if validation errors occurred
        """
        self.errors = []
        self.warnings = []

        try:
            # Validate against JSON Schema
            jsonschema.validate(instance=topology, schema=self.schema)
            return True

        except ValidationError as e:
            # Parse validation error and create user-friendly message
            error_path = " -> ".join(str(p) for p in e.absolute_path) if e.absolute_path else "root"
            self.errors.append(f"Validation error at {error_path}: {e.message}")

            # Add additional context if available
            if e.context:
                for context_error in e.context:
                    context_path = " -> ".join(str(p) for p in context_error.absolute_path)
                    self.errors.append(f"  Context at {context_path}: {context_error.message}")

            return False

        except SchemaError as e:
            self.errors.append(f"Schema error: {e.message}")
            return False

    def print_results(self, verbose: bool = False):
        """
        Print validation results

        Args:
            verbose: Show detailed information
        """
        if self.errors:
            print("❌ VALIDATION FAILED\n")
            print("Errors:")
            for error in self.errors:
                print(f"  • {error}")

        if self.warnings:
            print("\n⚠️  WARNINGS:\n")
            for warning in self.warnings:
                print(f"  • {warning}")

        if not self.errors and not self.warnings:
            print("✅ VALIDATION PASSED")
            print("Topology file is valid according to JSON Schema")

        elif not self.errors:
            print(f"\n✅ VALIDATION PASSED with {len(self.warnings)} warnings")


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate topology files against JSON Schema",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s topology.json
  %(prog)s topology.json --schema custom-schema.json
  %(prog)s topology.json --verbose
        """
    )

    parser.add_argument(
        'topology',
        help='Path to topology.json file to validate'
    )

    parser.add_argument(
        '--schema',
        default='../njk-schema-011CUP2BgHZxsGMrx3Tk7aQk/topology-schema.json',
        help='Path to topology-schema.json (default: ../njk-schema-011CUP2BgHZxsGMrx3Tk7aQk/topology-schema.json)'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show verbose output'
    )

    args = parser.parse_args()

    # Validate
    validator = SchemaValidator(args.schema)
    valid = validator.validate_file(args.topology)

    # Print results
    validator.print_results(verbose=args.verbose)

    # Exit with appropriate code
    sys.exit(0 if valid else 1)


if __name__ == '__main__':
    main()
