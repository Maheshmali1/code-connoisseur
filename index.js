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

const envPaths = [
  path.join(process.cwd(), '.env'),           // Project-specific .env
  path.join(__dirname, '.env'),               // Package directory .env
  GLOBAL_ENV_FILE                            // Global config .env
];

let envLoaded = false;
for (const envPath of envPaths) {
  try {
    if (fs.existsSync(envPath)) {
      const result = dotenv.config({ path: envPath });
      if (!result.error) {
        // Only log this when not in npm install to reduce noise
        if (!process.env.npm_config_global) {
          console.log(`Loaded environment from: ${envPath}`);
        }
        envLoaded = true;
        break;
      }
    }
  } catch (err) {
    // Silently continue to the next file
  }
}

// Check for setup command - don't show warning if user is trying to run setup
const isSetupCommand = process.argv.includes('setup');

if (!envLoaded && !isSetupCommand) {
  console.warn('Warning: No .env file found! You may need to run setup.');
  console.warn(`Run 'code-connoisseur setup' to configure your API keys.`);
}

// Now load the actual CLI application
require('./src/cli');