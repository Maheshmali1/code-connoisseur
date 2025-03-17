/**
 * Python Parser Module
 * 
 * Handles parsing of Python files using regex-based parsing
 * since we don't have direct AST access in Node.js for Python
 */

const path = require('path');

/**
 * Process Python file and extract chunks
 * @param {string} content - Python file content
 * @param {string} filePath - Path to Python file
 * @returns {Array<{type: string, name: string, code: string, path: string}>} - Array of code chunks
 */
function processPythonFile(content, filePath) {
  try {
    // Add a safety check - make sure content is valid
    if (!content || typeof content !== 'string' || content.length === 0) {
      throw new Error('Invalid or empty content');
    }
    
    // If file is extremely large, just return it as-is with truncation
    if (content.length > 500000) { // 500KB
      console.log(`File too large for Python parsing: ${filePath} (${Math.round(content.length/1024)}KB)`);
      return [{
        type: 'File',
        name: path.basename(filePath),
        code: content.substring(0, 5000), // First 5000 chars only
        path: filePath
      }];
    }
    
    // Extract code chunks using regex
    return extractPythonChunks(content, filePath);
  } catch (error) {
    // If any unexpected error occurs, return the file as a whole
    return [{
      type: 'File',
      name: path.basename(filePath),
      code: content.substring(0, Math.min(content.length, 5000)),
      path: filePath
    }];
  }
}

/**
 * Extract Python code chunks using regex
 * @param {string} content - Python file content
 * @param {string} filePath - Path to the file
 * @returns {Array<{type: string, name: string, code: string, path: string}>} - Array of code chunks
 */
function extractPythonChunks(content, filePath) {
  const chunks = [];
  const fileName = path.basename(filePath);
  
  // Helper function to extract and add chunks
  const extractAndAddChunk = (match, type, name, startPos) => {
    // Find the end of the block by tracking indentation
    const lines = content.substring(startPos).split('\n');
    let endLine = 0;
    let blockIndent = null;
    
    // Find the indentation of the first line (def or class line)
    const firstLineIndent = lines[0].search(/\S/);
    
    // Determine the indentation of the first content line
    if (lines.length > 1) {
      const secondLineIndent = lines[1].search(/\S/);
      if (secondLineIndent > firstLineIndent) {
        blockIndent = secondLineIndent;
      }
    }
    
    // If we couldn't determine block indentation, use a simple heuristic
    if (blockIndent === null) {
      blockIndent = firstLineIndent + 4; // Assume standard 4-space indentation
    }
    
    // Find the end of the block by checking indentation
    for (let i = 1; i < lines.length; i++) {
      // Skip empty lines or comment lines
      if (lines[i].trim() === '' || lines[i].trim().startsWith('#')) {
        endLine = i;
        continue;
      }
      
      const currentIndent = lines[i].search(/\S/);
      
      // If we find a line with same or less indentation than the definition line,
      // that's the end of our block (unless it's a comment or decorator)
      if (currentIndent <= firstLineIndent && 
          !lines[i].trim().startsWith('#') && 
          !lines[i].trim().startsWith('@')) {
        break;
      }
      
      endLine = i;
    }
    
    // Extract the chunk
    const chunkLines = lines.slice(0, endLine + 1);
    const chunk = chunkLines.join('\n');
    
    // Add chunk with size limit
    chunks.push({
      type: type,
      name: name,
      code: chunk.substring(0, Math.min(chunk.length, 5000)),
      path: filePath
    });
    
    return endLine + 1; // Return the number of lines consumed
  };
  
  // Match class definitions
  const classRegex = /^\s*(class\s+(\w+)(?:\s*\([\s\w.,]*\))?\s*:)/gm;
  let classMatch;
  while ((classMatch = classRegex.exec(content)) !== null) {
    extractAndAddChunk(classMatch[0], 'ClassDeclaration', classMatch[2], classMatch.index);
  }
  
  // Match function definitions
  const funcRegex = /^\s*(def\s+(\w+)(?:\s*\([\s\w.,='"]*\))?\s*(?:->[\s\w[\],|.'"=]*)?\s*:)/gm;
  let funcMatch;
  while ((funcMatch = funcRegex.exec(content)) !== null) {
    extractAndAddChunk(funcMatch[0], 'FunctionDeclaration', funcMatch[2], funcMatch.index);
  }
  
  // Match decorated functions/classes
  const decoratorRegex = /((?:@\w+(?:\.\w+)*(?:\(.*?\))?\s*)+)(class|def)\s+(\w+)/gs;
  let decoratorMatch;
  while ((decoratorMatch = decoratorRegex.exec(content)) !== null) {
    const type = decoratorMatch[2] === 'class' ? 'ClassDeclaration' : 'FunctionDeclaration';
    extractAndAddChunk(decoratorMatch[0], type, decoratorMatch[3], decoratorMatch.index);
  }
  
  // If no valid chunks were found, return the whole file
  if (chunks.length === 0) {
    return [{
      type: 'File',
      name: fileName,
      code: content.substring(0, Math.min(content.length, 5000)),
      path: filePath
    }];
  }
  
  return chunks;
}

/**
 * Suggests edge cases to test based on Python code patterns
 * @param {string} code - Python code to analyze
 * @returns {Array<string>} - Array of suggested edge cases
 */
function suggestPythonEdgeCases(code) {
  const edgeCases = [];
  
  // Check for list operations
  if (code.includes('.append(') || code.includes('.extend(') || 
      code.includes('.insert(') || code.includes('.pop(') || 
      code.includes('[') && code.includes(']')) {
    edgeCases.push('Test with an empty list');
    edgeCases.push('Test with a very large list (performance)');
  }
  
  // Check for dictionary operations
  if (code.includes('{') && code.includes('}') ||
      code.includes('.get(') || code.includes('.items(') ||
      code.includes('.keys(') || code.includes('.values(')) {
    edgeCases.push('Test with an empty dictionary');
    edgeCases.push('Test with missing keys');
  }
  
  // Check for string operations
  if (code.includes('.split(') || code.includes('.strip(') ||
      code.includes('.replace(') || code.includes('.format(') ||
      code.includes('f"') || code.includes("f'")) {
    edgeCases.push('Test with an empty string');
    edgeCases.push('Test with special characters and Unicode');
  }
  
  // Check for None checks
  if (!code.includes('is None') && !code.includes('is not None')) {
    edgeCases.push('Test with None values');
  }
  
  // Check for exception handling
  if (code.includes('def ') && !code.includes('try:') && !code.includes('except ')) {
    edgeCases.push('Add exception handling with try/except blocks');
  }
  
  // Check for file operations
  if (code.includes('open(') || code.includes('.read') || code.includes('.write')) {
    edgeCases.push('Test file not found scenarios');
    edgeCases.push('Test with permission issues');
    if (!code.includes('with open(')) {
      edgeCases.push('Use context manager (with statement) for file operations');
    }
  }
  
  // Check for iteration
  if (code.includes('for ') && code.includes(' in ')) {
    edgeCases.push('Test with empty sequences');
    edgeCases.push('Test with very large sequences (performance)');
  }
  
  // Check for async operations
  if (code.includes('async def') || code.includes('await ') || code.includes('asyncio')) {
    edgeCases.push('Test async timeouts');
    edgeCases.push('Test concurrent execution');
  }
  
  return edgeCases;
}

module.exports = {
  processPythonFile,
  extractPythonChunks,
  suggestPythonEdgeCases
};