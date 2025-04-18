const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const {
  executeCommand,
  createTempFixture,
  cleanupTempFixture
} = require('../test-utils');

describe('code-connoisseur list command', () => {
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

  test('should list indexed codebases', async () => {
    // First create an index
    executeCommand(`index -d ${tempDir} -i test-index-1`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Create a second index
    executeCommand(`index -d ${tempDir} -i test-index-2`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Execute the list command
    const output = executeCommand('list', {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the output contains the indexed codebases
    expect(output).toContain('Available Indexes');
    expect(output).toContain('test-index-1');
    expect(output).toContain('test-index-2');
  });

  test('should handle no indexed codebases', async () => {
    // Create a new empty directory
    const emptyDir = path.join(tempDir, 'empty');
    fs.ensureDirSync(emptyDir);

    // Create .code-connoisseur directory but no vectors directory
    const configDir = path.join(emptyDir, '.code-connoisseur');
    fs.ensureDirSync(configDir);

    // Make sure the vectors directory doesn't exist
    const vectorsDir = path.join(configDir, 'vectors');
    if (fs.existsSync(vectorsDir)) {
      fs.removeSync(vectorsDir);
    }

    // Execute the list command in the empty directory
    const output = executeCommand('list', {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: emptyDir
    });

    // Verify that the command executed successfully
    expect(output).not.toContain('Error');
  });

  test('should show index details', async () => {
    // Create an index with specific settings
    executeCommand(`index -d ${tempDir} -i detailed-index -e js,ts,py`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Execute the list command
    const output = executeCommand('list', {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the output contains index details
    expect(output).toContain('detailed-index');
    expect(output).toContain('Chunks:'); // Should show chunk count
    expect(output).toContain('Created:'); // Should show creation date
  });
});
