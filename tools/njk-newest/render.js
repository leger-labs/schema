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

// ============================================================================
// MODEL RESOLUTION
// ============================================================================

/**
 * Fetch model definition from model-store
 * @param {string} modelId - Model ID (e.g., "gpt-5", "qwen3-4b")
 * @param {string} type - "cloud" or "local"
 * @param {string} modelStorePath - Path to model-store directory
 * @returns {object|null} - Resolved model definition or null if not found
 */
function fetchModelDefinition(modelId, type, modelStorePath) {
  const modelFile = join(modelStorePath, type, `${modelId}.json`);
  try {
    const content = readFileSync(modelFile, 'utf-8');
    const model = JSON.parse(content);

    // Validate model is enabled
    if (model.enabled === false) {
      console.warn(`⚠️  Model "${modelId}" is disabled in model-store`);
      return null;
    }

    // Warn if deprecated
    if (model.deprecated) {
      console.warn(`⚠️  Model "${modelId}" is deprecated`);
      if (model.replacement) {
        console.warn(`    Consider using "${model.replacement}" instead`);
      }
    }

    return model;
  } catch (e) {
    console.error(`❌ Could not load ${type} model "${modelId}": ${e.message}`);
    return null;
  }
}

/**
 * Resolve all model IDs to full definitions
 * @param {object} userConfig - User configuration with model IDs
 * @param {string} modelStorePath - Path to model-store directory
 * @returns {object} - Resolved models organized by type
 */
function resolveModels(userConfig, modelStorePath) {
  const resolved = {
    cloud: [],
    local: {}
  };

  // Resolve cloud models
  if (userConfig.models?.cloud) {
    console.log(`🔍 Resolving ${userConfig.models.cloud.length} cloud models...`);
    for (const modelId of userConfig.models.cloud) {
      const model = fetchModelDefinition(modelId, 'cloud', modelStorePath);
      if (model) {
        resolved.cloud.push(model);
        console.log(`  ✅ ${modelId}`);
      }
    }
  }

  // Resolve local models
  if (userConfig.models?.local) {
    console.log(`🔍 Resolving ${userConfig.models.local.length} local models...`);
    for (const modelId of userConfig.models.local) {
      const model = fetchModelDefinition(modelId, 'local', modelStorePath);
      if (model) {
        // Use model ID as key (matches template expectations)
        resolved.local[modelId] = model;
        console.log(`  ✅ ${modelId}`);
      }
    }
  }

  return resolved;
}

/**
 * Transform resolved cloud models to LiteLLM format
 * @param {array} cloudModels - Array of resolved cloud model definitions
 * @returns {array} - LiteLLM-compatible model configurations
 */
function transformCloudModelsForLiteLLM(cloudModels) {
  return cloudModels.map(model => ({
    // Core identifiers
    name: model.id,
    provider: model.provider,
    litellm_model_name: model.litellm_model_name,

    // API configuration (name only, not actual value)
    requires_api_key: model.requires_api_key,

    // Capabilities
    context_window: model.context_window,
    max_output: model.max_output,

    // Metadata
    description: model.description || '',
    capabilities: model.capabilities || [],

    // Control
    enabled: true
  }));
}

/**
 * Transform resolved local models for llama-swap format
 * @param {object} localModels - Object of resolved local model definitions
 * @returns {object} - Llama-swap compatible model configurations
 */
function transformLocalModelsForLlamaSwap(localModels) {
  const transformed = {};

  for (const [modelId, model] of Object.entries(localModels)) {
    transformed[modelId] = {
      // Core identifiers
      name: model.id,
      display_name: model.name,

      // Model location
      model_uri: model.model_uri,

      // Configuration
      enabled: true,
      group: model.group,

      // Metadata
      description: model.description || '',
      quantization: model.quantization,
      ram_required_gb: model.ram_required_gb,
      context_length: model.context_window,

      // Runtime settings
      ctx_size: model.ctx_size || model.context_window,
      ttl: model.ttl !== undefined ? model.ttl : 0,

      // Hardware
      flash_attn: model.flash_attn !== false,
      vulkan_driver: model.vulkan_driver || 'RADV',

      // HuggingFace details (if available)
      ...(model.hf_repo && { hf_repo: model.hf_repo }),
      ...(model.hf_file && { hf_file: model.hf_file }),

      // Aliases (if any)
      ...(model.aliases && { aliases: model.aliases }),

      // Embedding-specific
      ...(model.embedding_dimension && { embedding_dimension: model.embedding_dimension })
    };
  }

  return transformed;
}

// ============================================================================
// MODEL REFERENCE COLLECTION & VALIDATION
// ============================================================================

/**
 * Collect all model references from provider_config
 * These are fields marked with x-model-reference in schema
 * @param {object} userConfig - User configuration
 * @returns {array} - Array of model reference objects
 */
function collectModelReferences(userConfig) {
  const references = [];

  // Task model fields
  const taskModelFields = [
    'task_model_title',
    'task_model_tags',
    'task_model_autocomplete',
    'task_model_query',
    'task_model_search_query',
    'task_model_rag_template'
  ];

  taskModelFields.forEach(field => {
    const modelId = userConfig.provider_config?.[field];
    if (modelId && modelId !== '') {
      references.push({
        field,
        modelId,
        type: 'local',  // Task models should be local for speed
        groupFilter: 'task'
      });
    }
  });

  // RAG embedding model
  if (userConfig.features?.rag) {
    const embeddingProvider = userConfig.providers?.rag_embedding;

    if (embeddingProvider === 'openai') {
      const modelId = userConfig.provider_config?.rag_embedding_model;
      if (modelId) {
        references.push({
          field: 'rag_embedding_model',
          modelId,
          type: 'local',
          groupFilter: 'embeddings'
        });
      }
    } else if (embeddingProvider === 'ollama') {
      const modelId = userConfig.provider_config?.ollama_embedding_model;
      if (modelId) {
        references.push({
          field: 'ollama_embedding_model',
          modelId,
          type: 'local',
          groupFilter: 'embeddings'
        });
      }
    }
  }

  return references;
}

/**
 * Auto-install referenced models not in user's models list
 * @param {object} userConfig - User configuration (will be mutated)
 * @param {array} modelReferences - Array of model reference objects
 * @param {string} modelStorePath - Path to model-store directory
 * @returns {array} - Array of auto-installed model IDs
 */
function autoInstallReferencedModels(userConfig, modelReferences, modelStorePath) {
  // Ensure models.local array exists
  if (!userConfig.models) {
    userConfig.models = { cloud: [], local: [] };
  }
  if (!userConfig.models.local) {
    userConfig.models.local = [];
  }

  const existingLocal = new Set(userConfig.models.local);
  const autoInstalled = [];

  for (const ref of modelReferences) {
    if (ref.type === 'local' && !existingLocal.has(ref.modelId)) {
      // Verify model exists in model-store before auto-installing
      const modelPath = join(modelStorePath, 'local', `${ref.modelId}.json`);

      if (existsSync(modelPath)) {
        userConfig.models.local.push(ref.modelId);
        existingLocal.add(ref.modelId); // Update the set to avoid duplicates
        autoInstalled.push(ref.modelId);
        console.log(`  ✅ Auto-installed: ${ref.modelId} (referenced by ${ref.field})`);
      } else {
        console.error('');
        console.error(`❌ Referenced model '${ref.modelId}' not found in model-store`);
        console.error(`   Field: ${ref.field}`);
        console.error(`   Path: ${modelPath}`);
        console.error('');
        process.exit(1);
      }
    }
  }

  return autoInstalled;
}

/**
 * Validate model references after resolution
 * @param {array} modelReferences - Array of model reference objects
 * @param {object} resolvedModels - Resolved models from model-store
 * @returns {array} - Array of validation error messages (empty if valid)
 */
function validateModelReferences(modelReferences, resolvedModels) {
  const errors = [];

  const allModelIds = new Set([
    ...resolvedModels.cloud.map(m => m.id),
    ...Object.keys(resolvedModels.local)
  ]);

  for (const ref of modelReferences) {
    if (!allModelIds.has(ref.modelId)) {
      errors.push(`Field '${ref.field}' references unknown model '${ref.modelId}'`);
    }

    // Validate group filter if specified
    if (ref.groupFilter) {
      const model = resolvedModels.local[ref.modelId];
      if (model && model.group !== ref.groupFilter) {
        errors.push(
          `Field '${ref.field}' requires group '${ref.groupFilter}' ` +
          `but model '${ref.modelId}' is group '${model.group}'`
        );
      }
    }
  }

  return errors;
}

// ============================================================================
// SECRETS DETECTION (for manifest generation only - never actual values!)
// ============================================================================

/**
 * Provider to secret name mapping
 * NOTE: This maps to the secret NAMES in legerd, not actual values
 */
const PROVIDER_SECRET_MAP = {
  'openai': 'openai_api_key',
  'anthropic': 'anthropic_api_key',
  'gemini': 'gemini_api_key',
  'groq': 'groq_api_key',
  'mistral': 'mistral_api_key',
  'openrouter': 'openrouter_api_key',
  'cohere': 'cohere_api_key',
  'deepseek': 'deepseek_api_key'
};

/**
 * Detect which secrets are required based on resolved cloud models
 * Returns secret NAMES only, never actual values
 * @param {array} cloudModels - Resolved cloud models
 * @returns {array} - Array of required secret names
 */
function detectRequiredSecrets(cloudModels) {
  const required = new Set();

  for (const model of cloudModels) {
    const secretName = PROVIDER_SECRET_MAP[model.provider];
    if (secretName) {
      required.add(secretName);
    }
  }

  return Array.from(required).sort();
}

/**
 * Generate manifest of required secrets for user reference
 * This is informational only - actual secrets synced via "leger secrets sync"
 * @param {array} requiredSecrets - Array of secret names
 * @param {string} outputDir - Output directory
 */
function generateSecretsManifest(requiredSecrets, outputDir) {
  const manifest = {
    version: "0.0.1",
    required_secrets: requiredSecrets,
    note: "Run 'leger secrets sync' to sync these secrets from Cloudflare KV to legerd"
  };

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const manifestPath = join(outputDir, 'required-secrets.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  if (requiredSecrets.length > 0) {
    console.log('');
    console.log('🔑 Required secrets detected:');
    requiredSecrets.forEach(secret => console.log(`   - ${secret}`));
    console.log('');
    console.log('   Run: leger secrets sync');
    console.log('   Then: leger deploy install');
  }
}

/**
 * Build context with resolved models
 * NO SECRETS - those are managed orthogonally via leger CLI
 * @param {object} userConfig - User configuration
 * @param {object} resolvedModels - Resolved model definitions
 * @param {object} releaseCatalog - Release catalog
 * @returns {object} - Complete template context
 */
function buildContextWithModels(userConfig, resolvedModels, releaseCatalog) {
  // Build the litellm context with resolved models
  const litellmContext = {
    models: transformCloudModelsForLiteLLM(resolvedModels.cloud),
    database_url: userConfig.litellm?.database_url ||
                  "postgresql://litellm@litellm-postgres:5432/litellm",
    drop_params: userConfig.litellm?.drop_params !== false
  };

  // Build the local_inference context with resolved models
  const localInferenceContext = {
    models: transformLocalModelsForLlamaSwap(resolvedModels.local),
    groups: userConfig.local_inference?.groups || {},
    defaults: userConfig.local_inference?.defaults || {}
  };

  return {
    infrastructure: userConfig.infrastructure || {},
    features: userConfig.features || {},
    providers: userConfig.providers || {},
    provider_config: userConfig.provider_config || {},
    tailscale: userConfig.tailscale || {
      full_hostname: 'blueprint.tail8dd1.ts.net',
      hostname: 'blueprint',
      tailnet: 'tail8dd1.ts.net'
    },

    // ENHANCED: Resolved cloud models for LiteLLM
    litellm: litellmContext,

    // ENHANCED: Resolved local models for llama-swap
    local_inference: localInferenceContext,

    // For templates that reference specific services directly
    openwebui: {
      providers: userConfig.providers || {},
      features: userConfig.features || {},
      service: {
        timeout_start_sec: userConfig.provider_config?.openwebui_timeout_start || 900
      }
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

    // Release catalog
    catalog: releaseCatalog
  };
}

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

// NEW: Determine model store path (check if model-store exists in templates dir or use external)
const modelStorePath = existsSync(join(templatesDir, 'model-store'))
  ? join(templatesDir, 'model-store')
  : '/home/user/model-store';

console.log('📋 Enhanced Leger Renderer with Model Resolution');
console.log('='.repeat(60));
console.log('');
console.log('Config:', configPath);
console.log('Templates:', templatesDir);
console.log('Model Store:', modelStorePath);
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

// NEW: Collect model references from provider_config
console.log('');
console.log('🔍 Collecting model references from config...');
const modelReferences = collectModelReferences(userConfig);

if (modelReferences.length > 0) {
  console.log(`📋 Found ${modelReferences.length} model reference(s):`);
  modelReferences.forEach(ref => {
    console.log(`   - ${ref.field}: ${ref.modelId}`);
  });
} else {
  console.log('ℹ️  No model references found in provider_config');
}

// NEW: Auto-install referenced models
console.log('');
console.log('📦 Auto-installing referenced models...');
const autoInstalled = autoInstallReferencedModels(userConfig, modelReferences, modelStorePath);

if (autoInstalled.length > 0) {
  console.log('');
  console.log(`📦 Auto-installed ${autoInstalled.length} referenced model(s)`);
  console.log('');
}

// NEW: Resolve models from model-store
console.log('');
let resolvedModels = { cloud: [], local: {} };

if (userConfig.models) {
  console.log('🔍 Resolving model definitions from model-store...');
  resolvedModels = resolveModels(userConfig, modelStorePath);
  console.log('');
  console.log(`✅ Resolved ${resolvedModels.cloud.length} cloud models`);
  console.log(`✅ Resolved ${Object.keys(resolvedModels.local).length} local models`);
} else {
  console.log('ℹ️  No models specified in configuration');
}

// NEW: Validate model references
console.log('');
console.log('✅ Validating model references...');
const validationErrors = validateModelReferences(modelReferences, resolvedModels);

if (validationErrors.length > 0) {
  console.error('');
  console.error('❌ Model reference validation failed:');
  validationErrors.forEach(err => console.error(`   ${err}`));
  console.error('');
  process.exit(1);
}

if (modelReferences.length > 0) {
  console.log('✅ All model references validated successfully');
}

// NEW: Detect required secrets and generate manifest
const requiredSecrets = detectRequiredSecrets(resolvedModels.cloud);
generateSecretsManifest(requiredSecrets, outputDir);

console.log('');

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

// Find network templates (in network/ subdirectory)
const networkDir = join(templatesDir, 'network');
if (existsSync(networkDir)) {
  const files = findNjkFiles(networkDir, templatesDir);
  templateFiles.push(...files);
} else {
  // Fallback to old structure (root level templates)
  const rootTemplates = ['llm.network.njk'];
  rootTemplates.forEach(template => {
    const templatePath = join(templatesDir, template);
    if (existsSync(templatePath)) {
      templateFiles.push({ path: template, relativePath: template });
    }
  });
}

// Find service templates (in services/ subdirectory)
const servicesDir = join(templatesDir, 'services');
if (existsSync(servicesDir)) {
  // New structure: all services are in services/ subdirectory
  const files = findNjkFiles(servicesDir, templatesDir);
  templateFiles.push(...files);
} else {
  // Fallback to old structure (services at root level)
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
}

console.log(`📄 Found ${templateFiles.length} template files`);
console.log('');

// Build context with resolved models (NO SECRETS)
const context = buildContextWithModels(userConfig, resolvedModels, releaseCatalog);

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
