const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * Executes a code-connoisseur CLI command
 * @param {string} command - The command to execute (without 'code-connoisseur' prefix)
 * @param {Object} options - Options for the command execution
 * @returns {string} - The command output
 */
function executeCommand(command, options = {}) {
  const cliPath = path.resolve(__dirname, '../index.js');
  const fullCommand = `node ${cliPath} ${command}`;
  
  try {
    const output = execSync(fullCommand, {
      encoding: 'utf8',
      stdio: options.stdio || 'pipe',
      cwd: options.cwd || process.cwd(),
      env: {
        ...process.env,
        ...options.env
      },
      timeout: options.timeout || 30000 // 30 seconds default timeout
    });
    return output;
  } catch (error) {
    if (options.failOnError !== false) {
      throw error;
    }
    return error.stdout || error.message;
  }
}

/**
 * Creates a temporary directory with test fixtures
 * @param {string} fixtureName - Name of the fixture directory to copy (from tests/fixtures)
 * @returns {string} - Path to the temporary directory
 */
function createTempFixture(fixtureName) {
  const tempDir = path.join(os.tmpdir(), `code-connoisseur-test-${Date.now()}`);
  const fixtureDir = path.join(__dirname, 'fixtures', fixtureName);
  
  fs.ensureDirSync(tempDir);
  fs.copySync(fixtureDir, tempDir);
  
  return tempDir;
}

/**
 * Cleans up a temporary directory
 * @param {string} tempDir - Path to the temporary directory
 */
function cleanupTempFixture(tempDir) {
  if (fs.existsSync(tempDir)) {
    fs.removeSync(tempDir);
  }
}

/**
 * Creates a file with the given content in the specified directory
 * @param {string} dir - Directory to create the file in
 * @param {string} filename - Name of the file
 * @param {string} content - Content of the file
 * @returns {string} - Full path to the created file
 */
function createFile(dir, filename, content) {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

/**
 * Creates a modified version of a file for testing code review
 * @param {string} originalPath - Path to the original file
 * @param {string} modifiedContent - New content for the file
 * @returns {string} - Path to the modified file
 */
function createModifiedFile(originalPath, modifiedContent) {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const baseName = path.basename(originalPath, ext);
  const modifiedPath = path.join(dir, `${baseName}.modified${ext}`);
  
  fs.writeFileSync(modifiedPath, modifiedContent);
  return modifiedPath;
}

/**
 * Waits for a specified amount of time
 * @param {number} ms - Time to wait in milliseconds
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  executeCommand,
  createTempFixture,
  cleanupTempFixture,
  createFile,
  createModifiedFile,
  wait
};