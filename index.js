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

const envPaths = [
  path.join(process.cwd(), '.env'),           // Project-specific .env
  path.join(__dirname, '.env'),               // Package directory .env
  GLOBAL_ENV_FILE                            // Global config .env
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Loaded environment from: ${envPath}`);
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  console.warn('Warning: No .env file found! You may need to run setup.');
  console.warn(`Run 'code-connoisseur setup' to configure your API keys.`);
}

// Now load the actual CLI application
require('./src/cli');