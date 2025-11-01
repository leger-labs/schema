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
import { join, dirname, relative } from 'path';

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

// Add readFile function to global context
env.addGlobal('readFile', (path) => {
  try {
    const fullPath = join(templatesDir, path);
    return readFileSync(fullPath, 'utf-8');
  } catch (e) {
    console.error(`⚠️  Warning: Could not read file ${path}: ${e.message}`);
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

  // For templates that reference specific services directly
  openwebui: {
    providers: userConfig.providers || {},
    features: userConfig.features || {},
    service: {
      timeout_start_sec: userConfig.provider_config?.openwebui_timeout_start || 900
    }
  },
  litellm: {
    providers: userConfig.providers || {},
    features: userConfig.features || {}
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

  // Release catalog is loaded via readFile in templates
  catalog: releaseCatalog
};

// Render templates
let successCount = 0;
let errorCount = 0;

console.log('🎨 Rendering templates...');
console.log('');

templateFiles.forEach(({ path, relativePath }) => {
  try {
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

    // Print stack trace for debugging
    if (process.env.DEBUG) {
      console.error(e.stack);
    }
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
