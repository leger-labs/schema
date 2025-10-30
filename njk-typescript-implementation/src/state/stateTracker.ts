/**
 * State Tracker
 *
 * Tracks which configuration values are:
 * - Using defaults (from schema)
 * - User-configured (overridden)
 * - Unset (required but not provided)
 */

import { readFileSync } from 'fs';
import type { Topology, ConfigurationState, ServiceState, FieldState } from '../types.js';

export class StateTracker {
  private topology: Topology;

  constructor(topology: Topology) {
    this.topology = topology;
  }

  /**
   * Compute current configuration state
   */
  computeState(): ConfigurationState {
    const state: ConfigurationState = {
      timestamp: new Date().toISOString(),
      schema_version: this.topology.schema_version,
      services: {}
    };

    for (const [serviceName, service] of Object.entries(this.topology.topology.services)) {
      const serviceState = this.computeServiceState(serviceName, service);
      if (Object.keys(serviceState.fields).length > 0) {
        state.services[serviceName] = serviceState;
      }
    }

    return state;
  }

  /**
   * Compute state for a single service
   */
  private computeServiceState(serviceName: string, service: any): ServiceState {
    const properties = service.configuration?.properties || {};
    const required = new Set(service.configuration?.required || []);

    const serviceState: ServiceState = {
      fields: {},
      summary: {
        total: Object.keys(properties).length,
        using_defaults: 0,
        user_configured: 0,
        unset_required: 0
      }
    };

    for (const [fieldName, fieldDef] of Object.entries(properties)) {
      const fieldState = this.computeFieldState(
        fieldName,
        fieldDef as any,
        required.has(fieldName)
      );
      serviceState.fields[fieldName] = fieldState;

      // Update summary
      if (fieldState.state === 'default') {
        serviceState.summary.using_defaults++;
      } else if (fieldState.state === 'configured') {
        serviceState.summary.user_configured++;
      } else if (fieldState.state === 'unset') {
        serviceState.summary.unset_required++;
      }
    }

    return serviceState;
  }

  /**
   * Compute state for a single field
   */
  private computeFieldState(fieldName: string, fieldDef: any, isRequired: boolean): FieldState {
    const defaultHandling = fieldDef['x-default-handling'] || 'preloaded';

    // Determine state
    let state: FieldState['state'];
    if (defaultHandling === 'user-configured') {
      state = 'configured';
    } else if (defaultHandling === 'unset') {
      state = isRequired ? 'unset' : 'optional_unset';
    } else {
      state = 'default';
    }

    const fieldState: FieldState = {
      state,
      value: fieldDef.default,
      required: isRequired,
      type: fieldDef.type || 'unknown',
      sensitive: fieldDef['x-sensitive'] || false,
      visibility: fieldDef['x-visibility'] || 'exposed'
    };

    // Add metadata
    if (fieldDef['x-template-path']) {
      fieldState.template_path = fieldDef['x-template-path'];
    }

    if (fieldDef['x-secret-ref']) {
      fieldState.secret_ref = fieldDef['x-secret-ref'];
    }

    return fieldState;
  }

  /**
   * Compare two states and generate diff
   */
  compareStates(oldState: ConfigurationState, newState: ConfigurationState): any {
    const diff = {
      timestamp: new Date().toISOString(),
      old_version: oldState.schema_version,
      new_version: newState.schema_version,
      changes: {
        services_added: [] as string[],
        services_removed: [] as string[],
        services_modified: {} as Record<string, any>
      }
    };

    const oldServices = new Set(Object.keys(oldState.services));
    const newServices = new Set(Object.keys(newState.services));

    // Services added/removed
    diff.changes.services_added = Array.from(newServices).filter(s => !oldServices.has(s)).sort();
    diff.changes.services_removed = Array.from(oldServices).filter(s => !newServices.has(s)).sort();

    // Services modified
    for (const serviceName of Array.from(oldServices).filter(s => newServices.has(s))) {
      const oldService = oldState.services[serviceName];
      const newService = newState.services[serviceName];

      const serviceDiff = this.compareServiceStates(oldService, newService);
      if (serviceDiff) {
        diff.changes.services_modified[serviceName] = serviceDiff;
      }
    }

    return diff;
  }

  /**
   * Compare two service states
   */
  private compareServiceStates(oldService: ServiceState, newService: ServiceState): any | null {
    const changes = {
      fields_added: [] as string[],
      fields_removed: [] as string[],
      fields_changed: {} as Record<string, any>
    };

    const oldFields = new Set(Object.keys(oldService.fields));
    const newFields = new Set(Object.keys(newService.fields));

    // Fields added/removed
    changes.fields_added = Array.from(newFields).filter(f => !oldFields.has(f)).sort();
    changes.fields_removed = Array.from(oldFields).filter(f => !newFields.has(f)).sort();

    // Fields changed
    for (const fieldName of Array.from(oldFields).filter(f => newFields.has(f))) {
      const oldField = oldService.fields[fieldName];
      const newField = newService.fields[fieldName];

      const fieldChanges: any = {};

      // Check for value changes
      if (oldField.value !== newField.value) {
        fieldChanges.value = {
          old: oldField.value,
          new: newField.value
        };
      }

      // Check for state changes
      if (oldField.state !== newField.state) {
        fieldChanges.state = {
          old: oldField.state,
          new: newField.state
        };
      }

      if (Object.keys(fieldChanges).length > 0) {
        changes.fields_changed[fieldName] = fieldChanges;
      }
    }

    // Return null if no changes
    if (
      changes.fields_added.length === 0 &&
      changes.fields_removed.length === 0 &&
      Object.keys(changes.fields_changed).length === 0
    ) {
      return null;
    }

    return changes;
  }

  /**
   * Generate human-readable state report
   */
  generateReport(state: ConfigurationState): string {
    const lines: string[] = [];

    lines.push('# Configuration State Report');
    lines.push('');
    lines.push(`Generated: ${state.timestamp}`);
    lines.push(`Schema Version: ${state.schema_version}`);
    lines.push('');

    // Overall summary
    const totalServices = Object.keys(state.services).length;
    const totalFields = Object.values(state.services).reduce((sum, s) => sum + s.summary.total, 0);
    const totalDefaults = Object.values(state.services).reduce((sum, s) => sum + s.summary.using_defaults, 0);
    const totalConfigured = Object.values(state.services).reduce((sum, s) => sum + s.summary.user_configured, 0);
    const totalUnset = Object.values(state.services).reduce((sum, s) => sum + s.summary.unset_required, 0);

    lines.push('## Overall Summary');
    lines.push('');
    lines.push(`- **Services**: ${totalServices}`);
    lines.push(`- **Total Fields**: ${totalFields}`);
    lines.push(`- **Using Defaults**: ${totalDefaults} (${totalFields ? Math.round((totalDefaults * 100) / totalFields) : 0}%)`);
    lines.push(`- **User Configured**: ${totalConfigured}`);
    lines.push(`- **Unset Required**: ${totalUnset}`);
    lines.push('');

    // Service details
    lines.push('## Service Details');
    lines.push('');

    for (const [serviceName, serviceState] of Object.entries(state.services).sort()) {
      const summary = serviceState.summary;

      lines.push(`### ${serviceName}`);
      lines.push('');
      lines.push(`- Total Fields: ${summary.total}`);
      lines.push(`- Using Defaults: ${summary.using_defaults}`);
      lines.push(`- User Configured: ${summary.user_configured}`);

      if (summary.unset_required > 0) {
        lines.push(`- **⚠️  Unset Required**: ${summary.unset_required}`);
      }

      // List unset required fields
      const unsetFields = Object.entries(serviceState.fields)
        .filter(([, field]) => field.state === 'unset')
        .map(([name]) => name);

      if (unsetFields.length > 0) {
        lines.push('');
        lines.push('  **Unset Required Fields**:');
        for (const field of unsetFields) {
          lines.push(`  - \`${field}\``);
        }
      }

      // List user-configured fields
      const configuredFields = Object.entries(serviceState.fields)
        .filter(([, field]) => field.state === 'configured');

      if (configuredFields.length > 0) {
        lines.push('');
        lines.push('  **User-Configured Fields**:');
        for (const [fieldName, fieldState] of configuredFields) {
          if (fieldState.sensitive) {
            lines.push(`  - \`${fieldName}\`: \`<sensitive>\``);
          } else {
            lines.push(`  - \`${fieldName}\`: \`${fieldState.value ?? 'N/A'}\``);
          }
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate human-readable diff report
   */
  generateDiffReport(diff: any): string {
    const lines: string[] = [];

    lines.push('# Configuration Change Report');
    lines.push('');
    lines.push(`Generated: ${diff.timestamp}`);
    lines.push(`Old Version: ${diff.old_version || 'unknown'}`);
    lines.push(`New Version: ${diff.new_version || 'unknown'}`);
    lines.push('');

    const changes = diff.changes;

    // Services added/removed
    if (changes.services_added.length > 0) {
      lines.push('## Services Added');
      lines.push('');
      for (const service of changes.services_added) {
        lines.push(`- \`${service}\``);
      }
      lines.push('');
    }

    if (changes.services_removed.length > 0) {
      lines.push('## Services Removed');
      lines.push('');
      for (const service of changes.services_removed) {
        lines.push(`- \`${service}\``);
      }
      lines.push('');
    }

    // Services modified
    if (Object.keys(changes.services_modified).length > 0) {
      lines.push('## Services Modified');
      lines.push('');

      for (const [serviceName, serviceChanges] of Object.entries(changes.services_modified).sort()) {
        const sc = serviceChanges as any;

        lines.push(`### ${serviceName}`);
        lines.push('');

        if (sc.fields_added.length > 0) {
          lines.push('**Fields Added**:');
          for (const field of sc.fields_added) {
            lines.push(`- \`${field}\``);
          }
          lines.push('');
        }

        if (sc.fields_removed.length > 0) {
          lines.push('**Fields Removed**:');
          for (const field of sc.fields_removed) {
            lines.push(`- \`${field}\``);
          }
          lines.push('');
        }

        if (Object.keys(sc.fields_changed).length > 0) {
          lines.push('**Fields Changed**:');
          for (const [fieldName, fieldChange] of Object.entries(sc.fields_changed)) {
            const fc = fieldChange as any;
            lines.push(`- \`${fieldName}\`:`);
            if (fc.value) {
              lines.push(`  - Value: \`${fc.value.old}\` → \`${fc.value.new}\``);
            }
            if (fc.state) {
              lines.push(`  - State: \`${fc.state.old}\` → \`${fc.state.new}\``);
            }
          }
          lines.push('');
        }
      }
    }

    if (
      changes.services_added.length === 0 &&
      changes.services_removed.length === 0 &&
      Object.keys(changes.services_modified).length === 0
    ) {
      lines.push('*No changes detected*');
    }

    return lines.join('\n');
  }

  /**
   * Compute state from file
   */
  static computeFromFile(topologyPath: string): ConfigurationState {
    const content = readFileSync(topologyPath, 'utf-8');
    const topology = JSON.parse(content);
    const tracker = new StateTracker(topology);
    return tracker.computeState();
  }
}
