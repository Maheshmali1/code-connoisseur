#!/usr/bin/env node

/**
 * This script runs after npm install to set up the initial configuration
 * It helps users configure their API keys and other settings
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Try to load optional dependencies, but don't fail if they're not available
let inquirer, chalk;
try {
  inquirer = require('inquirer');
} catch (err) {
  // If inquirer isn't available, we'll handle it later
  console.warn('Warning: inquirer package not found. Interactive setup may not work properly.');
}

try {
  chalk = require('chalk');
} catch (err) {
  // Create a simple chalk-like interface if chalk isn't available
  chalk = {
    cyan: (text) => text,
    green: (text) => text,
    yellow: (text) => text,
    red: (text) => text,
    bold: {
      cyan: (text) => text
    }
  };
}

// Global config directory in user's home folder
const CONFIG_DIR = path.join(os.homedir(), '.code-connoisseur-config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const GLOBAL_ENV_FILE = path.join(CONFIG_DIR, '.env');

// Don't run this script in CI/CD environments
if (process.env.CI || process.env.CONTINUOUS_INTEGRATION) {
  console.log('CI environment detected, skipping interactive setup');
  process.exit(0);
}

// Check if running as part of npm install
const isNpmInstall = process.env.npm_config_global === 'true' || 
                     process.env.npm_command === 'install';

// Skip interactive prompts during npm install to avoid SIGINT errors
if (isNpmInstall) {
  console.log('');
  console.log('Code Connoisseur has been installed successfully!');
  console.log('');
  console.log('To complete setup and configure your API keys, please run:');
  console.log('  code-connoisseur setup');
  console.log('');
  console.log('For help and available commands:');
  console.log('  code-connoisseur --help');
  console.log('');
  process.exit(0);
}

// If this script is being executed directly
async function main() {
  console.log(chalk.cyan.bold('\n📝 Code Connoisseur Setup Wizard'));
  console.log(chalk.cyan('=================================\n'));
  console.log('This wizard will help you set up Code Connoisseur for first use.\n');
  
  // Check if inquirer is available
  if (!inquirer) {
    console.error('Error: The inquirer package is required for interactive setup.');
    console.error('Please run: npm install inquirer@8.2.6');
    console.error('Then run this setup again.');
    process.exit(1);
  }

  // Check if configuration already exists
  const configExists = fs.existsSync(CONFIG_FILE);
  
  if (configExists) {
    const { runSetup } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'runSetup',
        message: 'Configuration already exists. Do you want to reconfigure?',
        default: false
      }
    ]);
    
    if (!runSetup) {
      console.log(chalk.green('\nUsing existing configuration. Setup completed!'));
      console.log(`\nTo use Code Connoisseur, run ${chalk.cyan('code-connoisseur --help')}`);
      console.log(`To reconfigure later, run ${chalk.cyan('code-connoisseur setup')}`);
      process.exit(0);
    }
  }

  // Ensure config directory exists
  fs.ensureDirSync(CONFIG_DIR);
  
  console.log('Code Connoisseur uses OpenAI, Anthropic, or Pinecone (optional) for enhanced features.');
  console.log('You can get your API keys from:');
  console.log(chalk.cyan('- OpenAI: https://platform.openai.com/'));
  console.log(chalk.cyan('- Anthropic: https://console.anthropic.com/'));
  console.log(chalk.cyan('- Pinecone (optional): https://app.pinecone.io/'));
  console.log('\nYou can skip any key you do not have yet.\n');
  
  // Gather API keys
  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'openaiApiKey',
      message: 'Enter your OpenAI API key (or press Enter to skip):',
      mask: '*',
      validate: (input) => {
        if (!input) return true; // Skip is allowed
        return input.startsWith('sk-') ? true : 'OpenAI API keys should start with "sk-"';
      }
    },
    {
      type: 'password',
      name: 'anthropicApiKey',
      message: 'Enter your Anthropic API key (or press Enter to skip):',
      mask: '*',
      validate: (input) => {
        if (!input) return true; // Skip is allowed
        return input.startsWith('sk-ant-') ? true : 'Anthropic API keys should start with "sk-ant-"';
      }
    },
    {
      type: 'password',
      name: 'pineconeApiKey',
      message: 'Enter your Pinecone API key (optional, press Enter to skip):',
      mask: '*'
    },
    {
      type: 'list',
      name: 'defaultProvider',
      message: 'Choose your default LLM provider:',
      choices: [
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'OpenAI (GPT)', value: 'openai' }
      ],
      default: 'anthropic',
      when: (answers) => answers.openaiApiKey || answers.anthropicApiKey
    }
  ]);
  
  // Save configuration file
  const config = {
    version: '1.0.0',
    indexName: 'code-connoisseur',
    llmProvider: answers.defaultProvider || 'anthropic',
    extensions: ['js', 'ts', 'jsx', 'tsx', 'py'],
    excludeDirs: ['node_modules', 'dist', 'build', '.git', 'venv', '__pycache__']
  };
  
  fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
  
  // Create .env file with API keys
  let envContent = '';
  
  if (answers.openaiApiKey) {
    envContent += `OPENAI_API_KEY=${answers.openaiApiKey}\n`;
  }
  
  if (answers.anthropicApiKey) {
    envContent += `ANTHROPIC_API_KEY=${answers.anthropicApiKey}\n`;
  }
  
  if (answers.pineconeApiKey) {
    envContent += `PINECONE_API_KEY=${answers.pineconeApiKey}\n`;
  }
  
  if (answers.defaultProvider) {
    envContent += `DEFAULT_LLM_PROVIDER=${answers.defaultProvider}\n`;
  }
  
  // Save .env file with secure permissions
  try {
    fs.writeFileSync(GLOBAL_ENV_FILE, envContent, { mode: 0o600 }); // Secure permissions
    console.log(`API keys stored securely in: ${GLOBAL_ENV_FILE}`);
  } catch (error) {
    console.error(`Error saving API keys: ${error.message}`);
    console.error(`Attempted to save to: ${GLOBAL_ENV_FILE}`);
    
    // Try with more permissive permissions as a fallback
    try {
      fs.writeFileSync(GLOBAL_ENV_FILE, envContent, { mode: 0o644 });
      console.log(`API keys stored with standard permissions in: ${GLOBAL_ENV_FILE}`);
      console.log('Warning: Consider securing this file manually.');
    } catch (fallbackError) {
      console.error(`Failed to save API keys: ${fallbackError.message}`);
      process.exit(1);
    }
  }
  
  console.log(chalk.green('\n✅ Setup completed successfully!'));
  console.log(`\nTo use Code Connoisseur, run ${chalk.cyan('code-connoisseur --help')}`);
  console.log(`Configuration is stored in: ${chalk.cyan(CONFIG_DIR)}`);
  
  // Instructions if missing API keys
  if (!answers.openaiApiKey && !answers.anthropicApiKey) {
    console.log(chalk.yellow('\n⚠️ Warning: No API keys provided.'));
    console.log('You will need at least one API key to use Code Connoisseur effectively.');
    console.log(`You can run ${chalk.cyan('code-connoisseur setup')} anytime to configure your API keys.`);
  }
  
  console.log('\nHappy coding!');
}

// Run the setup wizard
main().catch(error => {
  console.error(chalk.red('Error during setup:'), error.message);
  process.exit(1);
});