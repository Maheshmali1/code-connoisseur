const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const {
  executeCommand,
  createTempFixture,
  cleanupTempFixture
} = require('../test-utils');

describe('code-connoisseur index command', () => {
  let tempDir;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = path.join(os.tmpdir(), `code-connoisseur-test-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`);
    fs.ensureDirSync(tempDir);

    // Copy all fixture files to the temp directory
    fs.copySync(path.join(process.cwd(), 'tests', 'fixtures'), tempDir);
  });

  afterEach(() => {
    // Clean up the temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  test('should index JavaScript files', async () => {
    // Execute the index command with JavaScript only
    const output = executeCommand(`index -d ${tempDir} --js-only`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the output contains success messages
    expect(output).toContain('Indexing codebase');
    expect(output).toContain('Loaded files');
    expect(output).toContain('Generated code chunks');
    expect(output).toContain('Generated embeddings');
    expect(output).toContain('Indexing completed');

    // Verify the .code-connoisseur directory was created in the temporary directory
    const configDir = path.join(tempDir, '.code-connoisseur');
    expect(fs.existsSync(configDir)).toBe(true);

    // Verify config.json was created
    const configPath = path.join(configDir, 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    // Verify the config contains the correct extensions
    const config = fs.readJsonSync(configPath);
    expect(config.extensions).toContain('js');
    expect(config.extensions).toContain('jsx');
    expect(config.extensions).toContain('ts');
    expect(config.extensions).toContain('tsx');
  });

  test('should index Python files', async () => {
    // Execute the index command with Python only
    const output = executeCommand(`index -d ${tempDir} --py-only`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the output contains success messages
    expect(output).toContain('Indexing codebase');
    expect(output).toContain('Loaded files');
    expect(output).toContain('Generated code chunks');
    expect(output).toContain('Generated embeddings');
    expect(output).toContain('Indexing completed');

    // Verify the config contains the correct extensions
    const configPath = path.join(tempDir, '.code-connoisseur', 'config.json');
    const config = fs.readJsonSync(configPath);
    expect(config.extensions).toContain('py');
  });

  test('should index with custom extensions', async () => {
    // Execute the index command with custom extensions
    const output = executeCommand(`index -d ${tempDir} -e js,py,ts`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the output contains success messages
    expect(output).toContain('Indexing codebase');
    expect(output).toContain('Loaded files');
    expect(output).toContain('Generated code chunks');
    expect(output).toContain('Generated embeddings');
    expect(output).toContain('Indexing completed');

    // Verify the config contains the correct extensions
    const configPath = path.join(tempDir, '.code-connoisseur', 'config.json');
    const config = fs.readJsonSync(configPath);
    expect(config.extensions).toContain('js');
    expect(config.extensions).toContain('py');
    expect(config.extensions).toContain('ts');
  });

  test('should handle invalid directory', async () => {
    // Execute the index command with an invalid directory
    const output = executeCommand(`index -d ${tempDir}/nonexistent-dir`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      failOnError: false // Command utility returns error output instead of throwing
    });
    // Expect the command to at least attempt to scan the directory
    expect(output).toContain('Scanning directory'); // Should indicate directory scanning
  });

  test('should respect exclude directories', async () => {
    // Create a node_modules directory that should be excluded
    fs.ensureDirSync(path.join(tempDir, 'node_modules'));
    fs.writeFileSync(
      path.join(tempDir, 'node_modules', 'test.js'),
      'console.log("This should be excluded");'
    );

    // Execute the index command
    const output = executeCommand(`index -d ${tempDir} --js-only`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      }
    });

    // Verify the output doesn't mention the excluded file
    expect(output).not.toContain('node_modules/test.js');
  });
});
