/**
 * Topology-Level Validator
 *
 * Extended validation beyond JSON Schema:
 * - Circular dependency detection
 * - Cross-service field references
 * - Enablement expression validation
 * - Provider field consistency
 * - Port conflicts
 * - Secret references
 */

import { readFileSync } from 'fs';
import type { Topology, Service, ValidationResult, ValidationError } from '../types.js';

export class TopologyValidator {
  private topology: Topology;
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  constructor(topology: Topology) {
    this.topology = topology;
  }

  /**
   * Run all validation levels
   */
  validate(): ValidationResult {
    this.errors = [];
    this.warnings = [];

    this.validateFieldLevel();
    this.validateServiceLevel();
    this.validateTopologyLevel();

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Validate from file
   */
  static validateFile(topologyPath: string): ValidationResult {
    const content = readFileSync(topologyPath, 'utf-8');
    const topology = JSON.parse(content);
    const validator = new TopologyValidator(topology);
    return validator.validate();
  }

  // =========================================================================
  // FIELD LEVEL VALIDATION
  // =========================================================================

  private validateFieldLevel(): void {
    const services = this.topology.topology.services;

    for (const [serviceName, service] of Object.entries(services)) {
      const properties = service.configuration?.properties || {};

      for (const [fieldName, fieldDef] of Object.entries(properties)) {
        // Check sensitive fields have secret references
        if (fieldDef['x-sensitive'] && !fieldDef['x-secret-ref']) {
          this.warnings.push({
            path: `${serviceName}.${fieldName}`,
            message: 'Sensitive field lacks x-secret-ref',
            severity: 'warning'
          });
        }

        // Check env var is defined if field is exposed
        const visibility = fieldDef['x-visibility'] || 'exposed';
        if (['exposed', 'advanced'].includes(visibility) && !fieldDef['x-env-var']) {
          this.warnings.push({
            path: `${serviceName}.${fieldName}`,
            message: 'Exposed field lacks x-env-var definition',
            severity: 'warning'
          });
        }
      }
    }
  }

  // =========================================================================
  // SERVICE LEVEL VALIDATION
  // =========================================================================

  private validateServiceLevel(): void {
    const services = this.topology.topology.services;

    for (const [serviceName, service] of Object.entries(services)) {
      this.validateServiceDependencies(serviceName, service);
      this.validateServiceHealthcheck(serviceName, service);
    }

    // Port and container name validation needs to check across all services
    this.validateServicePorts();
    this.validateContainerNames();
  }

  private validateServiceDependencies(serviceName: string, service: Service): void {
    const requires = service.infrastructure.requires || [];
    const services = this.topology.topology.services;

    for (const dep of requires) {
      if (!services[dep]) {
        this.errors.push({
          path: serviceName,
          message: `Requires non-existent service '${dep}'`,
          severity: 'error'
        });
      }
    }
  }

  private validateServicePorts(): void {
    const services = this.topology.topology.services;
    const portMap = new Map<number, string[]>();

    for (const [serviceName, service] of Object.entries(services)) {
      const published = service.infrastructure.published_port;
      if (published !== null && published !== undefined) {
        if (!portMap.has(published)) {
          portMap.set(published, []);
        }
        portMap.get(published)!.push(serviceName);
      }
    }

    // Report conflicts
    for (const [port, serviceNames] of portMap.entries()) {
      if (serviceNames.length > 1) {
        this.errors.push({
          path: 'topology',
          message: `Port conflict: Port ${port} is published by multiple services: ${serviceNames.join(', ')}`,
          severity: 'error'
        });
      }
    }
  }

  private validateContainerNames(): void {
    const services = this.topology.topology.services;
    const nameMap = new Map<string, string[]>();

    for (const [serviceName, service] of Object.entries(services)) {
      const containerName = service.infrastructure.container_name;
      if (containerName) {
        if (!nameMap.has(containerName)) {
          nameMap.set(containerName, []);
        }
        nameMap.get(containerName)!.push(serviceName);
      }
    }

    // Report conflicts
    for (const [containerName, serviceNames] of nameMap.entries()) {
      if (serviceNames.length > 1) {
        this.errors.push({
          path: 'topology',
          message: `Container name conflict: '${containerName}' is used by multiple services: ${serviceNames.join(', ')}`,
          severity: 'error'
        });
      }
    }
  }

  private validateServiceHealthcheck(serviceName: string, service: Service): void {
    const infra = service.infrastructure;
    const enabled = infra.enabled || (infra.enabled_by && infra.enabled_by.length > 0);

    if (enabled && !infra.healthcheck) {
      this.warnings.push({
        path: serviceName,
        message: 'Enabled service lacks healthcheck',
        severity: 'warning'
      });
    }
  }

  // =========================================================================
  // TOPOLOGY LEVEL VALIDATION
  // =========================================================================

  private validateTopologyLevel(): void {
    this.validateNoCircularDependencies();
    this.validateEnablementExpressions();
    this.validateFieldReferences();
    this.validateSecretReferences();
    this.validateProviderConsistency();
    this.validateServiceEnablementReferences();
  }

  private validateNoCircularDependencies(): void {
    const services = this.topology.topology.services;
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (serviceName: string, path: string[] = []): boolean => {
      visited.add(serviceName);
      recStack.add(serviceName);

      const service = services[serviceName];
      if (!service) return false;

      const requires = service.infrastructure.requires || [];

      for (const dep of requires) {
        if (!visited.has(dep)) {
          if (hasCycle(dep, [...path, serviceName])) {
            return true;
          }
        } else if (recStack.has(dep)) {
          const cycle = [...path, serviceName, dep].join(' -> ');
          this.errors.push({
            path: 'topology',
            message: `Circular dependency detected: ${cycle}`,
            severity: 'error'
          });
          return true;
        }
      }

      recStack.delete(serviceName);
      return false;
    };

    for (const serviceName of Object.keys(services)) {
      if (!visited.has(serviceName)) {
        hasCycle(serviceName);
      }
    }
  }

  private validateEnablementExpressions(): void {
    const services = this.topology.topology.services;

    for (const [serviceName, service] of Object.entries(services)) {
      const enabledBy = service.infrastructure.enabled_by || [];

      for (const expression of enabledBy) {
        this.validateExpression(serviceName, expression);
      }
    }
  }

  private validateExpression(serviceName: string, expression: string): void {
    // Pattern: service.configuration.FIELD == value
    const match = expression.match(/^(\w+)\.configuration\.(\w+)\s*(==|!=)\s*(.+)$/);

    if (!match) {
      this.errors.push({
        path: serviceName,
        message: `Invalid expression format '${expression}'`,
        severity: 'error'
      });
      return;
    }

    const [, refService, refField] = match;

    // Check service exists
    if (!this.topology.topology.services[refService]) {
      this.errors.push({
        path: serviceName,
        message: `Expression references non-existent service '${refService}'`,
        severity: 'error'
      });
      return;
    }

    // Check field exists
    const properties = this.topology.topology.services[refService].configuration?.properties || {};
    if (!properties[refField]) {
      this.errors.push({
        path: serviceName,
        message: `Expression references non-existent field '${refService}.${refField}'`,
        severity: 'error'
      });
    }
  }

  private validateFieldReferences(): void {
    const services = this.topology.topology.services;

    for (const [serviceName, service] of Object.entries(services)) {
      const properties = service.configuration?.properties || {};

      for (const [fieldName, fieldDef] of Object.entries(properties)) {
        const requires = fieldDef['x-requires-field'];
        if (requires) {
          this.validateFieldReference(serviceName, fieldName, requires);
        }
      }
    }
  }

  private validateFieldReference(serviceName: string, fieldName: string, reference: string): void {
    const parts = reference.split('.');
    if (parts.length < 2) {
      this.errors.push({
        path: `${serviceName}.${fieldName}`,
        message: `Invalid reference format '${reference}'`,
        severity: 'error'
      });
      return;
    }

    const refService = parts[0];

    // Check service exists
    if (!this.topology.topology.services[refService]) {
      this.errors.push({
        path: `${serviceName}.${fieldName}`,
        message: `References non-existent service '${refService}'`,
        severity: 'error'
      });
    }
  }

  private validateSecretReferences(): void {
    const services = this.topology.topology.services;
    const secrets = this.topology.secrets || {};

    for (const [serviceName, service] of Object.entries(services)) {
      const properties = service.configuration?.properties || {};

      for (const [fieldName, fieldDef] of Object.entries(properties)) {
        const secretRef = fieldDef['x-secret-ref'];
        if (secretRef) {
          this.validateSecretReference(serviceName, fieldName, secretRef, secrets);
        }
      }
    }
  }

  private validateSecretReference(
    serviceName: string,
    fieldName: string,
    reference: string,
    secrets: any
  ): void {
    const parts = reference.split('.');

    if (parts[0] !== 'secrets') {
      this.errors.push({
        path: `${serviceName}.${fieldName}`,
        message: `Secret reference must start with 'secrets.'`,
        severity: 'error'
      });
      return;
    }

    // Navigate secrets object
    let obj: any = secrets;
    for (const segment of parts.slice(1)) {
      if (typeof obj !== 'object' || !obj[segment]) {
        this.errors.push({
          path: `${serviceName}.${fieldName}`,
          message: `Secret '${reference}' does not exist`,
          severity: 'error'
        });
        return;
      }
      obj = obj[segment];
    }
  }

  private validateProviderConsistency(): void {
    const services = this.topology.topology.services;

    for (const [serviceName, service] of Object.entries(services)) {
      const properties = service.configuration?.properties || {};

      for (const [fieldName, fieldDef] of Object.entries(properties)) {
        const providerFields = fieldDef['x-provider-fields'];
        if (providerFields && typeof providerFields === 'object' && !Array.isArray(providerFields)) {
          // Validate that referenced provider fields exist
          for (const [provider, fields] of Object.entries(providerFields)) {
            for (const requiredField of fields) {
              if (!properties[requiredField]) {
                this.errors.push({
                  path: `${serviceName}.${fieldName}`,
                  message: `Provider '${provider}' requires non-existent field '${requiredField}'`,
                  severity: 'error'
                });
              }
            }
          }
        }
      }
    }
  }

  private validateServiceEnablementReferences(): void {
    const services = this.topology.topology.services;

    for (const [serviceName, service] of Object.entries(services)) {
      const properties = service.configuration?.properties || {};

      for (const [fieldName, fieldDef] of Object.entries(properties)) {
        // Check x-enables-services
        const enables = fieldDef['x-enables-services'] || [];
        for (const enabledService of enables) {
          if (!services[enabledService]) {
            this.errors.push({
              path: `${serviceName}.${fieldName}`,
              message: `Enables non-existent service '${enabledService}'`,
              severity: 'error'
            });
          }
        }

        // Check x-affects-services
        const affects = fieldDef['x-affects-services'] || {};
        for (const [, affectedService] of Object.entries(affects)) {
          if (affectedService && !services[affectedService]) {
            this.errors.push({
              path: `${serviceName}.${fieldName}`,
              message: `Affects non-existent service '${affectedService}'`,
              severity: 'error'
            });
          }
        }
      }
    }
  }

  /**
   * Print validation results
   */
  printResults(result: ValidationResult, verbose = false): void {
    if (result.errors.length > 0) {
      console.log('❌ TOPOLOGY VALIDATION FAILED\n');
      console.log('Errors:');
      for (const error of result.errors) {
        console.log(`  • ${error.path}: ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      for (const warning of result.warnings) {
        console.log(`  • ${warning.path}: ${warning.message}`);
      }
    }

    if (result.valid && result.warnings.length === 0) {
      console.log('✅ TOPOLOGY VALIDATION PASSED');
      console.log('All cross-service relationships are valid');
    } else if (result.valid) {
      console.log(`\n✅ TOPOLOGY VALIDATION PASSED with ${result.warnings.length} warnings`);
    }

    if (verbose && result.valid) {
      this.printTopologySummary();
    }
  }

  private printTopologySummary(): void {
    const services = this.topology.topology.services;
    const serviceCount = Object.keys(services).length;

    const enabled = Object.values(services).filter(s => s.infrastructure.enabled).length;
    const conditional = Object.values(services).filter(s => (s.infrastructure.enabled_by || []).length > 0).length;
    const published = Object.values(services).filter(s => s.infrastructure.published_port !== null && s.infrastructure.published_port !== undefined).length;

    console.log('\n📊 TOPOLOGY SUMMARY:');
    console.log(`  Services: ${serviceCount}`);
    console.log(`  Enabled unconditionally: ${enabled}`);
    console.log(`  Enabled conditionally: ${conditional}`);
    console.log(`  Services with published ports: ${published}`);
  }
}
