# Code Connoisseur Setup and Usage Guide

This document provides detailed instructions for setting up and using Code Connoisseur, an AI-powered code review agent.

## Installation

### Prerequisites

Before installing Code Connoisseur, ensure you have:

1. **Node.js**: Version 14.x or higher
2. **npm**: Version 6.x or higher
3. **API Keys**:
   - OpenAI API key (from [OpenAI](https://platform.openai.com/)) OR
   - Anthropic API key (from [Anthropic](https://console.anthropic.com/))
   - (Optional) Pinecone API key (from [Pinecone](https://app.pinecone.io/))

### Installation Methods

#### Option 1: NPM Installation (Recommended)

Install Code Connoisseur globally via npm:

```bash
npm install -g code-connoisseur
```

If you encounter permission errors, you can either:

1. Use sudo (quick but not recommended for security):
   ```bash
   sudo npm install -g code-connoisseur
   ```

2. Configure npm to use a different directory (recommended):
   ```bash
   mkdir -p ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   ```
   Add the export line to your .bashrc or .zshrc file to make it permanent.

#### Option 2: Manual Installation

If you prefer to install from source:

1. Clone the repository:
   ```bash
   git clone https://github.com/Maheshmali1/code-connoisseur
   cd code-connoisseur
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project directory:
   ```bash
   cp .env.example .env
   ```

4. Add your API keys to the `.env` file:
   ```
   OPENAI_API_KEY=your_openai_key_here
   ANTHROPIC_API_KEY=your_anthropic_key_here
   PINECONE_API_KEY=your_pinecone_key_here  # Optional
   ```

5. Make the CLI tool globally available:
   ```bash
   npm link
   ```

## Initial Setup

After installation, you'll need to configure Code Connoisseur with your API keys:

```bash
code-connoisseur setup
```

This interactive setup wizard will guide you through:
1. Configuring your API keys
2. Setting your preferred LLM provider
3. Customizing file extensions to include/exclude
4. Setting other preferences

## Basic Usage

### Indexing Your Codebase

Before you can use Code Connoisseur for code reviews, you need to index your codebase:

```bash
code-connoisseur index
```

This command:
1. Scans your codebase for files matching the configured extensions
2. Splits the code into semantic chunks
3. Generates embeddings for each chunk
4. Stores the embeddings in a vector database (Pinecone or local)

#### Indexing Options

- `--directory, -d <path>`: Path to your project (default: current directory)
- `--index-name, -i <name>`: Name for the vector database index (default: code-connoisseur)
- `--extensions, -e <list>`: File extensions to index as comma-separated list (default: js,ts,jsx,tsx,py)
- `--exclude, -x <list>`: Directories to exclude as comma-separated list (default: node_modules,dist,build,.git)
- `--js-only`: Only index JavaScript files (shortcut for -e js,jsx,ts,tsx)
- `--py-only`: Only index Python files (shortcut for -e py)
- `--java-only`: Only index Java files (shortcut for -e java)

### Reviewing Code

To review changes in a file:

```bash
code-connoisseur review <path to file>
```

This command:
1. Retrieves the old version of the file (from git or specified path)
2. Analyzes the differences between versions
3. Performs static analysis on the code
4. Analyzes dependencies and potential impacts
5. Estimates test coverage for the changes
6. Suggests edge cases to test
7. Retrieves relevant context from the indexed codebase
8. Generates a comprehensive code review using the LLM

#### Review Options

- `--old, -o <path>`: Path to the previous version of the file (if not in git)
- `--llm, -l <provider>`: LLM provider to use (openai or anthropic)
- `--index-name, -i <name>`: Name of the index to use for review
- `--root, -r <dir>`: Project root directory for dependency analysis
- `--stack, -s <stack>`: Specify the technology stack (MEAN/MERN, Java, Python)
- `--markdown, -m <file>`: Save review to a markdown file (specify output path)
- `--diff`: Only show changes in the review (compact mode)
- `--verbose, -v`: Show detailed output during the review process

### Reviewing Multiple Files

To review changes in a directory:

```bash
code-connoisseur review <directory> --directory
```

This command:
1. Scans the directory for changed files (using git)
2. Reviews each file individually
3. Combines the reviews into a single report

#### Directory Review Options

- `--extensions, -e <list>`: File extensions to include when reviewing directories
- `--max-files <number>`: Maximum number of files to review in a directory (default: 10)

### Analyzing Feedback

To view feedback statistics and analysis:

```bash
code-connoisseur feedback
```

This will show you:
1. Statistics about past reviews
2. Common issues identified in feedback
3. Suggested prompt improvements based on your feedback

## Advanced Usage

### Configuration Management

To configure Code Connoisseur:

```bash
code-connoisseur configure
```

This will launch an interactive prompt to set your preferences.

### Managing Indexed Codebases

To list all available indexed codebases:

```bash
code-connoisseur list
```

To clean up indexed files:

```bash
code-connoisseur clean [options]
```

Options:
- `--index-name, -i <name>`: Name of the index to remove
- `--all`: Remove all indexed data and configuration
- `--confirm`: Skip confirmation prompt (defaults to requiring confirmation)

### Global Options

These options can be used with any command:

```bash
code-connoisseur [command] [options]
```

- `--version`: Show the current version of Code Connoisseur
- `--verbose, -v`: Enable verbose output with detailed logging
- `--debug-env`: Display environment variable information for debugging

## Workflow Examples

### Example 1: Basic Code Review Workflow

```bash
# Navigate to your project
cd my-project

# Index the codebase
code-connoisseur index

# Make changes to a file
# ...

# Review the changes
code-connoisseur review src/components/Button.js
```

### Example 2: Pre-commit Review Workflow

```bash
# Index the codebase (once per project)
code-connoisseur index

# Stage your changes
git add .

# Review all staged changes
git diff --name-only --staged | xargs code-connoisseur review --directory
```

### Example 3: CI/CD Integration

```bash
# In your CI/CD pipeline script
# Install Code Connoisseur
npm install -g code-connoisseur

# Set up environment variables
export OPENAI_API_KEY=$OPENAI_API_KEY_FROM_CI_SECRETS

# Index the codebase
code-connoisseur index

# Review changes in the current PR/branch
git diff --name-only origin/main... | xargs code-connoisseur review --directory --markdown review.md
```

## Troubleshooting

### Common Issues

1. **API Key Issues**:
   - Error: "No valid API keys found for any LLM provider"
   - Solution: Run `code-connoisseur setup` to configure your API keys

2. **Indexing Errors**:
   - Error: "Error processing file: ..."
   - Solution: Check if the file is valid and try excluding problematic directories with `--exclude`

3. **Review Errors**:
   - Error: "Could not get previous version from git"
   - Solution: Use `--old` to specify the previous version manually

4. **Performance Issues**:
   - Problem: Indexing is slow for large codebases
   - Solution: Use `--extensions` to limit the file types being indexed

### Getting Help

For more detailed help on any command:

```bash
code-connoisseur help [command]
```

## Conclusion

Code Connoisseur provides a powerful, AI-driven code review experience that integrates with your existing workflow. By following this guide, you should be able to set up and use Code Connoisseur effectively for your projects.