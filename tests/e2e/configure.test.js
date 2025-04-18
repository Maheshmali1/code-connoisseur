const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const {
  executeCommand,
  createTempFixture,
  cleanupTempFixture
} = require('../test-utils');

describe('code-connoisseur configure command', () => {
  let tempDir;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = path.join(os.tmpdir(), `code-connoisseur-test-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`);
    fs.ensureDirSync(tempDir);
  });

  afterEach(() => {
    // Clean up the temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  test('should create configuration file', async () => {
    // Execute the configure command with mock input
    // Note: Since the configure command is interactive, we can't easily test it directly
    // Instead, we'll test the configuration file creation by running the index command
    // which also creates a configuration file

    executeCommand(`index -d ${tempDir} -i test-index -e js,ts,py`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the configuration file was created
    const configPath = path.join(tempDir, '.code-connoisseur', 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    // Verify the configuration contains the expected values
    const config = fs.readJsonSync(configPath);
    expect(config.indexName).toBe('test-index');
    expect(config.extensions).toContain('js');
    expect(config.extensions).toContain('ts');
    expect(config.extensions).toContain('py');
  });

  test('should update configuration with new values', async () => {
    // First create an initial configuration
    executeCommand(`index -d ${tempDir} -i initial-index -e js,jsx`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify initial configuration
    const configPath = path.join(tempDir, '.code-connoisseur', 'config.json');
    const initialConfig = fs.readJsonSync(configPath);
    expect(initialConfig.indexName).toBe('initial-index');
    expect(initialConfig.extensions).toContain('js');
    expect(initialConfig.extensions).toContain('jsx');

    // Now update the configuration with a new index command
    executeCommand(`index -d ${tempDir} -i updated-index -e py,java`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the configuration was updated
    const updatedConfig = fs.readJsonSync(configPath);
    expect(updatedConfig.indexName).toBe('updated-index');
    expect(updatedConfig.extensions).toContain('py');
    expect(updatedConfig.extensions).toContain('java');
    expect(updatedConfig.extensions).not.toContain('js'); // Should be replaced
  });

  test('should update LLM provider configuration', async () => {
    // First create an initial configuration
    executeCommand(`index -d ${tempDir}`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789',
        DEFAULT_LLM_PROVIDER: 'anthropic' // Default provider
      },
      cwd: tempDir
    });

    // Verify initial configuration
    const configPath = path.join(tempDir, '.code-connoisseur', 'config.json');
    const initialConfig = fs.readJsonSync(configPath);
    expect(initialConfig.llmProvider).toBe('anthropic');

    // Create a sample file to review
    const sampleFile = path.join(tempDir, 'sample.js');
    fs.writeFileSync(sampleFile, `
      function add(a, b) {
        return a + b;
      }
      module.exports = { add };
    `);

    // Create a modified version of the file
    const modifiedFile = path.join(tempDir, 'sample.modified.js');
    fs.writeFileSync(modifiedFile, `
      function add(a, b) {
        // Added comment
        return a + b;
      }
      module.exports = { add };
    `);

    // Now update the LLM provider with a review command
    executeCommand(`review ${sampleFile} -o ${modifiedFile} -l openai`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir,
      // Don't fail if the review command fails, we just want to update the config
      failOnError: false
    });

    // Verify the configuration was updated
    const updatedConfig = fs.readJsonSync(configPath);
    expect(updatedConfig.llmProvider).toBe('openai');
  });

  test('should handle exclude directories configuration', async () => {
    // Execute the index command with custom exclude directories
    executeCommand(`index -d ${tempDir} -x node_modules,dist,build,coverage`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the configuration contains the expected exclude directories
    const configPath = path.join(tempDir, '.code-connoisseur', 'config.json');
    const config = fs.readJsonSync(configPath);
    expect(config.excludeDirs).toContain('node_modules');
    expect(config.excludeDirs).toContain('dist');
    expect(config.excludeDirs).toContain('build');
    expect(config.excludeDirs).toContain('coverage');
  });
});
