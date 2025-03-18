#!/usr/bin/env node

// This is the main entry point for the code-connoisseur CLI application
// Make sure the env file is loaded first, regardless of how the CLI is invoked
const fs = require('fs-extra');
const path = require('path');
const dotenv = require('dotenv');

// Try to load environment variables from multiple locations
const os = require('os');
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.code-connoisseur-config');
const GLOBAL_ENV_FILE = path.join(GLOBAL_CONFIG_DIR, '.env');

// Make sure we don't break on failure if directories don't exist
try {
  fs.ensureDirSync(GLOBAL_CONFIG_DIR);
} catch (err) {
  // Ignore errors, we just won't load from that location
}

// Check if this is the setup command - changed order of precedence for setup
const isSetupCommand = process.argv.includes('setup');

// Order of priority for env files changes based on command
// For setup, we want to prioritize global config
// For other commands, we want to check local project first, then fall back to global
const envPaths = isSetupCommand ? 
  [
    GLOBAL_ENV_FILE,                        // Global config .env (prioritized for setup)
    path.join(process.cwd(), '.env'),       // Project-specific .env
    path.join(__dirname, '.env')            // Package directory .env
  ] : 
  [
    GLOBAL_ENV_FILE,                        // Global config .env (try first for API keys)
    path.join(process.cwd(), '.env'),       // Project-specific .env (for project-specific settings)
    path.join(__dirname, '.env')            // Package directory .env
  ];

let envLoaded = false;
let loadedPath = null;

for (const envPath of envPaths) {
  try {
    if (fs.existsSync(envPath)) {
      const result = dotenv.config({ path: envPath, override: false }); // Don't override existing env vars
      if (!result.error) {
        // Only log this when not in npm install to reduce noise
        if (!process.env.npm_config_global) {
          console.log(`Loaded environment from: ${envPath}`);
        }
        loadedPath = envPath;
        envLoaded = true;
        
        // If we loaded the global config, that's enough for API keys
        if (envPath === GLOBAL_ENV_FILE) {
          break;
        }
      }
    }
  } catch (err) {
    // Silently continue to the next file
  }
}

if (!envLoaded && !isSetupCommand) {
  console.warn('Warning: No API keys found! You need to run setup.');
  console.warn(`Run 'code-connoisseur setup' to configure your API keys.`);
} else if (envLoaded && loadedPath) {
  // Check if we loaded from the global location (first priority)
  if (loadedPath !== GLOBAL_ENV_FILE && !isSetupCommand) {
    // If we loaded from a project .env but not the global, show a reminder
    console.log(`Note: Using project-specific configuration from ${loadedPath}`);
    console.log(`Global configuration can be set with 'code-connoisseur setup'`);
  }
}

// Now load the actual CLI application
require('./src/cli');