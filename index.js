#!/usr/bin/env node

// This is the main entry point for the code-connoisseur CLI application
// Make sure the env file is loaded first, regardless of how the CLI is invoked
const fs = require('fs-extra');
const path = require('path');
const dotenv = require('dotenv');

// First, try to load environment variables
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '.env')
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`CLI startup: Loaded environment from ${envPath}`);
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  console.error('Warning: No .env file found in CLI startup');
}

// Now load the actual CLI application
require('./src/cli');