#!/usr/bin/env node
/**
 * CLI Example
 *
 * Demonstrates how to use the tools from command line
 */

import { readFileSync } from 'fs';
import { SchemaValidator } from '../src/validators/schemaValidator.js';
import { TopologyValidator } from '../src/validators/topologyValidator.js';
import { NunjucksRenderer } from '../src/generators/nunjucksRenderer.js';
import { StateTracker } from '../src/state/stateTracker.js';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage:');
  console.log('  node cli-example.js validate <topology.json>');
  console.log('  node cli-example.js render <topology.json> <templates-dir> <output-dir>');
  console.log('  node cli-example.js state <topology.json>');
  process.exit(1);
}

const [command, topologyPath, ...rest] = args;

// Load topology
const topologyContent = readFileSync(topologyPath, 'utf-8');
const topology = JSON.parse(topologyContent);

switch (command) {
  case 'validate': {
    console.log('Running validation...\n');

    // JSON Schema validation
    const schemaPath = rest[0] || '../njk/njk-schema-011CUP2BgHZxsGMrx3Tk7aQk/topology-schema.json';
    const schemaValidator = new SchemaValidator(schemaPath);
    const schemaResult = schemaValidator.validateTopology(topology);
    schemaValidator.printResults(schemaResult);

    if (!schemaResult.valid) {
      process.exit(1);
    }

    console.log('\n---\n');

    // Topology validation
    const topologyValidator = new TopologyValidator(topology);
    const topologyResult = topologyValidator.validate();
    topologyValidator.printResults(topologyResult, true);

    if (!topologyResult.valid) {
      process.exit(1);
    }

    break;
  }

  case 'render': {
    const [templatesDir, outputDir] = rest;

    if (!templatesDir || !outputDir) {
      console.error('Error: templates-dir and output-dir are required');
      process.exit(1);
    }

    console.log('Rendering templates...\n');

    const renderer = new NunjucksRenderer(topology, templatesDir);
    renderer.renderAndWrite({ templatesDir, outputDir });

    break;
  }

  case 'state': {
    console.log('Computing configuration state...\n');

    const tracker = new StateTracker(topology);
    const state = tracker.computeState();

    console.log(JSON.stringify(state, null, 2));

    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
