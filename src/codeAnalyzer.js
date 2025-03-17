const { ESLint } = require('eslint');
const madge = require('madge');
const path = require('path');
const fs = require('fs-extra');
const { suggestPythonEdgeCases } = require('./pythonParser');

/**
 * Performs static code analysis
 * @param {string} code - Code to analyze
 * @param {string} filePath - Path to the file
 * @returns {Promise<Array<{message: string, severity: number, line: number, column: number}>>} - Array of lint issues
 */
async function runStaticAnalysis(code, filePath) {
  console.log(`Running static analysis on ${filePath}`);
  
  // Get file extension to determine analysis approach
  const ext = path.extname(filePath).toLowerCase();
  
  // For Python files, use a simple rule-based analyzer
  if (ext === '.py') {
    return analyzePythonCode(code);
  }
  
  // Use ESLint for JavaScript/TypeScript analysis
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
 * Simple rule-based static analysis for Python code
 * @param {string} code - Python code to analyze
 * @returns {Array<{message: string, severity: number, line: number, column: number}>} - Array of issues
 */
function analyzePythonCode(code) {
  const issues = [];
  const lines = code.split('\n');
  
  // Simple PEP 8 style checks
  lines.forEach((line, i) => {
    const lineNumber = i + 1;
    
    // Check line length (PEP 8 recommends 79 chars)
    if (line.length > 100) {
      issues.push({
        message: 'Line too long (exceeds 100 characters)',
        severity: 1, // Warning
        line: lineNumber,
        column: 1
      });
    }
    
    // Check for trailing whitespace
    if (line.trimEnd() !== line) {
      issues.push({
        message: 'Trailing whitespace',
        severity: 1, // Warning
        line: lineNumber,
        column: line.length
      });
    }
    
    // Check for mixed tabs and spaces
    if (line.includes('\t') && line.includes('    ')) {
      issues.push({
        message: 'Mixed tabs and spaces',
        severity: 2, // Error
        line: lineNumber,
        column: 1
      });
    }
    
    // Check for bare except clauses
    if (line.trimStart().startsWith('except:')) {
      issues.push({
        message: 'Bare except clause (should specify exception type)',
        severity: 2, // Error
        line: lineNumber,
        column: line.indexOf('except:') + 1
      });
    }
    
    // Check mutable default arguments
    if (/def\s+\w+\s*\([^)]*=\s*\[\s*\][^)]*\)/.test(line) || 
        /def\s+\w+\s*\([^)]*=\s*\{\s*\}[^)]*\)/.test(line)) {
      issues.push({
        message: 'Mutable default argument (use None instead)',
        severity: 2, // Error
        line: lineNumber,
        column: 1
      });
    }
    
    // Check for wildcard imports
    if (line.includes('from ') && line.includes('import *')) {
      issues.push({
        message: 'Wildcard imports should be avoided',
        severity: 1, // Warning
        line: lineNumber,
        column: 1
      });
    }
  });
  
  // Check for proper indentation (simplified)
  let indentLevel = null;
  lines.forEach((line, i) => {
    if (line.trim() === '' || line.trim().startsWith('#')) return;
    
    const currentIndent = line.search(/\S/);
    if (currentIndent > 0) {
      if (indentLevel === null) {
        indentLevel = currentIndent;
      } else if (currentIndent % 4 !== 0 && currentIndent !== 0) {
        issues.push({
          message: 'Indentation should be a multiple of 4 spaces',
          severity: 1, // Warning
          line: i + 1,
          column: 1
        });
      }
    }
  });
  
  return issues;
}

/**
 * Analyzes dependencies of a file to see what might be affected by changes
 * @param {string} filePath - Path to the file
 * @param {string} projectRoot - Root directory of the project
 * @returns {Promise<{dependents: string[], dependencies: string[]}>} - Dependencies analysis
 */
async function analyzeDependencies(filePath, projectRoot) {
  console.log(`Analyzing dependencies for ${filePath}`);
  
  // Get file extension to determine analysis approach
  const ext = path.extname(filePath).toLowerCase();
  
  // For Python files, use a simple import scanner
  if (ext === '.py') {
    return await analyzePythonDependencies(filePath, projectRoot);
  }
  
  // Use Madge for JavaScript/TypeScript dependency analysis
  try {
    // Make file path relative to project root
    const relativePath = path.relative(projectRoot, filePath);
    
    // Create a dependency graph for the project
    const graph = await madge(projectRoot, {
      baseDir: projectRoot,
      includeNpm: false,
      fileExtensions: ['js', 'ts', 'jsx', 'tsx']
      // Note: Python files are handled by analyzePythonDependencies
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
 * Analyze Python dependencies using simple regex-based import scanning
 * @param {string} filePath - Path to the Python file
 * @param {string} projectRoot - Root directory of the project
 * @returns {Promise<{dependents: string[], dependencies: string[]}>} - Dependencies analysis
 */
async function analyzePythonDependencies(filePath, projectRoot) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const dependencies = [];
    
    // Extract import statements using regex
    const importRegex = /^\s*(import|from)\s+([.\w]+)/gm;
    let match;
    const moduleNames = new Set();
    
    while ((match = importRegex.exec(fileContent)) !== null) {
      const importType = match[1]; // import or from
      let moduleName = match[2];
      
      // For 'from x import y' statements, we only care about x
      if (importType === 'from') {
        moduleName = moduleName.split('.')[0]; // Get the root module
      }
      
      // Skip built-in modules
      const builtIns = ['os', 'sys', 'datetime', 're', 'math', 'random', 'json', 
                         'collections', 'itertools', 'functools', 'typing'];
      if (!builtIns.includes(moduleName)) {
        moduleNames.add(moduleName);
      }
    }
    
    // Find .py files in the project that match these module names
    const pythonFiles = await findPythonFiles(projectRoot);
    
    // For each module name, find matching files
    for (const moduleName of moduleNames) {
      const matchingFiles = pythonFiles.filter(file => {
        const baseName = path.basename(file, '.py');
        return baseName === moduleName || 
               file.includes(`/${moduleName}/`) || 
               file.includes(`\\${moduleName}\\`);
      });
      
      dependencies.push(...matchingFiles);
    }
    
    // Now find dependents - files that import this module
    const relativePath = path.relative(projectRoot, filePath);
    const modulePathParts = relativePath.replace(/\.py$/, '').split(/[\/\\]/);
    const modulePath = modulePathParts.join('.');
    const fileName = path.basename(filePath, '.py');
    
    // Pattern to match in other files
    const importPatterns = [
      `import ${fileName}`,
      `from ${fileName} import`,
      `import ${modulePath}`,
      `from ${modulePath} import`
    ];
    
    // Search for imports in all python files
    const dependents = [];
    for (const file of pythonFiles) {
      if (file === filePath) continue; // Skip self
      
      const content = await fs.readFile(file, 'utf8');
      
      // Check if any import pattern matches
      const isDependent = importPatterns.some(pattern => content.includes(pattern));
      
      if (isDependent) {
        dependents.push(file);
      }
    }
    
    return {
      dependencies: [...new Set(dependencies)], // Remove duplicates
      dependents: [...new Set(dependents)] // Remove duplicates
    };
  } catch (error) {
    console.error(`Python dependency analysis error: ${error.message}`);
    return { dependencies: [], dependents: [] };
  }
}

/**
 * Find all Python files in a project
 * @param {string} rootDir - Root directory of the project
 * @returns {Promise<string[]>} - Array of Python file paths
 */
async function findPythonFiles(rootDir) {
  try {
    // Use glob to find all .py files
    const glob = require('glob');
    const pythonFiles = glob.sync(`${rootDir}/**/*.py`, { 
      ignore: ['**/node_modules/**', '**/venv/**', '**/.env/**', '**/.git/**'] 
    });
    
    return pythonFiles;
  } catch (error) {
    console.error(`Error finding Python files: ${error.message}`);
    return [];
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
  
  // Get file extension to determine test file patterns
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath, ext);
  const fileDir = path.dirname(filePath);
  const projectRoot = process.cwd();
  
  // Look for test files to estimate coverage
  try {
    // Define test directories based on standard conventions
    const testDirs = ['__tests__', 'tests', 'test', 'spec', '__tests__'];
    let testFilePatterns = [];
    
    // Define test file patterns based on file extension
    if (ext === '.py') {
      testFilePatterns = [
        `test_${basename}.py`,
        `${basename}_test.py`,
        `tests_${basename}.py`,
        `${basename}_tests.py`
      ];
    } else {
      // Default patterns for JS/TS files
      testFilePatterns = [
        `${basename}.test${ext}`,
        `${basename}.spec${ext}`,
        `test-${basename}${ext}`,
        `${basename}-test${ext}`
      ];
    }
    
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
    
    // For Python files - also check for pytest fixtures that might include this file
    if (ext === '.py') {
      // Look for conftest.py files
      const glob = require('glob');
      const pyTestFiles = glob.sync(`${projectRoot}/**/conftest.py`);
      
      // Check if any conftest.py mentions this file
      for (const pytestFile of pyTestFiles) {
        try {
          const content = await fs.readFile(pytestFile, 'utf8');
          if (content.includes(basename)) {
            testFilesFound.push(pytestFile);
          }
        } catch (err) {
          // Skip this file if there's an error
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
 * @param {string} filePath - Path to the file (optional)
 * @returns {Array<string>} - Suggested edge cases to test
 */
function suggestEdgeCases(code, filePath = '') {
  // Check file extension to determine language
  if (filePath && path.extname(filePath).toLowerCase() === '.py') {
    return suggestPythonEdgeCases(code);
  }
  
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
  suggestEdgeCases,
  analyzePythonCode  // Export for testing
};