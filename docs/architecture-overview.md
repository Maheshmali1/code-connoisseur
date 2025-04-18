# Code Connoisseur Architecture Overview

This document provides a comprehensive overview of the Code Connoisseur system architecture, explaining how the various components work together to provide AI-powered code reviews.

## System Architecture

Code Connoisseur is built with a modular architecture that separates concerns and allows for extensibility. The system consists of the following major components:

1. **CLI Interface**: The entry point for users, handling commands, arguments, and configuration
2. **Code Review Agent**: The core AI component that orchestrates the review process
3. **Code Parser**: Responsible for parsing and chunking code for indexing
4. **Vector Store**: Manages code embeddings for semantic search
5. **Diff Analyzer**: Analyzes differences between code versions
6. **Code Analyzer**: Performs static analysis, dependency analysis, test coverage estimation, and edge case detection
7. **Feedback System**: Collects and analyzes user feedback to improve future reviews
8. **System Prompts**: Specialized prompts for different technology stacks

### Architecture Diagram (Text-Based)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  CLI Interface  │────▶│  Code Review    │────▶│  LLM Provider   │
│  (cli.js)       │     │  Agent          │     │  (OpenAI/       │
│                 │     │  (agent.js)     │     │   Anthropic)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Code Parser    │     │  Diff Analyzer  │     │  Code Analyzer  │
│  (codeParser.js)│     │  (diffAnalyzer.js)    │  (codeAnalyzer.js)
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                              │
         │                                              │
         ▼                                              ▼
┌─────────────────┐                           ┌─────────────────┐
│                 │                           │                 │
│  Vector Store   │                           │  Feedback       │
│  (vectorStore.js)                           │  System         │
│                 │                           │  (feedbackSystem.js)
└─────────────────┘                           └─────────────────┘
```

## Component Responsibilities

### CLI Interface (cli.js)

The CLI interface is the primary way users interact with Code Connoisseur. It:

- Processes command-line arguments and options
- Manages configuration (global and project-specific)
- Validates API keys and environment variables
- Implements commands for indexing, reviewing, and analyzing feedback
- Handles file and directory operations
- Provides user feedback through spinners and colored output
- Collects user feedback on reviews

### Code Review Agent (agent.js)

The Code Review Agent is the core of the system, orchestrating the review process. It:

- Selects the appropriate LLM provider (OpenAI or Anthropic)
- Coordinates the review process by calling other components
- Builds comprehensive prompts for the LLM
- Maintains conversation memory for context
- Processes and formats LLM responses
- Integrates feedback for continuous improvement

### Code Parser (codeParser.js, tsParser.js, pythonParser.js)

The Code Parser components handle parsing and chunking code for indexing. They:

- Load code files from the filesystem
- Parse code into abstract syntax trees (ASTs)
- Extract functions, classes, and other structures
- Split code into semantic chunks for embedding
- Handle language-specific parsing (JavaScript, TypeScript, Python)

### Vector Store (vectorStore.js)

The Vector Store manages code embeddings for semantic search. It:

- Generates embeddings using OpenAI's embedding model
- Stores embeddings in Pinecone or a local vector database
- Provides semantic search capabilities for finding relevant code
- Manages index creation and deletion

### Diff Analyzer (diffAnalyzer.js)

The Diff Analyzer examines differences between code versions. It:

- Compares old and new versions of code
- Identifies added, removed, and modified lines
- Calculates statistics about changes
- Formats diffs for human readability
- Identifies potential risks in changes

### Code Analyzer (codeAnalyzer.js)

The Code Analyzer performs various types of code analysis. It:

- Runs static code analysis using ESLint for JavaScript/TypeScript
- Implements custom analysis for Python code
- Analyzes dependencies between files
- Estimates test coverage for changed code
- Suggests edge cases based on code patterns
- Adapts analysis based on the programming language

### Feedback System (feedbackSystem.js)

The Feedback System collects and analyzes user feedback. It:

- Records user feedback on reviews
- Analyzes feedback to identify common issues
- Suggests prompt improvements based on patterns
- Provides exemplars of good reviews for few-shot learning

### System Prompts (system-prompts/)

The System Prompts provide specialized guidance for different technology stacks. They:

- Define the role and expertise of the AI reviewer
- Specify review objectives and criteria
- Provide stack-specific guidance (MEAN/MERN, Java, Python)
- Structure the response format

## Data Flow

1. **Indexing Flow**:
   - User runs `code-connoisseur index`
   - CLI loads codebase files
   - Code Parser splits files into chunks
   - Vector Store generates embeddings
   - Embeddings are stored in the vector database

2. **Review Flow**:
   - User runs `code-connoisseur review <file>`
   - CLI gets old and new versions of the file
   - Diff Analyzer compares versions
   - Code Analyzer performs static analysis, dependency analysis, etc.
   - Agent retrieves relevant context from Vector Store
   - Agent builds prompt with all analysis results
   - LLM generates review
   - CLI displays review and collects feedback
   - Feedback System records feedback for future improvement

## Integration Points

Code Connoisseur integrates with several external services and tools:

1. **LLM Providers**:
   - OpenAI (GPT-4)
   - Anthropic (Claude)

2. **Vector Database**:
   - Pinecone (optional)
   - Local vector storage (fallback)

3. **Static Analysis Tools**:
   - ESLint for JavaScript/TypeScript
   - Custom analyzers for Python

4. **Dependency Analysis**:
   - Madge for JavaScript/TypeScript
   - Custom analyzers for Python

5. **Version Control**:
   - Git for retrieving file history

## Configuration and State

Code Connoisseur maintains configuration and state in:

1. **Global Configuration**:
   - Stored in `~/.code-connoisseur-config/config.json`
   - Contains default settings and API keys

2. **Project Configuration**:
   - Stored in `.code-connoisseur/config.json` within the project
   - Contains project-specific settings

3. **Vector Database**:
   - Stores code embeddings for semantic search
   - Either in Pinecone or locally in `.code-connoisseur/vectors/`

4. **Feedback History**:
   - Stored in `.code-connoisseur/feedback.json`
   - Contains user feedback on reviews

## Extensibility

The modular architecture of Code Connoisseur allows for easy extension:

1. **New Language Support**:
   - Add a new parser for the language
   - Create a stack-specific system prompt
   - Update the stack detection logic

2. **New Analysis Types**:
   - Add new analysis functions to codeAnalyzer.js
   - Integrate results into the agent's prompt building

3. **New LLM Providers**:
   - Add support in the getLLM function in agent.js
   - Handle provider-specific API requirements

## Conclusion

Code Connoisseur's architecture is designed to provide comprehensive, context-aware code reviews by combining static analysis, semantic search, and large language models. The modular design allows for extensibility and continuous improvement through user feedback.