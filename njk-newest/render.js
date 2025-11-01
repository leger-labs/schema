#!/usr/bin/env node
/**
 * Simple Nunjucks Renderer for schema.json format
 *
 * This renderer works with the NEW schema.json user-config format:
 * - infrastructure (network, services)
 * - features (boolean flags)
 * - providers (enum selections)
 * - provider_config (detailed settings)
 * - secrets (template pointers)
 */

import nunjucks from 'nunjucks';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node render.js <user-config.json> <templates-dir> <output-dir>');
  console.log('');
  console.log('Example:');
  console.log('  node render.js ../test-configs/user-config.json .. ../test-output');
  process.exit(1);
}

const [configPath, templatesDir, outputDir] = args;

console.log('📋 Leger Schema Renderer');
console.log('========================');
console.log('');
console.log('Config:', configPath);
console.log('Templates:', templatesDir);
console.log('Output:', outputDir);
console.log('');

// Load user configuration
let userConfig;
try {
  userConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  console.log('✅ Loaded user configuration');
} catch (e) {
  console.error('❌ Failed to load user configuration:', e.message);
  process.exit(1);
}

// Load release catalog
let releaseCatalog;
const catalogPath = join(templatesDir, 'release-catalog.json');
try {
  releaseCatalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
  console.log('✅ Loaded release catalog');
} catch (e) {
  console.error('⚠️  Warning: Could not load release-catalog.json');
  releaseCatalog = { services: {}, release: { version: '0.0.1' } };
}

// Configure Nunjucks environment
const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(templatesDir, {
    noCache: true,
    watch: false
  }),
  {
    autoescape: false,
    throwOnUndefined: false,
    trimBlocks: true,
    lstripBlocks: true
  }
);

// Add custom filters
env.addFilter('fromJson', (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return {};
  }
});

env.addFilter('capitalize', (str) => {
  if (!str || typeof str !== 'string') {
    return str;
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
});

env.addFilter('lower', (str) => {
  if (str === null || str === undefined) {
    return str;
  }
  // Convert to string first if it's not already
  const strValue = typeof str === 'string' ? str : String(str);
  return strValue.toLowerCase();
});

// Store current template path for relative resolution
let currentTemplatePath = null;

// Add readFile function to global context with improved path resolution
env.addGlobal('readFile', (path) => {
  try {
    let fullPath;

    // If path starts with ../ or ./, resolve relative to current template
    if (path.startsWith('../') || path.startsWith('./')) {
      if (currentTemplatePath) {
        const templateDir = dirname(join(templatesDir, currentTemplatePath));
        fullPath = resolve(templateDir, path);
      } else {
        // Fallback to templates root
        fullPath = resolve(templatesDir, path);
      }
    } else {
      // Absolute path from templates root
      fullPath = join(templatesDir, path);
    }

    const content = readFileSync(fullPath, 'utf-8');
    return content;
  } catch (e) {
    console.error(`⚠️  Warning: Could not read file ${path}: ${e.message}`);
    if (currentTemplatePath) {
      console.error(`    (called from template: ${currentTemplatePath})`);
    }
    return '{}';
  }
});

// Create output directory
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Helper function to recursively find .njk files
function findNjkFiles(dir, baseDir = dir) {
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findNjkFiles(fullPath, baseDir));
      } else if (entry.endsWith('.njk') &&
                 !entry.startsWith('base-') &&
                 entry !== 'macros.njk') {
        const relativePath = relative(baseDir, fullPath);
        files.push({
          path: relativePath,
          relativePath: relativePath
        });
      }
    }
  } catch (e) {
    console.error(`⚠️  Warning: Could not scan ${dir}: ${e.message}`);
  }
  return files;
}

// Find all .njk template files (excluding macros.njk and base-container.njk)
const templateFiles = [];

// Find root level templates
const rootTemplates = ['llm.network.njk'];
rootTemplates.forEach(template => {
  const templatePath = join(templatesDir, template);
  if (existsSync(templatePath)) {
    templateFiles.push({ path: template, relativePath: template });
  }
});

// Find service templates
const serviceDirs = [
  'openwebui',
  'litellm',
  'qdrant',
  'searxng',
  'tika',
  'jupyter',
  'whisper',
  'edgetts',
  'comfyui',
  'caddy',
  'cockpit',
  'llama-swap',
  'mcp-context-forge'
];

serviceDirs.forEach(serviceDir => {
  const servicePath = join(templatesDir, serviceDir);
  if (existsSync(servicePath)) {
    const files = findNjkFiles(servicePath, templatesDir);
    templateFiles.push(...files);
  }
});

console.log(`📄 Found ${templateFiles.length} template files`);
console.log('');

// Prepare rendering context
// The templates expect this structure:
// - infrastructure.services.X
// - infrastructure.network
// - features.X
// - providers.X
// - provider_config.X
// - secrets.X
const context = {
  infrastructure: userConfig.infrastructure || {},
  features: userConfig.features || {},
  providers: userConfig.providers || {},
  provider_config: userConfig.provider_config || {},
  secrets: userConfig.secrets || {},

  // Tailscale configuration (referenced by templates)
  tailscale: {
    full_hostname: userConfig.tailscale?.full_hostname || 'blueprint.tail8dd1.ts.net',
    hostname: userConfig.tailscale?.hostname || 'blueprint',
    tailnet: userConfig.tailscale?.tailnet || 'tail8dd1.ts.net'
  },

  // For templates that reference specific services directly
  openwebui: {
    providers: userConfig.providers || {},
    features: userConfig.features || {},
    service: {
      timeout_start_sec: userConfig.provider_config?.openwebui_timeout_start || 900
    }
  },
  litellm: userConfig.litellm || {
    providers: userConfig.providers || {},
    features: userConfig.features || {},
    models: [],
    database_url: "postgresql://litellm@litellm-postgres:5432/litellm",
    drop_params: true
  },
  local_inference: userConfig.local_inference || {
    models: {}
  },
  qdrant: {
    providers: userConfig.providers || {},
    features: userConfig.features || {}
  },
  searxng: {
    providers: userConfig.providers || {},
    features: userConfig.features || {}
  },
  jupyter: {
    providers: userConfig.providers || {},
    features: userConfig.features || {}
  },
  mcp_context_forge: {
    providers: userConfig.providers || {},
    features: userConfig.features || {},
    jwt_algorithm: 'HS256',
    environment: 'production',
    log_level: 'INFO'
  },

  // Release catalog is loaded via readFile in templates
  catalog: releaseCatalog
};

// Validate that all referenced services exist
function validateContext(context) {
  const warnings = [];

  // Check if services reference non-existent dependencies
  Object.entries(context.infrastructure?.services || {}).forEach(([name, service]) => {
    if (service.requires) {
      service.requires.forEach(dep => {
        if (!context.infrastructure.services[dep]) {
          warnings.push(`Service '${name}' requires '${dep}' but it's not defined`);
        }
      });
    }
  });

  return warnings;
}

const contextWarnings = validateContext(context);
if (contextWarnings.length > 0) {
  console.log('');
  console.log('⚠️  Context Warnings:');
  contextWarnings.forEach(w => console.log(`   ${w}`));
  console.log('');
}

// Render templates
let successCount = 0;
let errorCount = 0;

console.log('🎨 Rendering templates...');
console.log('');

templateFiles.forEach(({ path, relativePath }) => {
  try {
    // Set current template path for readFile() resolution
    currentTemplatePath = path;

    // Determine output filename
    // Convert .njk extensions to appropriate output extension
    let outputName = relativePath.replace(/\.njk$/, '');

    // Flatten directory structure for output
    outputName = outputName.replace(/\//g, '.');

    const outputPath = join(outputDir, outputName);

    // Render template
    const rendered = env.render(path, context);

    // Create output directory if needed
    const outputDirPath = dirname(outputPath);
    if (!existsSync(outputDirPath)) {
      mkdirSync(outputDirPath, { recursive: true });
    }

    // Write output
    writeFileSync(outputPath, rendered);

    console.log(`  ✅ ${outputName}`);
    successCount++;
  } catch (e) {
    console.log(`  ❌ ${relativePath}: ${e.message}`);
    errorCount++;

    // Enhanced debugging
    if (process.env.DEBUG) {
      console.error('\n   Full error:');
      console.error(e.stack);
      console.error('\n   Template context keys:', Object.keys(context));
    } else {
      console.error(`   Run with DEBUG=1 for stack trace`);
    }
  } finally {
    currentTemplatePath = null;
  }
});

console.log('');
console.log('========================');
console.log('📊 Rendering Complete');
console.log('');
console.log(`✅ Success: ${successCount}`);
if (errorCount > 0) {
  console.log(`❌ Errors: ${errorCount}`);
}
console.log('');
console.log(`Output directory: ${outputDir}`);

process.exit(errorCount > 0 ? 1 : 0);
