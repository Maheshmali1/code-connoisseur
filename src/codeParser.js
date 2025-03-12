const fs = require('fs-extra');
const glob = require('glob');
const esprima = require('esprima');
const path = require('path');
const ignore = require('ignore');
const { processTypeScriptFile } = require('./tsParser');

/**
 * Loads all code files from the given directory, respecting .gitignore
 * @param {string} directory - Directory to scan for code files
 * @param {string[]} extensions - File extensions to include
 * @param {string[]} excludeDirs - Additional directories to exclude
 * @returns {Promise<Array<{path: string, content: string}>>} - Array of file objects
 */
async function loadCodebase(directory, extensions = ['js', 'ts'], excludeDirs = []) {
  try {
    // Resolve the directory to an absolute path, expanding ~ if present
    const resolvedDirectory = directory.startsWith('~')
      ? path.join(process.env.HOME, directory.slice(1))
      : path.resolve(directory);
    
    console.log(`Scanning directory: ${resolvedDirectory}`);
    
    // Check if directory exists
    const dirExists = await fs.pathExists(resolvedDirectory);
    if (!dirExists) {
      throw new Error(`Directory does not exist: ${resolvedDirectory}`);
    }
    
    // Setup ignore rules
    const ig = ignore();
    
    // Add standard ignores - using glob patterns
    ig.add([
      // Node.js and NPM
      'node_modules/**',
      '**/node_modules/**',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      
      // Build and output directories
      'dist/**',
      'build/**',
      '.next/**',
      'out/**',
      '.nuxt/**',
      'coverage/**',
      '.vscode/**',
      '.idea/**',
      
      // Temporary files
      '.DS_Store',
      'tmp/**',
      '.cache/**',
      '*.log',
      '*.swp',
      
      // Environment and secrets
      '.env*',
      '.env.local',
      '.env.development.local',
      '.env.test.local',
      '.env.production.local',
      
      // Git
      '.git/**',
      
      // Minified files
      '*.min.js',
      '*.bundle.js',
      '*.min.css',
      '*.bundle.css',
      
      // Common binary file types
      '*.jpg', '*.jpeg', '*.png', '*.gif', '*.ico', '*.svg',
      '*.woff', '*.woff2', '*.ttf', '*.eot', '*.otf',
      '*.pdf', '*.zip', '*.tar.gz',
      
      // Framework-specific files
      '**/vendor/**',
      '**/fixtures/**',
      '**/test/fixtures/**',
      '**/docs/**'
    ]);
    
    // Add user-specified excludes
    if (Array.isArray(excludeDirs) && excludeDirs.length > 0) {
      ig.add(excludeDirs);
    }
    
    // Try to load .gitignore if it exists
    try {
      const gitignorePath = path.join(resolvedDirectory, '.gitignore');
      if (await fs.pathExists(gitignorePath)) {
        const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
        ig.add(gitignoreContent);
        console.log('Loaded .gitignore rules');
      }
    } catch (error) {
      console.warn(`Warning: Could not load .gitignore: ${error.message}`);
    }
    
    // Generate glob pattern with the resolved directory
    const pattern = `${resolvedDirectory}/**/*.{${extensions.join(',')}}`;
    console.log(`Using glob pattern: ${pattern}`);
    
    // Find all files matching the pattern
    const allFiles = glob.sync(pattern, { 
      nodir: true,  // Explicitly exclude directories
      follow: false,  // Don't follow symlinks to avoid loops
      dot: false     // Ignore dot files by default
    });
    
    console.log(`Found ${allFiles.length} files matching extensions`);
    
    // Filter files using ignore rules
    const files = allFiles.filter(file => {
      // Get the relative path for gitignore filtering
      const relativePath = path.relative(resolvedDirectory, file);
      return !ig.ignores(relativePath);
    });
    
    console.log(`After applying ignore rules: ${files.length} files remain`);
    
    // Load file contents, with safety checks
    const codebase = [];
    const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit to prevent loading huge files
    
    let skippedCount = 0;
    for (const file of files) {
      try {
        // Check if it's a file (not a directory)
        const stats = await fs.stat(file);
        if (!stats.isFile()) {
          skippedCount++;
          continue;
        }
        
        // Check file size
        if (stats.size > MAX_FILE_SIZE) {
          console.warn(`Skipping large file (${Math.round(stats.size/1024)}KB): ${file}`);
          skippedCount++;
          continue;
        }
        
        // Ignore binary files based on extension
        const ext = path.extname(file).toLowerCase();
        if ([
          // Images
          '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg', '.webp', '.tiff', '.psd',
          // Fonts
          '.woff', '.woff2', '.ttf', '.eot', '.otf',
          // Audio/Video
          '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.webm',
          // Archives
          '.zip', '.rar', '.tar', '.gz', '.7z',
          // Binaries
          '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
          // Documents
          '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
        ].includes(ext)) {
          console.log(`Skipping binary file: ${file}`);
          skippedCount++;
          continue;
        }
        
        // Check if content might be binary by reading first few bytes
        try {
          const fd = await fs.open(file, 'r');
          const buffer = Buffer.alloc(4096);
          const { bytesRead } = await fs.read(fd, buffer, 0, 4096, 0);
          await fs.close(fd);
          
          // Check for null bytes which are common in binary files
          if (buffer.slice(0, bytesRead).includes(0)) {
            console.log(`Skipping likely binary file: ${file}`);
            skippedCount++;
            continue;
          }
        } catch (err) {
          console.warn(`Error checking if binary: ${file}, ${err.message}`);
        }
        
        // Read the file content
        try {
          const content = await fs.readFile(file, 'utf8');
          codebase.push({
            path: file,
            content
          });
        } catch (err) {
          if (err.code === 'EISDIR') {
            skippedCount++;
          } else if (err.code === 'ENOENT') {
            skippedCount++; // File might have been deleted
          } else {
            console.warn(`Error reading file ${file}: ${err.message}`);
            skippedCount++;
          }
        }
      } catch (error) {
        console.warn(`Error processing file ${file}: ${error.message}`);
        skippedCount++;
      }
    }
    
    console.log(`Loaded ${codebase.length} files, skipped ${skippedCount} files`);
    return codebase;
  } catch (error) {
    console.error(`Error loading codebase: ${error.message}`);
    throw error;
  }
}

/**
 * Splits code content into meaningful chunks (functions, classes)
 * @param {string} content - File content
 * @param {string} filePath - Path to the file
 * @returns {Array<{type: string, name: string, code: string, path: string}>} - Array of code chunks
 */
function splitCode(content, filePath) {
  // For any tracing
  const fileName = path.basename(filePath);
  
  // Basic validation
  if (!content || typeof content !== 'string') {
    // Just return the file as a whole without parsing
    return [{
      type: 'File',
      name: fileName,
      code: typeof content === 'string' ? content.substring(0, 5000) : '',
      path: filePath
    }];
  }
  
  // Get file extension to determine how to handle the file
  const ext = path.extname(filePath).toLowerCase();
  
  // Use TypeScript parser for TypeScript files
  if (['.ts', '.tsx'].includes(ext)) {
    try {
      return processTypeScriptFile(content, filePath);
    } catch (tsError) {
      // If TypeScript parsing fails, fall back to returning the file as-is
      return [{
        type: 'File',
        name: fileName,
        code: content.substring(0, Math.min(content.length, 5000)), // Limit size
        path: filePath
      }];
    }
  }
  
  // Skip parsing for non-JavaScript files - they have different syntax
  if (!['.js', '.jsx', '.mjs', '.cjs', '.es6'].includes(ext)) {
    return [{
      type: 'File',
      name: fileName,
      code: content.substring(0, Math.min(content.length, 5000)), // Limit size
      path: filePath
    }];
  }
  
  // Additional safety checks
  // Skip parsing if the file is too large or has encoding issues
  if (content.length > 100000 || content.includes('\uFFFF')) {
    return [{
      type: 'File',
      name: fileName,
      code: content.substring(0, Math.min(content.length, 5000)),
      path: filePath
    }];
  }
  
  try {
    // Determine if file is likely a module based on keywords
    const isLikelyModule = content.includes('import ') || 
                          content.includes('export ') || 
                          ['.mjs', '.jsx', '.es6'].includes(ext);
    
    // Try parsing with the most likely mode first
    let ast = null;
    let success = false;
    
    try {
      // First parsing attempt
      if (isLikelyModule) {
        ast = esprima.parseModule(content, { loc: true, range: true, jsx: true });
      } else {
        ast = esprima.parseScript(content, { loc: true, range: true });
      }
      success = true;
    } catch (firstError) {
      // Try the opposite mode as fallback
      try {
        if (isLikelyModule) {
          ast = esprima.parseScript(content, { loc: true, range: true });
        } else {
          ast = esprima.parseModule(content, { loc: true, range: true, jsx: true });
        }
        success = true;
      } catch (secondError) {
        // Both parsing attempts failed - give up and just use the whole file
        success = false;
      }
    }
    
    // If parsing succeeded, extract function and class definitions
    if (success && ast && ast.body && Array.isArray(ast.body)) {
      const chunks = [];
      
      for (const node of ast.body) {
        // Skip invalid nodes
        if (!node || typeof node !== 'object' || !node.type) continue;
        
        // Only extract function and class declarations
        if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
          // Make sure we have valid range information
          if (node.range && Array.isArray(node.range) && node.range.length === 2 &&
              node.range[0] >= 0 && node.range[1] > node.range[0] && 
              node.range[1] <= content.length) {
            
            try {
              const chunk = content.substring(node.range[0], node.range[1]);
              
              // Add valid chunks only
              if (chunk && chunk.length > 0) {
                chunks.push({
                  type: node.type,
                  name: node.id && node.id.name ? node.id.name : 'anonymous',
                  code: chunk.substring(0, Math.min(chunk.length, 5000)), // Size limit
                  path: filePath
                });
              }
            } catch (chunkError) {
              // Skip this chunk if there was an error
            }
          }
        }
      }
      
      // If we successfully found chunks, return them
      if (chunks.length > 0) {
        return chunks;
      }
    }
    
    // Fallback: If parsing failed or no valid chunks found, return whole file
    return [{
      type: 'File',
      name: fileName,
      code: content.substring(0, Math.min(content.length, 5000)),
      path: filePath
    }];
  } catch (error) {
    // Silent error handling - just return the file without complaining
    return [{
      type: 'File',
      name: fileName,
      code: content.substring(0, Math.min(content.length, 5000)),
      path: filePath
    }];
  }
}

module.exports = {
  loadCodebase,
  splitCode
};