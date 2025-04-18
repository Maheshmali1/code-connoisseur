const path = require('path');
const fs = require('fs-extra');
const {
  executeCommand,
  createTempFixture,
  cleanupTempFixture,
  createFile,
  createModifiedFile
} = require('../test-utils');

const testEnv = {
  ANTHROPIC_API_KEY: 'sk-ant-test123456789',
  OPENAI_API_KEY: 'sk-test123456789',
  DEFAULT_LLM_PROVIDER: 'anthropic'
}
describe('code-connoisseur review command', () => {
  let tempDir;

  beforeEach(() => {
    // Create a temporary directory with all fixture files
    tempDir = path.join(process.cwd(), 'tests', 'temp-test-dir');
    fs.ensureDirSync(tempDir);

    // Copy all fixture files to the temp directory
    fs.copySync(path.join(process.cwd(), 'tests', 'fixtures'), tempDir);

    // Index the codebase first (required for review)
    executeCommand(`index -d ${tempDir}`, {
      env: testEnv
    });
  });

  afterEach(() => {
    // Clean up the temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  test('should review JavaScript file changes', async () => {
    // Create a modified version of the JavaScript file
    const originalPath = path.join(tempDir, 'javascript', 'sample.js');
    const originalContent = fs.readFileSync(originalPath, 'utf8');

    // Add a bug to the code (division by zero check is removed)
    const modifiedContent = originalContent.replace(
      'if (b === 0) {\n    throw new Error(\'Division by zero\');\n  }',
      '// Bug: Division by zero check removed'
    );

    // Write the modified content back to the file
    fs.writeFileSync(originalPath, modifiedContent);

    // Create a backup of the original file for comparison
    const backupPath = path.join(tempDir, 'javascript', 'sample.original.js');
    fs.writeFileSync(backupPath, originalContent);

    // Execute the review command
    const output = executeCommand(`review ${originalPath} -o ${backupPath} -s MEAN`, {
      env: testEnv
    });

    // Verify the output contains review-related messages
    expect(output).toContain('Code Connoisseur Review');
    // In test environment, a mock LLM response is used
    expect(output).toContain('mock response for testing purposes');
  });

  test('should review TypeScript file changes', async () => {
    // Create a modified version of the TypeScript file
    const originalPath = path.join(tempDir, 'typescript', 'sample.ts');
    const originalContent = fs.readFileSync(originalPath, 'utf8');

    // Add a potential bug to the code (missing null check)
    const modifiedContent = originalContent.replace(
      'const index = this.users.findIndex(user => user.id === id);\n    if (index === -1) return undefined;',
      'const index = this.users.findIndex(user => user.id === id);\n    // Bug: Missing check for index === -1'
    );

    // Write the modified content back to the file
    fs.writeFileSync(originalPath, modifiedContent);

    // Create a backup of the original file for comparison
    const backupPath = path.join(tempDir, 'typescript', 'sample.original.ts');
    fs.writeFileSync(backupPath, originalContent);

    // Execute the review command
    const output = executeCommand(`review ${originalPath} -o ${backupPath}`, {
      env: testEnv
    });

    // Verify the output contains review-related messages
    expect(output).toContain('Code Connoisseur Review');
    // In test environment, a mock LLM response is used
    expect(output).toContain('mock response for testing purposes');
  });

  test('should review Python file changes', async () => {
    // Create a modified version of the Python file
    const originalPath = path.join(tempDir, 'python', 'sample.py');
    const originalContent = fs.readFileSync(originalPath, 'utf8');

    // Add a potential bug to the code (file not closed properly)
    const modifiedContent = originalContent.replace(
      'with open(file_path, \'r\') as f:',
      'f = open(file_path, \'r\') # Bug: File not closed properly'
    );

    // Write the modified content back to the file
    fs.writeFileSync(originalPath, modifiedContent);

    // Create a backup of the original file for comparison
    const backupPath = path.join(tempDir, 'python', 'sample.original.py');
    fs.writeFileSync(backupPath, originalContent);

    // Execute the review command
    const output = executeCommand(`review ${originalPath} -o ${backupPath} -s Python`, {
      env: testEnv
    });

    // Verify the output contains review-related messages
    expect(output).toContain('Code Connoisseur Review');
    // In test environment, a mock LLM response is used
    expect(output).toContain('mock response for testing purposes');
  });

  test('should review a directory of files', async () => {
    // Modify multiple files
    const jsPath = path.join(tempDir, 'javascript', 'sample.js');
    const tsPath = path.join(tempDir, 'typescript', 'sample.ts');

    // Modify JavaScript file
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    const modifiedJsContent = jsContent.replace(
      'return a + b;',
      'return a + b + 0; // Unnecessary addition'
    );
    fs.writeFileSync(jsPath, modifiedJsContent);

    // Modify TypeScript file
    const tsContent = fs.readFileSync(tsPath, 'utf8');
    const modifiedTsContent = tsContent.replace(
      'return [...this.users];',
      'return this.users; // Should return a copy instead'
    );
    fs.writeFileSync(tsPath, modifiedTsContent);

    // Execute the review command on the directory
    const output = executeCommand(`review ${tempDir} -d --max-files 5`, {
      env: testEnv
    });

    // Verify the output contains directory review messages
    expect(output).toContain('Code Connoisseur Directory Review');
  });

  test('should handle non-existent file', async () => {
    // Execute the review command with a non-existent file
    // Expect the review command to throw an error for a non-existent file
    expect(() => {
      executeCommand(`review ${tempDir}/nonexistent-file.js`, {
        env: testEnv
      });
    }).toThrowError(/nonexistent-file\.js/);
  });

  test('should support different LLM providers', async () => {
    // Create a modified version of the JavaScript file
    const originalPath = path.join(tempDir, 'javascript', 'sample.js');
    const originalContent = fs.readFileSync(originalPath, 'utf8');

    // Make a simple change
    const modifiedContent = originalContent.replace(
      'return a + b;',
      'return a + b; // Simple addition'
    );

    // Write the modified content back to the file
    fs.writeFileSync(originalPath, modifiedContent);

    // Create a backup of the original file for comparison
    const backupPath = path.join(tempDir, 'javascript', 'sample.original.js');
    fs.writeFileSync(backupPath, originalContent);

    // Execute the review command with OpenAI provider
    const output = executeCommand(`review ${originalPath} -o ${backupPath} -l openai`, {
      env: testEnv
    });

    // Verify the output contains review-related messages
    expect(output).toContain('Code Connoisseur Review');
  });

  test('should save review to markdown file', async () => {
    // Create a modified version of the JavaScript file
    const originalPath = path.join(tempDir, 'javascript', 'sample.js');
    const originalContent = fs.readFileSync(originalPath, 'utf8');

    // Make a simple change
    const modifiedContent = originalContent.replace(
      'return a + b;',
      'return a + b; // Simple addition'
    );

    // Write the modified content back to the file
    fs.writeFileSync(originalPath, modifiedContent);

    // Create a backup of the original file for comparison
    const backupPath = path.join(tempDir, 'javascript', 'sample.original.js');
    fs.writeFileSync(backupPath, originalContent);

    // Path for the markdown output
    const mdPath = path.join(tempDir, 'review-output.md');

    // Execute the review command with markdown output
    executeCommand(`review ${originalPath} -o ${backupPath} -m ${mdPath}`, {
      env: testEnv
    });

    // Verify the markdown file was created
    expect(fs.existsSync(mdPath)).toBe(true);

    // Verify the markdown content
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    expect(mdContent).toContain('# Code Connoisseur Review');
    expect(mdContent).toContain('sample.js');
  });
});
