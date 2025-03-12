const { ESLint } = require('eslint');
const madge = require('madge');
const path = require('path');
const fs = require('fs-extra');

/**
 * Performs static code analysis using ESLint
 * @param {string} code - Code to analyze
 * @param {string} filePath - Path to the file
 * @returns {Promise<Array<{message: string, severity: number, line: number, column: number}>>} - Array of lint issues
 */
async function runStaticAnalysis(code, filePath) {
  console.log(`Running static analysis on ${filePath}`);
  
  
  // Use ESLint for static analysis
  try {
    // Create a minimal ESLint instance
    const eslint = new ESLint();
    const results = await eslint.lintText(code, { filePath });
    
    if (results.length === 0) {
      return [];
    }
    
    // Format results
    const issues = results[0].messages.map(message => ({
      message: message.message,
      severity: message.severity, // 1 = warning, 2 = error
      line: message.line,
      column: message.column,
      ruleId: message.ruleId
    }));
    
    return issues;
  } catch (error) {
    console.error(`ESLint error: ${error.message}`);
    return [{
      message: `Static analysis currently unavailable: ${error.message}`,
      severity: 1,
      line: 1,
      column: 1
    }];
  }
}

/**
 * Analyzes dependencies of a file to see what might be affected by changes
 * @param {string} filePath - Path to the file
 * @param {string} projectRoot - Root directory of the project
 * @returns {Promise<{dependents: string[], dependencies: string[]}>} - Dependencies analysis
 */
async function analyzeDependencies(filePath, projectRoot) {
  console.log(`Analyzing dependencies for ${filePath}`);
  
  
  // Use Madge for dependency analysis
  try {
    // Make file path relative to project root
    const relativePath = path.relative(projectRoot, filePath);
    
    // Create a dependency graph for the project
    const graph = await madge(projectRoot, {
      baseDir: projectRoot,
      includeNpm: false,
      fileExtensions: ['js', 'ts', 'jsx', 'tsx']
    });
    
    // Get dependencies (files this file imports)
    const dependencies = graph.depends(relativePath) || [];
    
    // Get dependents (files that import this file)
    const dependents = graph.dependents(relativePath) || [];
    
    return {
      dependencies: dependencies.map(dep => path.join(projectRoot, dep)),
      dependents: dependents.map(dep => path.join(projectRoot, dep))
    };
  } catch (error) {
    console.error(`Dependency analysis error: ${error.message}`);
    return { dependencies: [], dependents: [] };
  }
}

/**
 * Estimates test coverage for changed code
 * @param {string} filePath - Path to the file
 * @param {Array<{added: boolean, removed: boolean, value: string, lineNumber: number}>} changes - Diff changes
 * @returns {Promise<{coverage: number, untested: Array<{start: number, end: number}>}>} - Test coverage estimation
 */
async function estimateTestCoverage(filePath, changes) {
  console.log(`Estimating test coverage for ${filePath}`);
  
  
  // Look for test files to estimate coverage
  try {
    // Get base filename without extension
    const basename = path.basename(filePath, path.extname(filePath));
    
    // Look for potential test files in common test directories
    const testDirs = ['__tests__', 'tests', 'test', 'spec', '__tests__'];
    const testFilePatterns = [
      `${basename}.test.js`,
      `${basename}.spec.js`,
      `test-${basename}.js`,
      `${basename}-test.js`
    ];
    
    // Get directory of the current file
    const fileDir = path.dirname(filePath);
    const projectRoot = process.cwd();
    
    // Check if test files exist
    let testFilesFound = [];
    
    // Check in same directory
    for (const pattern of testFilePatterns) {
      const testPath = path.join(fileDir, pattern);
      if (fs.existsSync(testPath)) {
        testFilesFound.push(testPath);
      }
    }
    
    // Check in test directories
    for (const testDir of testDirs) {
      for (const pattern of testFilePatterns) {
        const testPath = path.join(projectRoot, testDir, pattern);
        if (fs.existsSync(testPath)) {
          testFilesFound.push(testPath);
        }
      }
    }
    
    // If no test files found, suggest creating tests
    if (testFilesFound.length === 0) {
      return {
        coverage: 0,
        untested: changes.filter(c => c.added).map(c => ({
          start: c.newLineNumber,
          end: c.newLineNumber + c.lineCount - 1
        })),
        suggestion: `No test files found for ${basename}. Consider creating tests.`
      };
    }
    
    // Simple heuristic: if test files exist, assume there's some coverage
    // but still warn about newly added lines
    const addedChanges = changes.filter(c => c.added);
    const totalLines = addedChanges.reduce((sum, c) => sum + c.lineCount, 0);
    
    return {
      coverage: testFilesFound.length > 0 ? 0.6 : 0, // Rough estimate
      testFiles: testFilesFound,
      untested: addedChanges.map(c => ({
        start: c.newLineNumber,
        end: c.newLineNumber + c.lineCount - 1
      })),
      suggestion: `${testFilesFound.length} test file(s) found. Verify test coverage for the changes.`
    };
  } catch (error) {
    console.error(`Test coverage analysis error: ${error.message}`);
    return {
      coverage: 0,
      untested: [],
      suggestion: `Error analyzing test coverage: ${error.message}`
    };
  }
}

/**
 * Identifies potential edge cases based on the code
 * @param {string} code - Code to analyze
 * @returns {Array<string>} - Suggested edge cases to test
 */
function suggestEdgeCases(code) {
  const edgeCases = [];
  
  // Check for array operations
  if (code.includes('.map(') || code.includes('.filter(') || code.includes('.forEach(') ||
      code.includes('.reduce(') || code.includes('.some(') || code.includes('.every(')) {
    edgeCases.push('Test with an empty array');
    edgeCases.push('Test with a very large array (performance)');
  }
  
  // Check for string operations
  if (code.includes('.substring(') || code.includes('.substr(') || code.includes('.slice(') ||
      code.includes('.indexOf(') || code.includes('.split(')) {
    edgeCases.push('Test with an empty string');
    edgeCases.push('Test with special characters');
  }
  
  // Check for null/undefined checks
  if (!code.includes('=== null') && !code.includes('!== null') &&
      !code.includes('=== undefined') && !code.includes('!== undefined')) {
    edgeCases.push('Test with null and undefined values');
  }
  
  // Check for numeric operations
  if (code.includes('+') || code.includes('-') || code.includes('*') || code.includes('/')) {
    edgeCases.push('Test with zero and negative values');
    edgeCases.push('Test with very large numbers');
  }
  
  // Check for async operations
  if (code.includes('async') || code.includes('await') || code.includes('.then(') || 
      code.includes('.catch(') || code.includes('Promise')) {
    edgeCases.push('Test error handling in async operations');
    
    // Check for missing error handling
    if (!code.includes('try') || !code.includes('catch')) {
      edgeCases.push('Add try/catch blocks around async operations');
    }
  }
  
  return edgeCases;
}

module.exports = {
  runStaticAnalysis,
  analyzeDependencies,
  estimateTestCoverage,
  suggestEdgeCases
};