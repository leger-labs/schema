/**
 * JSON Schema Validator
 *
 * Validates topology files against the JSON Schema definition using ajv.
 */

import Ajv, { type ValidateFunction } from 'ajv';
import { readFileSync } from 'fs';
import type { Topology, ValidationResult, ValidationError } from '../types.js';

export class SchemaValidator {
  private ajv: Ajv;
  private schema: any;
  private validate: ValidateFunction | null = null;

  constructor(schemaPath: string) {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    });

    // Load schema
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    this.schema = JSON.parse(schemaContent);

    // Compile schema
    this.validate = this.ajv.compile(this.schema);
  }

  /**
   * Validate a topology object
   */
  validateTopology(topology: Topology): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!this.validate) {
      errors.push({
        path: 'root',
        message: 'Schema validator not initialized',
        severity: 'error'
      });
      return { valid: false, errors, warnings };
    }

    const valid = this.validate(topology);

    if (!valid && this.validate.errors) {
      for (const error of this.validate.errors) {
        const path = error.instancePath || 'root';
        const message = this.formatErrorMessage(error);

        errors.push({
          path,
          message,
          severity: 'error'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate from file
   */
  validateFile(topologyPath: string): ValidationResult {
    const content = readFileSync(topologyPath, 'utf-8');
    const topology = JSON.parse(content);
    return this.validateTopology(topology);
  }

  /**
   * Format ajv error message for better readability
   */
  private formatErrorMessage(error: any): string {
    const { keyword, message, params } = error;

    switch (keyword) {
      case 'required':
        return `Missing required property: ${params.missingProperty}`;
      case 'type':
        return `${message} (expected ${params.type})`;
      case 'enum':
        return `${message}. Allowed values: ${params.allowedValues.join(', ')}`;
      case 'pattern':
        return `${message}. Must match pattern: ${params.pattern}`;
      case 'minimum':
        return `${message} (minimum: ${params.limit})`;
      case 'maximum':
        return `${message} (maximum: ${params.limit})`;
      default:
        return message || 'Validation error';
    }
  }

  /**
   * Print validation results
   */
  printResults(result: ValidationResult, verbose = false): void {
    if (result.errors.length > 0) {
      console.log('❌ VALIDATION FAILED\n');
      console.log('Errors:');
      for (const error of result.errors) {
        console.log(`  • ${error.path}: ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:\n');
      for (const warning of result.warnings) {
        console.log(`  • ${warning.path}: ${warning.message}`);
      }
    }

    if (result.valid && result.warnings.length === 0) {
      console.log('✅ VALIDATION PASSED');
      console.log('Topology file is valid according to JSON Schema');
    } else if (result.valid) {
      console.log(`\n✅ VALIDATION PASSED with ${result.warnings.length} warnings`);
    }
  }
}
