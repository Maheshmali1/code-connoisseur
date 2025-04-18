# Code Connoisseur Tests

This directory contains end-to-end tests for the Code Connoisseur CLI tool. The tests use Jest as the testing framework and cover all the major commands and functionality.

## Test Structure

- `tests/e2e/`: Contains end-to-end tests for each command
- `tests/fixtures/`: Contains sample code files for different languages used in tests
- `tests/test-utils.js`: Contains utility functions for testing

## Running Tests

To run all tests:

```bash
npm test
```

To run tests in watch mode (automatically re-run tests when files change):

```bash
npm run test:watch
```

To run tests with coverage reporting:

```bash
npm run test:coverage
```

To run a specific test file:

```bash
npx jest tests/e2e/index.test.js
```

## Test Environment

The tests use a temporary directory for testing and mock API keys. No actual API calls are made to OpenAI, Anthropic, or Pinecone during testing.

## Adding New Tests

### Adding a New Command Test

1. Create a new test file in the `tests/e2e/` directory
2. Use the existing test files as templates
3. Make sure to clean up any temporary directories or files created during testing

### Adding New Fixtures

If you need to add new sample code files for testing:

1. Add the files to the appropriate directory in `tests/fixtures/`
2. Make sure the files are properly formatted and contain valid code
3. Update the tests to use the new fixtures as needed

## Test Utilities

The `test-utils.js` file provides several utility functions for testing:

- `executeCommand`: Executes a Code Connoisseur CLI command
- `createTempFixture`: Creates a temporary directory with test fixtures
- `cleanupTempFixture`: Cleans up a temporary directory
- `createFile`: Creates a file with the given content
- `createModifiedFile`: Creates a modified version of a file for testing code review
- `wait`: Waits for a specified amount of time

## Mocking Interactive Commands

Some commands (like `review` and `configure`) are interactive and require user input. These are difficult to test in an automated way. The tests for these commands focus on verifying that the commands execute without errors and produce the expected output files, rather than testing the interactive aspects.

## Test Coverage

The tests aim to cover all the major functionality of Code Connoisseur, including:

- Indexing codebases with different languages
- Reviewing code changes in different languages
- Configuring the tool
- Listing indexed codebases
- Cleaning up indexed files
- Analyzing feedback

However, due to the interactive nature of some commands and the complexity of the AI-powered code review, not all aspects can be fully tested in an automated way.