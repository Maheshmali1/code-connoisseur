#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const dotenv = require('dotenv');

// Load .env file - try multiple paths to ensure it works in both direct and Node.js environments
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '..', '.env')
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`Loaded environment from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.error('Warning: No .env file found!');
}

const { loadCodebase, splitCode } = require('./codeParser');
const { embedChunks, storeEmbeddings } = require('./vectorStore');
const { CodeReviewAgent } = require('./agent');

// Default index name
const DEFAULT_INDEX_NAME = 'code-connoisseur';

// Create a central directory for all code-connoisseur files in the repository
const CONNOISSEUR_DIR = path.join(process.cwd(), '.code-connoisseur');
fs.ensureDirSync(CONNOISSEUR_DIR);

// Configuration file path
const CONFIG_PATH = path.join(CONNOISSEUR_DIR, 'config.json');

// Initialize configuration
let config = {
  indexName: DEFAULT_INDEX_NAME,
  llmProvider: process.env.DEFAULT_LLM_PROVIDER || 'anthropic', // Use default from env or fallback to anthropic
  extensions: ['js', 'ts', 'jsx', 'tsx', 'py'],  // Added Python files by default
  excludeDirs: ['node_modules', 'dist', 'build', '.git', 'venv', '__pycache__'],  // Added Python-specific dirs to exclude
  version: '1.0.0'
};

// Check for legacy config file in project root (for migration)
const LEGACY_CONFIG_PATH = path.join(process.cwd(), '.code-connoisseur.json');

// Load configuration 
if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = { ...config, ...fs.readJsonSync(CONFIG_PATH) };
  } catch (error) {
    console.error('Error loading configuration:', error.message);
  }
} else if (fs.existsSync(LEGACY_CONFIG_PATH)) {
  // Migrate from legacy location
  try {
    console.log('Migrating configuration from legacy location...');
    config = { ...config, ...fs.readJsonSync(LEGACY_CONFIG_PATH) };
    saveConfig(); // Save to new location
    console.log(`Configuration migrated to ${CONFIG_PATH}`);
  } catch (error) {
    console.error('Error migrating configuration:', error.message);
  }
}

// Save configuration
function saveConfig() {
  fs.writeJsonSync(CONFIG_PATH, config, { spaces: 2 });
}

// Wait a short time to ensure environment variables are loaded
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if API keys are set and valid
async function checkApiKeys(command) {
  // Slight delay to ensure environment variables are fully loaded
  await delay(100);
  const errors = [];
  const defaultKeyValue = 'your_openai_api_key_here';
  
  // Validate OpenAI API key format
  const hasValidOpenAI = process.env.OPENAI_API_KEY && 
                        process.env.OPENAI_API_KEY !== 'placeholder' && 
                        process.env.OPENAI_API_KEY !== defaultKeyValue &&
                        process.env.OPENAI_API_KEY.startsWith('sk-');
  
  // Validate Anthropic API key format - with detailed debug
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  console.log('Anthropic key check:', anthropicKey ? `${anthropicKey.slice(0, 10)}...` : 'undefined');
  console.log('Starts with sk-ant-?', anthropicKey?.startsWith('sk-ant-'));
  console.log('Equals placeholder?', anthropicKey === 'placeholder');
  console.log('Equals default value?', anthropicKey === 'your_anthropic_api_key_here');
  
  const hasValidAnthropic = anthropicKey && 
                           anthropicKey !== 'placeholder' && 
                           anthropicKey !== 'your_anthropic_api_key_here' &&
                           anthropicKey.startsWith('sk-ant-');
  
  // Only check if we need the key for the selected provider
  if (config.llmProvider === 'openai' && !hasValidOpenAI) {
    errors.push('OPENAI_API_KEY is not properly set in .env file');
  }
  
  if (config.llmProvider === 'anthropic' && !hasValidAnthropic) {
    errors.push('ANTHROPIC_API_KEY is not properly set in .env file');
  }
  
  // Print validation status for debugging
  if (hasValidOpenAI) {
    console.log('Valid OpenAI API key detected');
  }
  
  if (hasValidAnthropic) {
    console.log('Valid Anthropic API key detected');
  }
  
  // Make Pinecone key optional - will use local storage if not available
  if (!process.env.PINECONE_API_KEY || 
      process.env.PINECONE_API_KEY === 'placeholder' || 
      process.env.PINECONE_API_KEY === 'your_pinecone_api_key_here') {
    console.log(chalk.yellow('Warning: PINECONE_API_KEY not set - using local vector storage instead'));
    // Not adding to errors since we're making it optional
  }
  
  if (errors.length > 0 && command !== 'help') {
    console.error(chalk.red('Error: Missing or Invalid API Keys'));
    errors.forEach(error => console.error(chalk.yellow(`- ${error}`)));
    console.log('');
    console.log(chalk.cyan('Please add your real API keys to the .env file:'));
    console.log('1. Open the .env file in the project root directory');
    console.log('2. Replace the placeholder values with your actual API keys:');
    
    if (config.llmProvider === 'openai') {
      console.log(`   ${chalk.green('OPENAI_API_KEY=')}${chalk.blue('your_actual_key_here')}`);
    } else {
      console.log(`   ${chalk.green('ANTHROPIC_API_KEY=')}${chalk.blue('your_actual_key_here')}`);
    }
    
    console.log(`   ${chalk.green('PINECONE_API_KEY=')}${chalk.blue('your_actual_key_here')} (optional)`);
    console.log('');
    console.log('You can obtain API keys from:');
    console.log('- OpenAI API key: https://platform.openai.com/');
    console.log('- Anthropic API key: https://console.anthropic.com/');
    console.log('- Pinecone API key: https://app.pinecone.io/');
    process.exit(1);
  }
}

// Debug environment variables
function debugEnvironment() {
  console.log('\nEnvironment variables:');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Loaded (starts with: ' + process.env.OPENAI_API_KEY.slice(0, 10) + '...)' : '❌ Not found');
  console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Loaded (starts with: ' + process.env.ANTHROPIC_API_KEY.slice(0, 10) + '...)' : '❌ Not found');
  console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? '✅ Loaded (starts with: ' + process.env.PINECONE_API_KEY.slice(0, 10) + '...)' : '❌ Not found');
  console.log('DEFAULT_LLM_PROVIDER:', process.env.DEFAULT_LLM_PROVIDER || '❌ Not found');
  console.log('Using LLM provider:', config.llmProvider, '\n');
}

// Initialize CLI
program
  .name('code-connoisseur')
  .description('AI-powered code review agent for Node.js projects')
  .version(config.version)
  .option('--debug-env', 'Display environment variables for debugging');

// Process global options
program.hook('preAction', (thisCommand, actionCommand) => {
  if (program.opts().debugEnv) {
    debugEnvironment();
  }
});

// Index command
program
  .command('index')
  .description('Index your codebase for the AI agent')
  .option('-d, --directory <path>', 'Directory to index', process.cwd())
  .option('-i, --index-name <name>', 'Name for the Pinecone index', config.indexName)
  .option('-e, --extensions <list>', 'File extensions to index (comma-separated)', config.extensions.join(','))
  .option('--js-only', 'Only index JavaScript files (shortcut for -e js,jsx,ts,tsx)')
  .option('--py-only', 'Only index Python files (shortcut for -e py)')
  .option('--java-only', 'Only index Java files (shortcut for -e java)')
  .option('-x, --exclude <list>', 'Directories to exclude (comma-separated)', config.excludeDirs.join(','))
  .action(async (options) => {
    await checkApiKeys('index');
    
    // Handle extension shortcuts
    if (options.jsOnly) {
      options.extensions = 'js,jsx,ts,tsx';
      console.log('Using JavaScript extensions only: js,jsx,ts,tsx');
    } else if (options.pyOnly) {
      options.extensions = 'py';
      console.log('Using Python extensions only: py');
    } else if (options.javaOnly) {
      options.extensions = 'java';
      console.log('Using Java extensions only: java');
    }
    
    // Update config
    config.indexName = options.indexName;
    config.extensions = options.extensions.split(',').map(ext => ext.trim());
    config.excludeDirs = options.exclude.split(',').map(dir => dir.trim());
    saveConfig();
    
    const spinner = ora('Indexing codebase...').start();
    
    try {
      // Load codebase with exclusions
      spinner.text = 'Loading files...';
      const codebase = await loadCodebase(
        options.directory, 
        config.extensions,
        config.excludeDirs
      );
      spinner.succeed(`Loaded ${codebase.length} files`);
      
      // Split into chunks
      spinner.text = 'Splitting files into chunks...';
      spinner.start();
      const chunks = [];
      let failedFiles = 0;
      
      // Don't log every error to avoid cluttering the console
      const MAX_ERRORS_TO_SHOW = 5; 
      let errorsShown = 0;
      
      const tsFiles = [];
      const jsFiles = [];
      const otherFiles = [];
      
      // Categorize files by type for better reporting
      const pyFiles = [];
      for (const file of codebase) {
        const ext = path.extname(file.path).toLowerCase();
        if (['.ts', '.tsx'].includes(ext)) {
          tsFiles.push(file);
        } else if (['.js', '.jsx', '.mjs', '.cjs', '.es6'].includes(ext)) {
          jsFiles.push(file);
        } else if (['.py'].includes(ext)) {
          pyFiles.push(file);
        } else {
          otherFiles.push(file);
        }
      }
      
      console.log(`Processing ${tsFiles.length} TypeScript files, ${jsFiles.length} JavaScript files, ${pyFiles.length} Python files, and ${otherFiles.length} other files`);
      
      // Process all files
      for (const file of codebase) {
        try {
          const fileChunks = splitCode(file.content, file.path);
          chunks.push(...fileChunks);
        } catch (error) {
          failedFiles++;
          // Only show a limited number of errors
          if (errorsShown < MAX_ERRORS_TO_SHOW) {
            console.warn(`Error processing ${file.path}: ${error.message}`);
            errorsShown++;
          } else if (errorsShown === MAX_ERRORS_TO_SHOW) {
            console.warn(`Additional errors omitted...`);
            errorsShown++;
          }
        }
      }
      
      spinner.succeed(`Generated ${chunks.length} code chunks (skipped ${failedFiles} files)`);
      
      // Generate embeddings
      spinner.text = 'Generating embeddings...';
      spinner.start();
      const embeddedChunks = await embedChunks(chunks);
      spinner.succeed('Generated embeddings');
      
      // Store in Pinecone
      spinner.text = 'Storing in vector database...';
      spinner.start();
      await storeEmbeddings(embeddedChunks, config.indexName);
      spinner.succeed('Indexing completed!');
      
      console.log(chalk.green('\nYour codebase is now indexed and ready for review!'));
      console.log(`Use ${chalk.cyan('code-connoisseur review <file>')} to review code changes.`);
    } catch (error) {
      spinner.fail(`Indexing failed: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  });

// Review command
program
  .command('review')
  .description('Review code changes in a file or directory')
  .argument('<path>', 'File or directory to review')
  .option('-o, --old <path>', 'Previous version of the file (if not in git)')
  .option('-l, --llm <provider>', 'LLM provider (openai or anthropic)', config.llmProvider)
  .option('-r, --root <dir>', 'Project root directory for analysis', process.cwd())
  .option('-s, --stack <name>', 'Specify the technology stack (MEAN/MERN, Java, Python)')
  .option('-d, --directory', 'Review an entire directory of files')
  .option('-e, --extensions <list>', 'File extensions to include when reviewing directories', config.extensions.join(','))
  .option('-m, --markdown <file>', 'Save review to a markdown file')
  .action(async (targetPath, options) => {
    await checkApiKeys('review');
    
    // Update config
    config.llmProvider = options.llm;
    saveConfig();
    
    const absolutePath = path.resolve(process.cwd(), targetPath);
    const projectRoot = path.resolve(process.cwd(), options.root);
    
    if (!fs.existsSync(absolutePath)) {
      console.error(chalk.red(`Error: Path not found: ${absolutePath}`));
      process.exit(1);
    }
    
    if (!fs.existsSync(projectRoot)) {
      console.error(chalk.red(`Error: Project root directory not found: ${projectRoot}`));
      process.exit(1);
    }
    
    // Flag to track if review process is in progress
    let reviewInProgress = false;
    
    // Add a local handler for interrupts during review
    const handleInterrupt = () => {
      if (reviewInProgress) {
        console.log(chalk.yellow('\n\nReview process interrupted. Cleaning up...'));
        // Any cleanup needed for the review process
        process.exit(0);
      }
    };
    
    // Register the handler for this specific command
    process.on('SIGINT', handleInterrupt);
    
    const spinner = ora('Preparing code review...').start();
    reviewInProgress = true;
    
    try {
      // Initialize agent
      spinner.text = 'Initializing code review agent...';
      const agent = new CodeReviewAgent(config.indexName, config.llmProvider);
      
      // Check if we're reviewing a directory or a single file
      const isDirectory = fs.statSync(absolutePath).isDirectory() || options.directory;
      
      if (isDirectory) {
        // Directory mode - review multiple files
        spinner.text = 'Scanning directory for changes...';
        
        // Get file extensions to include
        const extensionsToInclude = options.extensions.split(',').map(ext => ext.trim());
        
        // Get all files in the directory that match the extensions
        const { execSync } = require('child_process');
        let filesToReview = [];
        let excludedDirs = config.excludeDirs;
        
        try {
          // First try using git to find changed files
          const gitOutput = execSync(
            `git diff --name-only HEAD -- ${absolutePath}`, 
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
          );
          
          const changedFiles = gitOutput.split('\n').filter(Boolean);
          
          if (changedFiles.length > 0) {
            // Filter by extensions
            filesToReview = changedFiles.filter(file => {
              const ext = path.extname(file).toLowerCase().substring(1); // Remove the dot
              return extensionsToInclude.includes(ext);
            }).map(file => path.resolve(process.cwd(), file));
            
            spinner.text = `Found ${filesToReview.length} changed files in git`;
          } else {
            spinner.text = 'No git changes found, scanning directory recursively';
            // Fall back to recursive scan
            const getAllFiles = (dir, extensions, excluded) => {
              const files = [];
              const items = fs.readdirSync(dir);
              
              for (const item of items) {
                const itemPath = path.join(dir, item);
                const isExcluded = excluded.some(excl => itemPath.includes(excl));
                
                if (isExcluded) continue;
                
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                  files.push(...getAllFiles(itemPath, extensions, excluded));
                } else {
                  const ext = path.extname(itemPath).toLowerCase().substring(1); // Remove the dot
                  if (extensions.includes(ext)) {
                    files.push(itemPath);
                  }
                }
              }
              
              return files;
            };
            
            filesToReview = getAllFiles(absolutePath, extensionsToInclude, excludedDirs);
          }
        } catch (error) {
          spinner.text = 'Scanning directory recursively';
          // If git fails, scan the directory recursively
          const getAllFiles = (dir, extensions, excluded) => {
            const files = [];
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
              const itemPath = path.join(dir, item);
              const isExcluded = excluded.some(excl => itemPath.includes(excl));
              
              if (isExcluded) continue;
              
              const stat = fs.statSync(itemPath);
              if (stat.isDirectory()) {
                files.push(...getAllFiles(itemPath, extensions, excluded));
              } else {
                const ext = path.extname(itemPath).toLowerCase().substring(1); // Remove the dot
                if (extensions.includes(ext)) {
                  files.push(itemPath);
                }
              }
            }
            
            return files;
          };
          
          filesToReview = getAllFiles(absolutePath, extensionsToInclude, excludedDirs);
        }
        
        // Limit the number of files to avoid timeouts
        const MAX_FILES = 10;
        if (filesToReview.length > MAX_FILES) {
          console.log(chalk.yellow(`Found ${filesToReview.length} files, but only reviewing the ${MAX_FILES} most recently modified`));
          
          // Sort by modification time
          filesToReview = filesToReview
            .map(file => ({ path: file, mtime: fs.statSync(file).mtime }))
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, MAX_FILES)
            .map(file => file.path);
        }
        
        if (filesToReview.length === 0) {
          spinner.fail('No matching files found to review');
          process.exit(1);
        }
        
        spinner.succeed(`Found ${filesToReview.length} files to review`);
        
        // Review each file
        const reviews = [];
        for (let i = 0; i < filesToReview.length; i++) {
          const filePath = filesToReview[i];
          spinner.text = `Reviewing file ${i+1}/${filesToReview.length}: ${path.basename(filePath)}`;
          spinner.start();
          
          try {
            let oldCode = '';
            const newCode = fs.readFileSync(filePath, 'utf8');
            
            // Get old version from git
            try {
              const { execSync } = require('child_process');
              oldCode = execSync(`git show HEAD:${path.relative(process.cwd(), filePath)}`, { 
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'ignore']
              });
            } catch (error) {
              // If git fails, use a placeholder to indicate it's a new file
              oldCode = '// This appears to be a new file with no previous version';
            }
            
            // Generate review for this file
            const review = await agent.reviewCode(oldCode, newCode, filePath, { 
              projectRoot: projectRoot,
              stack: options.stack
            });
            
            reviews.push({
              filePath,
              review
            });
            
            spinner.succeed(`Reviewed ${path.basename(filePath)}`);
          } catch (error) {
            spinner.warn(`Failed to review ${path.basename(filePath)}: ${error.message}`);
          }
        }
        
        // Display all reviews
        console.log('\n' + chalk.bold.cyan('Code Connoisseur Directory Review:'));
        console.log(chalk.yellow('============================================='));
        
        // Prepare markdown content
        let markdownContent = `# Code Connoisseur Review: ${path.basename(absolutePath)}\n\n`;
        markdownContent += `*Generated on ${new Date().toLocaleString()}*\n\n`;
        markdownContent += `## Directory: ${absolutePath}\n\n`;
        
        for (const { filePath, review } of reviews) {
          console.log(chalk.bold.green(`\n## File: ${path.basename(filePath)}`));
          console.log(review);
          console.log('\n' + chalk.yellow('---------------------------------------------'));
          
          // Add to markdown content
          markdownContent += `## File: ${path.basename(filePath)}\n\n`;
          markdownContent += `\`\`\`\n${review}\n\`\`\`\n\n`;
          markdownContent += `---\n\n`;
        }
        
        console.log(chalk.yellow('============================================='));
        
        // Save to markdown file if requested
        if (options.markdown) {
          try {
            const mdFilePath = path.resolve(process.cwd(), options.markdown);
            fs.writeFileSync(mdFilePath, markdownContent);
            console.log(chalk.green(`\nReview saved to markdown file: ${mdFilePath}`));
          } catch (error) {
            console.error(chalk.red(`Error saving to markdown file: ${error.message}`));
          }
        }
        
        // Ask for feedback
        const { feedback, outcome } = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'Do you have any feedback on these reviews? (optional)'
          },
          {
            type: 'list',
            name: 'outcome',
            message: 'Were these reviews helpful?',
            choices: ['Accepted', 'Partially Helpful', 'Not Helpful']
          }
        ]);
        
        // Log feedback with review content for future learning
        if (feedback || outcome) {
          const reviewId = Date.now().toString();
          agent.logFeedback(
            reviewId, 
            feedback, 
            outcome.toLowerCase().replace(' ', '_'),
            JSON.stringify(reviews.map(r => ({ file: r.filePath, review: r.review })))
          );
          console.log(chalk.green('Thank you for your feedback!'));
        }
      } else {
        // Single file mode
        let oldCode = '';
        const newCode = fs.readFileSync(absolutePath, 'utf8');
        
        // Get old version from options or try git
        if (options.old) {
          const oldFilePath = path.resolve(process.cwd(), options.old);
          if (fs.existsSync(oldFilePath)) {
            oldCode = fs.readFileSync(oldFilePath, 'utf8');
          } else {
            spinner.fail(`Previous version not found: ${oldFilePath}`);
            process.exit(1);
          }
        } else {
          // Try to get previous version from git
          try {
            const { execSync } = require('child_process');
            oldCode = execSync(`git show HEAD:${path.relative(process.cwd(), absolutePath)}`, { 
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'ignore']
            });
          } catch (error) {
            spinner.fail('Could not get previous version from git. Use --old option to specify the previous version.');
            process.exit(1);
          }
        }
        
        // Generate enhanced review with advanced analysis
        const review = await agent.reviewCode(oldCode, newCode, absolutePath, { 
          projectRoot: projectRoot,
          stack: options.stack
        });
        
        spinner.succeed('Code review completed!');
        
        // Display review
        console.log('\n' + chalk.bold.cyan('Code Connoisseur Review:'));
        console.log(chalk.yellow('============================================='));
        console.log(review);
        console.log(chalk.yellow('============================================='));
        
        // Save to markdown file if requested
        if (options.markdown) {
          try {
            const mdFilePath = path.resolve(process.cwd(), options.markdown);
            
            // Create markdown content
            let markdownContent = `# Code Connoisseur Review: ${path.basename(absolutePath)}\n\n`;
            markdownContent += `*Generated on ${new Date().toLocaleString()}*\n\n`;
            markdownContent += `## File: ${absolutePath}\n\n`;
            markdownContent += `\`\`\`\n${review}\n\`\`\`\n\n`;
            
            fs.writeFileSync(mdFilePath, markdownContent);
            console.log(chalk.green(`\nReview saved to markdown file: ${mdFilePath}`));
          } catch (error) {
            console.error(chalk.red(`Error saving to markdown file: ${error.message}`));
          }
        }
        
        // Ask for feedback
        const { feedback, outcome } = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'Do you have any feedback on this review? (optional)'
          },
          {
            type: 'list',
            name: 'outcome',
            message: 'Was this review helpful?',
            choices: ['Accepted', 'Partially Helpful', 'Not Helpful']
          }
        ]);
        
        // Log feedback with review content for future learning
        if (feedback || outcome) {
          const reviewId = Date.now().toString();
          agent.logFeedback(
            reviewId, 
            feedback, 
            outcome.toLowerCase().replace(' ', '_'),
            review
          );
          console.log(chalk.green('Thank you for your feedback!'));
        }
      }
    } catch (error) {
      spinner.fail(`Review failed: ${error.message}`);
      console.error(error);
      reviewInProgress = false;
      process.exit(1);
    } finally {
      // Clean up
      reviewInProgress = false;
      // Remove our specific handler to avoid memory leaks
      process.removeListener('SIGINT', handleInterrupt);
    }
  });

// Configure command
program
  .command('configure')
  .description('Configure the agent settings')
  .action(async () => {
    await checkApiKeys('configure');
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'indexName',
        message: 'Vector database index name:',
        default: config.indexName
      },
      {
        type: 'list',
        name: 'llmProvider',
        message: 'Choose LLM provider:',
        choices: ['openai', 'anthropic'],
        default: config.llmProvider
      },
      {
        type: 'input',
        name: 'extensions',
        message: 'File extensions to index (comma-separated):',
        default: config.extensions.join(',')
      },
      {
        type: 'input',
        name: 'excludeDirs',
        message: 'Directories to exclude (comma-separated):',
        default: config.excludeDirs.join(',')
      }
    ]);
    
    // Update config
    config.indexName = answers.indexName;
    config.llmProvider = answers.llmProvider;
    config.extensions = answers.extensions.split(',').map(ext => ext.trim());
    config.excludeDirs = answers.excludeDirs.split(',').map(dir => dir.trim());
    
    saveConfig();
    console.log(chalk.green('Configuration updated!'));
  });

// Feedback analysis command
program
  .command('feedback')
  .description('View feedback analysis and statistics')
  .action(async () => {
    const spinner = ora('Analyzing feedback...').start();
    
    try {
      // Initialize agent to access feedback system
      const agent = new CodeReviewAgent(config.indexName, config.llmProvider);
      const analysis = agent.getFeedbackAnalysis();
      
      spinner.succeed('Feedback analysis completed!');
      
      // Display feedback analysis
      console.log('\n' + chalk.bold.cyan('Feedback Analysis:'));
      console.log(chalk.yellow('============================================='));
      
      if (analysis.totalReviews === 0) {
        console.log(chalk.yellow('No feedback data available yet.'));
      } else {
        // Stats
        console.log(chalk.bold('Review Statistics:'));
        console.log(`Total Reviews: ${analysis.totalReviews}`);
        console.log(`Acceptance Rate: ${(analysis.acceptanceRate * 100).toFixed(1)}%`);
        console.log(`Accepted: ${analysis.stats.accepted}`);
        console.log(`Partially Helpful: ${analysis.stats.partiallyHelpful}`);
        console.log(`Not Helpful: ${analysis.stats.notHelpful}`);
        
        // Common issues
        if (analysis.commonIssues.length > 0) {
          console.log('\n' + chalk.bold('Common Issues:'));
          analysis.commonIssues.forEach(issue => {
            console.log(`- ${issue.issue}: ${issue.count} (${issue.percentage.toFixed(1)}%)`);
          });
        }
        
        // Prompt improvements
        if (analysis.promptImprovements.length > 0) {
          console.log('\n' + chalk.bold('Suggested Prompt Improvements:'));
          analysis.promptImprovements.forEach(improvement => {
            console.log(`- ${improvement}`);
          });
        }
      }
      
      console.log(chalk.yellow('============================================='));
    } catch (error) {
      spinner.fail(`Analysis failed: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
  console.log(`See --help for a list of available commands.`);
  process.exit(1);
});

// Handle SIGINT (Ctrl+C) and other termination signals
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nProcess interrupted by user. Shutting down gracefully...'));
  console.log(chalk.yellow('Any in-progress reviews will be terminated.'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\nProcess terminated. Shutting down gracefully...'));
  process.exit(0);
});

// This makes sure we don't leave hanging processes
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n\nUnexpected error:'), error.message);
  console.error(chalk.yellow('Shutting down...'));
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

// Display help if no arguments provided
if (program.args.length === 0) {
  program.help();
}