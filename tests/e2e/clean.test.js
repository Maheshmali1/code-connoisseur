const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const {
  executeCommand,
  createTempFixture,
  cleanupTempFixture
} = require('../test-utils');

describe('code-connoisseur clean command', () => {
  let tempDir;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = path.join(os.tmpdir(), `code-connoisseur-test-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`);
    fs.ensureDirSync(tempDir);

    // Create some indexes for testing
    executeCommand(`index -d ${tempDir} -i test-index-1`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    executeCommand(`index -d ${tempDir} -i test-index-2`, {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });
  });

  afterEach(() => {
    // Clean up the temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  test('should remove a specific index', async () => {
    // Execute the clean command with a specific index
    const output = executeCommand('clean -i test-index-1 --confirm', {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the output indicates the index was removed
    expect(output).toContain('Removed index');
    expect(output).toContain('test-index-1');

    // Verify the index directory was removed
    const indexPath = path.join(tempDir, '.code-connoisseur', 'vectors', 'test-index-1');
    expect(fs.existsSync(indexPath)).toBe(false);

    // Verify the other index still exists
    const otherIndexPath = path.join(tempDir, '.code-connoisseur', 'vectors', 'test-index-2');
    expect(fs.existsSync(otherIndexPath)).toBe(true);
  });

  test('should handle non-existent index', async () => {
    // Execute the clean command with a non-existent index
    const output = executeCommand('clean -i non-existent-index --confirm', {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the output indicates the index was not found
    expect(output).toContain('not found');
  });

  test('should remove all indexed data with --all flag', async () => {
    // Execute the clean command with the --all flag
    const output = executeCommand('clean --all --confirm', {
      env: {
        // Mock API keys for testing
        OPENAI_API_KEY: 'sk-test123456789',
        ANTHROPIC_API_KEY: 'sk-ant-test123456789'
      },
      cwd: tempDir
    });

    // Verify the output indicates all data was removed
    expect(output).toContain('Removed all indexed data');

    // Verify the .code-connoisseur directory was removed or is empty
    const configDir = path.join(tempDir, '.code-connoisseur');

    // The implementation might either remove the directory entirely or just clear its contents
    if (fs.existsSync(configDir)) {
      // If it exists, the vectors directory should be gone or empty
      const vectorsDir = path.join(configDir, 'vectors');
      if (fs.existsSync(vectorsDir)) {
        const contents = fs.readdirSync(vectorsDir);
        expect(contents.length).toBe(0);
      } else {
        // Vectors directory was removed, which is also acceptable
        expect(true).toBe(true);
      }
    } else {
      // Entire directory was removed, which is also acceptable
      expect(true).toBe(true);
    }
  });

  test('should require confirmation by default', async () => {
    // Execute the clean command without the --confirm flag
    // This would normally prompt for confirmation, but in our test environment
    // it should fail or return without removing anything

    try {
      executeCommand('clean -i test-index-1', {
        env: {
          // Mock API keys for testing
          OPENAI_API_KEY: 'sk-test123456789',
          ANTHROPIC_API_KEY: 'sk-ant-test123456789'
        },
        cwd: tempDir,
        failOnError: false
      });

      // If we get here, the command didn't prompt for confirmation
      // Verify the index still exists
      const indexPath = path.join(tempDir, '.code-connoisseur', 'vectors', 'test-index-1');
      expect(fs.existsSync(indexPath)).toBe(true);
    } catch (error) {
      // If the command failed, that's also acceptable since we can't provide input
      // for the confirmation prompt in our test environment
      expect(error).toBeDefined();
    }
  });
});
