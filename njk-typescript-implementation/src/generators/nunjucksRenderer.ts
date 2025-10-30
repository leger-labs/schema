/**
 * Nunjucks Template Renderer
 *
 * Renders existing .njk template files with data from topology.json
 * This is what the Cloudflare Workers webapp will use when user hits "Save"
 */

import nunjucks from 'nunjucks';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import type { Topology, Service, ConfigurationField } from '../types.js';

export interface RenderOptions {
  templatesDir: string;
  outputDir: string;
  evaluateConditions?: boolean;
}

export interface EnabledServices {
  services: Set<string>;
  startup_order: string[];
}

export class NunjucksRenderer {
  private env: nunjucks.Environment;
  private topology: Topology;

  constructor(topology: Topology, templatesDir: string) {
    this.topology = topology;

    // Configure Nunjucks environment
    this.env = nunjucks.configure(templatesDir, {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
      throwOnUndefined: false
    });

    // Add custom filters
    this.addCustomFilters();
  }

  /**
   * Add custom Nunjucks filters for quadlet generation
   */
  private addCustomFilters(): void {
    // Filter to convert boolean to lowercase string for env vars
    this.env.addFilter('boolstring', (value: any) => {
      if (typeof value === 'boolean') {
        return value.toString();
      }
      return value;
    });

    // Filter to check if a field should be included based on x-depends-on
    this.env.addFilter('shouldInclude', (field: ConfigurationField, context: any) => {
      const dependsOn = field['x-depends-on'];
      if (!dependsOn) return true;

      for (const [key, value] of Object.entries(dependsOn)) {
        if (context[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get enabled services based on topology configuration
   */
  getEnabledServices(): EnabledServices {
    const enabled = new Set<string>();
    const services = this.topology.topology.services;

    for (const [serviceName, service] of Object.entries(services)) {
      const infra = service.infrastructure;

      // Unconditionally enabled
      if (infra.enabled) {
        enabled.add(serviceName);
        continue;
      }

      // Conditionally enabled (logical OR)
      const enabledBy = infra.enabled_by || [];
      for (const condition of enabledBy) {
        if (this.evaluateCondition(condition)) {
          enabled.add(serviceName);
          break;
        }
      }
    }

    // Compute startup order (topological sort)
    const startupOrder = this.topologicalSort(enabled);

    return {
      services: enabled,
      startup_order: startupOrder
    };
  }

  /**
   * Evaluate an enablement condition
   */
  private evaluateCondition(condition: string): boolean {
    // Pattern: service.configuration.FIELD == value or != value
    const match = condition.match(/^(\w+)\.configuration\.(\w+)\s*(==|!=)\s*(.+)$/);
    if (!match) {
      console.warn(`Invalid condition format: ${condition}`);
      return false;
    }

    const [, serviceName, fieldName, operator, expectedValue] = match;

    // Get actual value from topology
    const service = this.topology.topology.services[serviceName];
    if (!service) return false;

    const properties = service.configuration?.properties || {};
    const field = properties[fieldName];
    if (!field) return false;

    const actualValue = field.default;

    // Parse expected value
    let parsedExpected: any = expectedValue.trim();
    if (parsedExpected === 'true') parsedExpected = true;
    else if (parsedExpected === 'false') parsedExpected = false;
    else if (parsedExpected.startsWith("'") && parsedExpected.endsWith("'")) {
      parsedExpected = parsedExpected.slice(1, -1);
    }

    // Compare
    if (operator === '==') {
      return actualValue === parsedExpected;
    } else if (operator === '!=') {
      return actualValue !== parsedExpected;
    }

    return false;
  }

  /**
   * Topological sort of services based on dependencies
   */
  private topologicalSort(enabledServices: Set<string>): string[] {
    const services = this.topology.topology.services;
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    // Initialize
    for (const serviceName of enabledServices) {
      graph.set(serviceName, new Set());
      inDegree.set(serviceName, 0);
    }

    // Build graph
    for (const serviceName of enabledServices) {
      const service = services[serviceName];
      const requires = service.infrastructure.requires || [];

      for (const dep of requires) {
        if (enabledServices.has(dep)) {
          graph.get(dep)!.add(serviceName);
          inDegree.set(serviceName, (inDegree.get(serviceName) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const sorted: string[] = [];

    for (const [serviceName, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(serviceName);
      }
    }

    while (queue.length > 0) {
      const serviceName = queue.shift()!;
      sorted.push(serviceName);

      for (const dependent of graph.get(serviceName)!) {
        inDegree.set(dependent, inDegree.get(dependent)! - 1);
        if (inDegree.get(dependent) === 0) {
          queue.push(dependent);
        }
      }
    }

    // Check for cycles
    if (sorted.length !== enabledServices.size) {
      throw new Error('Circular dependency detected');
    }

    return sorted;
  }

  /**
   * Build render context for a service
   */
  private buildServiceContext(serviceName: string, service: Service): any {
    const infra = service.infrastructure;
    const config = service.configuration;

    // Build environment variables map
    const envVars: Record<string, any> = {};
    if (config && config.properties) {
      for (const [fieldName, fieldDef] of Object.entries(config.properties)) {
        const envVar = fieldDef['x-env-var'];
        if (envVar && fieldDef.default !== undefined) {
          envVars[envVar] = fieldDef.default;
        }
      }
    }

    return {
      // Service identifiers
      service_name: serviceName,
      container_name: infra.container_name,
      hostname: infra.hostname || infra.container_name,

      // Image
      image: infra.image,

      // Network
      network: this.topology.topology.network.name,

      // Ports
      port: infra.port,
      published_port: infra.published_port,
      bind: infra.bind || '0.0.0.0',

      // Dependencies
      requires: infra.requires || [],

      // Volumes
      volumes: infra.volumes || [],

      // Health check
      healthcheck: infra.healthcheck,

      // Environment variables
      env: envVars,
      environment: envVars, // alias

      // Configuration
      configuration: config?.properties || {},

      // Infrastructure
      infrastructure: infra,

      // Metadata
      description: infra.description || '',
      websocket: infra.websocket || false,
      external_subdomain: infra.external_subdomain,

      // Secrets (if referenced)
      secrets: this.topology.secrets || {}
    };
  }

  /**
   * Render a single template file
   */
  renderTemplate(templatePath: string, context: any): string {
    return this.env.render(templatePath, context);
  }

  /**
   * Render all .njk templates for enabled services
   */
  renderAll(options: RenderOptions): Map<string, string> {
    const { templatesDir, outputDir } = options;
    const results = new Map<string, string>();

    // Get enabled services
    const { services: enabledServices, startup_order } = this.getEnabledServices();

    console.log(`Enabled services: ${Array.from(enabledServices).sort().join(', ')}`);
    console.log(`Startup order: ${startup_order.join(' -> ')}`);
    console.log();

    // Find all .njk template files
    const templateFiles = this.findTemplateFiles(templatesDir);

    for (const templateFile of templateFiles) {
      const templateName = basename(templateFile, '.njk');

      // Match template to service
      // Template naming convention: servicename.container.njk or servicename.volume.njk
      const match = templateName.match(/^([^.]+)\.(.+)$/);
      if (!match) continue;

      const [, serviceName, fileType] = match;

      // Only render if service is enabled
      if (!enabledServices.has(serviceName)) {
        continue;
      }

      const service = this.topology.topology.services[serviceName];
      const context = this.buildServiceContext(serviceName, service);

      // Add global context
      context.topology = this.topology;
      context.enabled_services = Array.from(enabledServices);
      context.startup_order = startup_order;

      // Render template
      const relativePath = templateFile.replace(templatesDir + '/', '');
      const rendered = this.renderTemplate(relativePath, context);

      // Determine output filename
      const outputFilename = join(outputDir, `${serviceName}.${fileType}`);

      // Store result
      results.set(outputFilename, rendered);

      console.log(`Rendered: ${outputFilename}`);
    }

    return results;
  }

  /**
   * Render all templates and write to disk
   */
  renderAndWrite(options: RenderOptions): void {
    const results = this.renderAll(options);

    for (const [filename, content] of results.entries()) {
      writeFileSync(filename, content, 'utf-8');
    }

    console.log(`\n✅ Rendered ${results.size} file(s)`);
  }

  /**
   * Find all .njk template files in a directory
   */
  private findTemplateFiles(dir: string): string[] {
    const templates: string[] = [];

    const traverse = (currentDir: string): void => {
      const items = readdirSync(currentDir);

      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (extname(item) === '.njk') {
          templates.push(fullPath);
        }
      }
    };

    traverse(dir);
    return templates;
  }

  /**
   * Render a single service for webapp use
   * Returns the rendered quadlet as a string
   */
  renderService(serviceName: string, templateType: 'container' | 'volume' | 'network' = 'container'): string {
    const service = this.topology.topology.services[serviceName];
    if (!service) {
      throw new Error(`Service '${serviceName}' not found in topology`);
    }

    const context = this.buildServiceContext(serviceName, service);
    context.topology = this.topology;

    // Assume template naming convention: servicename.container.njk
    const templateName = `${serviceName}.${templateType}.njk`;

    return this.renderTemplate(templateName, context);
  }
}

/**
 * Helper function for quick rendering from file
 */
export function renderFromFile(topologyPath: string, templatesDir: string, outputDir: string): void {
  const content = readFileSync(topologyPath, 'utf-8');
  const topology = JSON.parse(content);

  const renderer = new NunjucksRenderer(topology, templatesDir);
  renderer.renderAndWrite({ templatesDir, outputDir });
}
