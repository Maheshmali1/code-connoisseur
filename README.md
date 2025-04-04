# Code Connoisseur

Code Connoisseur is an AI-powered code review agent built for multiple technology stacks, including MEAN/MERN, Java, and Python. It uses state-of-the-art language models (LLMs) to analyze your code changes and provide actionable, stack-specific feedback.

> **Want to know how Code Connoisseur compares to commercial tools?** See our [detailed comparison](COMPARISON.md) with leading code review tools like CodeRabbit, DeepCode, Codiga, and Bito.

## Features

- **Context-aware Reviews**: Understands your entire codebase, not just the changed files
- **Static Code Analysis**: Uses ESLint to catch syntax errors and potential bugs
- **Dependency Analysis**: Identifies files affected by changes
- **Test Coverage Estimation**: Suggests areas that need testing
- **Edge Case Detection**: Recommends edge cases to test based on code patterns
- **Multiple LLM Support**: Use OpenAI's GPT-4 or Anthropic's Claude models
- **Memory System**: Remembers past interactions to provide more consistent feedback
- **Advanced Feedback Loop**: Continuously improves through user feedback and analysis
- **Few-Shot Learning**: Uses examples of successful reviews to improve quality

## Installation

### Option 1: NPM Installation (Recommended)

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

After installation, the setup wizard will guide you through configuring your API keys. You'll need:
- OpenAI API key from [OpenAI](https://platform.openai.com/)
- Anthropic API key from [Anthropic](https://console.anthropic.com/)
- (Optional) Pinecone API key from [Pinecone](https://app.pinecone.io/)

You can reconfigure at any time by running:
```bash
code-connoisseur setup
```

### Option 2: Manual Installation

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

## Usage

### Indexing Your Codebase

Before you can use Code Connoisseur, you need to index your codebase:

```
code-connoisseur index
```

Options (all are optional):
- `--directory, -d <path>`: Path to your project (default: current directory)
- `--index-name, -i <name>`: Name for the vector database index (default: code-connoisseur)
- `--extensions, -e <list>`: File extensions to index as comma-separated list (default: js,ts,jsx,tsx,py)
- `--exclude, -x <list>`: Directories to exclude as comma-separated list (default: node_modules,dist,build,.git)
- `--js-only`: Only index JavaScript files (shortcut for -e js,jsx,ts,tsx)
- `--py-only`: Only index Python files (shortcut for -e py)
- `--java-only`: Only index Java files (shortcut for -e java)

All configuration and index data will be stored in a `.code-connoisseur` directory within your project:

```
.code-connoisseur/
  ├── config.json        # Configuration settings
  ├── feedback.json      # User feedback history
  ├── metadata/          # Additional metadata
  └── vectors/           # Vector embeddings for your codebase
```

### Reviewing Code Changes

To review changes in a file:

```
code-connoisseur review <path to file/directory>
```

Options:
- `--old, -o <path>`: Path to the previous version of the file (if not in git)
- `--llm, -l <provider>`: LLM provider to use (openai or anthropic)
- `--index-name, -i <name>`: Name of the index to use for review
- `--root, -r <dir>`: Project root directory for dependency analysis
- `--stack, -s <stack>`: Specify the technology stack (MEAN/MERN, Java, Python)
- `--directory, -d`: Review an entire directory of files
- `--extensions, -e <list>`: File extensions to include when reviewing directories
- `--markdown, -m <file>`: Save review to a markdown file (specify output path)
- `--max-files <number>`: Maximum number of files to review in a directory (default: 10)
- `--diff`: Only show changes in the review (compact mode)
- `--verbose, -v`: Show detailed output during the review process

### Analyzing Feedback

To view feedback statistics and analysis:

```
code-connoisseur feedback
```

This will show you statistics about past reviews, common issues, and suggested prompt improvements based on your feedback.

### Configuration

To configure Code Connoisseur:

```
code-connoisseur configure
```

This will launch an interactive prompt to set your preferences.

### Managing Indexed Codebases

To list all available indexed codebases:

```
code-connoisseur list
```

To clean up indexed files:

```
code-connoisseur clean [options]
```

Options:
- `--index-name, -i <name>`: Name of the index to remove
- `--all`: Remove all indexed data and configuration
- `--confirm`: Skip confirmation prompt (defaults to requiring confirmation)

### Global Options

These options can be used with any command:

```
code-connoisseur [command] [options]
```

- `--version`: Show the current version of Code Connoisseur
- `--verbose, -v`: Enable verbose output with detailed logging
- `--debug-env`: Display environment variable information for debugging

## How It Works

1. **Indexing**: Code Connoisseur parses your codebase, splits it into chunks, and stores embeddings in a vector database (Pinecone).
2. **Diff Analysis**: When reviewing, it analyzes the differences between old and new versions of a file.
3. **Static Analysis**: It checks for code quality issues using ESLint.
4. **Dependency Analysis**: It identifies which files depend on the changed file and which files it depends on.
5. **Test Coverage**: It estimates test coverage and identifies untested changes.
6. **Edge Case Detection**: It suggests edge cases to test based on the code patterns.
7. **Relevant Context**: It retrieves relevant context from the codebase based on the changes.
8. **Enhanced Prompt**: It builds a customized prompt based on feedback history and exemplars.
9. **AI Review**: It uses a language model to analyze all the information and generate comprehensive feedback.
10. **Feedback Collection**: User feedback is collected and analyzed to improve future reviews.
11. **Continuous Learning**: The system adapts to feedback by refining its prompts and approach.

### Implementation Details

Code Connoisseur is built with several components:

1. **Code Parser** (`src/codeParser.js`):
   - Uses `esprima` to parse JavaScript/TypeScript code into AST
   - Extracts functions, classes, and other structures
   - Handles error recovery for parsing issues

2. **Vector Store** (`src/vectorStore.js`):
   - Generates embeddings using OpenAI's text-embedding-ada-002 model
   - Stores embeddings in Pinecone for fast retrieval
   - Provides semantic search capabilities for finding relevant code

3. **Diff Analyzer** (`src/diffAnalyzer.js`):
   - Uses the `diff` library to compare code versions
   - Identifies added, removed, and modified lines
   - Provides detailed statistics about changes
   - Detects potential risks (e.g., commented code, console statements)

4. **Code Analyzer** (`src/codeAnalyzer.js`):
   - Performs static code analysis using ESLint
   - Analyzes dependencies using Madge
   - Estimates test coverage for changed code
   - Suggests edge cases based on code patterns

5. **Feedback System** (`src/feedbackSystem.js`):
   - Collects and stores user feedback on reviews
   - Analyzes feedback to identify common issues
   - Suggests prompt improvements based on patterns
   - Provides exemplars of good reviews for few-shot learning

6. **Code Review Agent** (`src/agent.js`):
   - Uses LangChain with OpenAI or Anthropic models
   - Integrates all analysis tools into a comprehensive review
   - Remembers past reviews through conversation memory
   - Adapts to feedback with improved prompts
   - Provides comprehensive, actionable feedback

7. **CLI Interface** (`src/cli.js`):
   - Provides a user-friendly interface with commands for indexing, reviewing, and analysis
   - Handles configuration management and API key validation
   - Facilitates the feedback loop for continuous improvement

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.