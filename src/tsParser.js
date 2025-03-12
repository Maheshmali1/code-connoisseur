/**
 * TypeScript Parser Module
 * 
 * Handles parsing of TypeScript files using TypeScript compiler API
 */

const ts = require('typescript');
const path = require('path');
const fs = require('fs-extra');
const parser = require('@typescript-eslint/parser');
const { parse } = require('@typescript-eslint/typescript-estree');

/**
 * Parse TypeScript file content
 * @param {string} content - TypeScript file content
 * @param {string} filePath - Path to TypeScript file
 * @returns {object} AST of TypeScript file
 */
function parseTypeScript(content, filePath) {
  try {
    // Try with most basic options first for maximum compatibility
    try {
      return parser.parse(content, {
        loc: true,
        range: true,
        tokens: false,
        comment: false,
        jsx: filePath.endsWith('.tsx'),
        // Minimal project info with allowJs
        parserOptions: {
          ecmaVersion: 2020,
          sourceType: 'module',
          ecmaFeatures: {
            jsx: filePath.endsWith('.tsx')
          }
        }
      });
    } catch (basicError) {
      // If simple parsing fails, try with more options but with error handling
      try {
        return parse(content, {
          loc: true,
          range: true,
          tokens: false,
          comment: false,
          jsx: filePath.endsWith('.tsx'),
          errorOnUnknownASTType: false
          // Skip project config to avoid dependencies issues
        });
      } catch (detailedError) {
        // If both fail, throw an error with details
        throw new Error(`TypeScript parsing failed: ${basicError.message}`);
      }
    }
  } catch (error) {
    // If everything fails, rethrow
    throw error;
  }
}

/**
 * Finds the closest tsconfig.json file from a given file path
 * @param {string} filePath - Path to a TypeScript file
 * @returns {string|null} Path to tsconfig.json or null if not found
 */
function findTsConfig(filePath) {
  const dir = path.dirname(filePath);
  let currentDir = dir;
  
  // Walk up the directory tree looking for tsconfig.json
  while (currentDir !== path.parse(currentDir).root) {
    const tsConfigPath = path.join(currentDir, 'tsconfig.json');
    if (fs.existsSync(tsConfigPath)) {
      return tsConfigPath;
    }
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

/**
 * Extract meaningful chunks from TypeScript AST
 * @param {object} ast - TypeScript AST
 * @param {string} content - Original file content
 * @param {string} filePath - Path to the file
 * @returns {Array<{type: string, name: string, code: string, path: string}>} - Array of code chunks
 */
function extractChunks(ast, content, filePath) {
  const chunks = [];
  const fileName = path.basename(filePath);
  
  // If AST is invalid or doesn't have a body, return the whole file
  if (!ast || !ast.body || !Array.isArray(ast.body)) {
    return [{
      type: 'File',
      name: fileName,
      code: content.substring(0, Math.min(content.length, 5000)),
      path: filePath
    }];
  }
  
  // Extract TypeScript specific nodes like interfaces, types, etc.
  for (const node of ast.body) {
    if (!node || typeof node !== 'object') continue;
    
    // Common node check for valid range
    const hasValidRange = node.range && 
      Array.isArray(node.range) && 
      node.range.length === 2 &&
      node.range[0] >= 0 && 
      node.range[1] > node.range[0] && 
      node.range[1] <= content.length;
    
    if (!hasValidRange) continue;
    
    try {
      // Check for various TypeScript specific declarations
      if (
        // Classes and functions (JavaScript and TypeScript)
        node.type === 'ClassDeclaration' || 
        node.type === 'FunctionDeclaration' ||
        // TypeScript specific declarations
        node.type === 'InterfaceDeclaration' ||
        node.type === 'TypeAliasDeclaration' ||
        node.type === 'EnumDeclaration' ||
        node.type === 'ExportNamedDeclaration' || 
        node.type === 'ExportDefaultDeclaration'
      ) {
        // Extract code chunk
        const chunk = content.substring(node.range[0], node.range[1]);
        
        // Determine name based on node type
        let name = 'anonymous';
        if (node.id && node.id.name) {
          name = node.id.name;
        } else if (node.declaration && node.declaration.id && node.declaration.id.name) {
          name = node.declaration.id.name;
        }
        
        // Add chunk with size limit
        chunks.push({
          type: node.type,
          name: name,
          code: chunk.substring(0, Math.min(chunk.length, 5000)),
          path: filePath
        });
      }
    } catch (error) {
      // Skip this node if there was an error
    }
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
 * Process TypeScript file and extract chunks
 * @param {string} content - TypeScript file content
 * @param {string} filePath - Path to TypeScript file
 * @returns {Array<{type: string, name: string, code: string, path: string}>} - Array of code chunks
 */
function processTypeScriptFile(content, filePath) {
  try {
    // Add a safety check - make sure content is valid
    if (!content || typeof content !== 'string' || content.length === 0) {
      throw new Error('Invalid or empty content');
    }
    
    // If file is extremely large, just return it as-is with truncation
    if (content.length > 500000) { // 500KB
      console.log(`File too large for TS parsing: ${filePath} (${Math.round(content.length/1024)}KB)`);
      return [{
        type: 'File',
        name: path.basename(filePath),
        code: content.substring(0, 5000), // First 5000 chars only
        path: filePath
      }];
    }
    
    // Check for obvious binary file markers
    if (content.includes('\u0000') || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content.substring(0, 1000))) {
      console.log(`Possible binary TypeScript file (contains control chars): ${filePath}`);
      return [{
        type: 'File',
        name: path.basename(filePath),
        code: content.substring(0, 5000),
        path: filePath
      }];
    }
    
    // Try to parse the TypeScript file - with fallbacks
    try {
      const ast = parseTypeScript(content, filePath);
      if (ast && ast.body) {
        return extractChunks(ast, content, filePath);
      }
    } catch (parseError) {
      // Silent failure - just continue to fallback
    }
    
    // Attempt a very simple regex-based parsing as a final fallback
    try {
      const chunks = [];
      
      // Simple regex for class, interface, type, function, etc.
      const declarationRegex = /(export\s+)?(default\s+)?(class|interface|type|enum|function|const|let|var)\s+([A-Za-z0-9_]+)/g;
      let match;
      
      while ((match = declarationRegex.exec(content)) !== null) {
        const type = match[3];
        const name = match[4];
        
        // Try to find the end of the declaration (very simplistic)
        let startPos = match.index;
        let depth = 0;
        let endPos = content.length;
        
        // Look for matching braces if it's a block declaration
        if (['class', 'interface', 'function', 'enum'].includes(type)) {
          let pos = startPos;
          while (pos < content.length) {
            if (content[pos] === '{') depth++;
            if (content[pos] === '}') {
              depth--;
              if (depth === 0) {
                endPos = pos + 1;
                break;
              }
            }
            pos++;
          }
        } else {
          // For simple declarations, find the next semicolon
          const nextSemi = content.indexOf(';', startPos);
          if (nextSemi > 0) endPos = nextSemi + 1;
        }
        
        // Add the chunk if it's not too large
        if (endPos - startPos < 10000) {
          chunks.push({
            type: type.charAt(0).toUpperCase() + type.slice(1) + 'Declaration',
            name: name,
            code: content.substring(startPos, endPos),
            path: filePath
          });
        }
      }
      
      // If we found any chunks, return them
      if (chunks.length > 0) {
        return chunks;
      }
    } catch (regexError) {
      // Silently fail and go to final fallback
    }
    
    // Ultimate fallback: return the whole file as one chunk
    return [{
      type: 'File',
      name: path.basename(filePath),
      code: content.substring(0, Math.min(content.length, 5000)),
      path: filePath
    }];
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

module.exports = {
  parseTypeScript,
  extractChunks,
  processTypeScriptFile
};