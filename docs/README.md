# Code Connoisseur Documentation

Welcome to the Code Connoisseur documentation. This directory contains comprehensive documentation for understanding, setting up, and using Code Connoisseur, an AI-powered code review agent.

## Documentation Index

### Core Documentation

1. [Architecture Overview](architecture-overview.md) - Comprehensive overview of the system architecture, component responsibilities, data flow, and integration points.

2. [Setup and Usage Guide](setup-and-usage.md) - Detailed instructions for installing, configuring, and using Code Connoisseur, including command options and workflow examples.

3. [Feedback System and Continuous Learning](feedback-and-learning.md) - Explanation of how the feedback system works and how Code Connoisseur learns from user feedback to improve over time.

## Getting Started

If you're new to Code Connoisseur, we recommend starting with the [Setup and Usage Guide](setup-and-usage.md) to get the tool installed and configured. Then, you can explore the [Architecture Overview](architecture-overview.md) to understand how the system works.

## Key Features

Code Connoisseur provides several key features:

1. **Context-aware Reviews**: Understands your entire codebase, not just the changed files
2. **Static Code Analysis**: Uses ESLint to catch syntax errors and potential bugs
3. **Dependency Analysis**: Identifies files affected by changes
4. **Test Coverage Estimation**: Suggests areas that need testing
5. **Edge Case Detection**: Recommends edge cases to test based on code patterns
6. **Multiple LLM Support**: Use OpenAI's GPT-4 or Anthropic's Claude models
7. **Memory System**: Remembers past interactions to provide more consistent feedback
8. **Advanced Feedback Loop**: Continuously improves through user feedback and analysis
9. **Few-Shot Learning**: Uses examples of successful reviews to improve quality

## System Requirements

- **Node.js**: Version 14.x or higher
- **npm**: Version 6.x or higher
- **API Keys**:
  - OpenAI API key OR
  - Anthropic API key
  - (Optional) Pinecone API key

## Contributing to Documentation

If you'd like to improve this documentation, please feel free to submit a pull request. We welcome contributions that:

- Fix errors or clarify explanations
- Add examples or use cases
- Improve organization or readability
- Add new sections for undocumented features

## Support

If you encounter issues not addressed in this documentation, please:

1. Check the [main README](../README.md) for additional information
2. Open an issue on the [GitHub repository](https://github.com/Maheshmali1/code-connoisseur)