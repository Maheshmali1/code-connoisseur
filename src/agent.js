const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { ConversationChain } = require('langchain/chains');
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');
const { BufferMemory } = require('langchain/memory');
const { searchCodebase } = require('./vectorStore');
const { analyzeCodeChanges } = require('./diffAnalyzer');
const { runStaticAnalysis, analyzeDependencies, estimateTestCoverage, suggestEdgeCases } = require('./codeAnalyzer');
const FeedbackSystem = require('./feedbackSystem');
const path = require('path');
const {getSystemPrompt} = require("./system-prompts/system-prompt-manager");
require('dotenv').config();

// Check if we're running in a test environment
const isTestEnvironment = process.env.OPENAI_API_KEY?.includes('test') || 
                         process.env.ANTHROPIC_API_KEY?.includes('test') ||
                         process.env.NODE_ENV === 'test' ||
                         process.env.JEST_WORKER_ID !== undefined;

// Choose the LLM provider based on configuration
function getLLM(provider = 'openai') {
  // In test environment, return a mock LLM
  if (isTestEnvironment) {
    console.log("Test environment detected - using mock LLM");
    return {
      call: async (messages) => {
        return {
          content: "This is a mock response for testing purposes. The code looks good with some minor improvements suggested."
        };
      },
      invoke: async (messages) => {
        return {
          content: "This is a mock response for testing purposes. The code looks good with some minor improvements suggested."
        };
      }
    };
  }

  if (provider === 'anthropic' &&
      process.env.ANTHROPIC_API_KEY &&
      process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    console.log("Using Anthropic Claude for code review");
    return new ChatAnthropic({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      modelName: 'claude-3-7-sonnet-20250219',
      temperature: 0.3,
    });
  } else if (process.env.OPENAI_API_KEY &&
             process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' &&
             process.env.OPENAI_API_KEY.startsWith('sk-')) {
    console.log("Using OpenAI GPT-4 for code review");
    return new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4-turbo',
      temperature: 0.3,
    });
  } else {
    // Default to Anthropic if key looks valid
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
      console.log("Defaulting to Anthropic Claude for code review");
      return new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        modelName: 'claude-3-7-sonnet-20250219',
        temperature: 0.3,
      });
    } else {
      throw new Error("No valid API keys found for any LLM provider");
    }
  }
}

class CodeReviewAgent {
  constructor(indexName, llmProvider = 'openai') {
    this.indexName = indexName;
    this.llm = getLLM(llmProvider);
    this.memory = new BufferMemory();
    this.feedbackSystem = new FeedbackSystem();

    // Initialize with any feedback-based prompt improvements
    this.promptImprovements = this.feedbackSystem.getPromptImprovements();
  }

  /**
   * Reviews code changes between old and new versions
   * @param {string} oldCode - Original code
   * @param {string} newCode - New code
   * @param {string} filePath - Path to the file being reviewed
   * @param {Object} options - Additional options (stack, projectRoot)
   * @returns {Promise<string>} - Review feedback
   */
  async reviewCode(oldCode, newCode, filePath, options = {}) {
    console.log(`Reviewing changes in ${filePath}...`);
    const projectRoot = options.projectRoot || process.cwd();

    // Determine stack based on file extension or explicit option
    let stack = options.stack || this._detectStackFromFile(filePath, newCode);

    // Step 1: Analyze the diff
    console.log('Analyzing diff...');
    const diffAnalysis = analyzeCodeChanges(oldCode, newCode);

    // Step 2: Run static analysis
    console.log('Running static analysis...');
    const staticAnalysisResults = await runStaticAnalysis(newCode, filePath);

    // Step 3: Analyze dependencies
    console.log('Analyzing dependencies...');
    const dependencyAnalysis = await analyzeDependencies(filePath, projectRoot);

    // Step 4: Estimate test coverage
    console.log('Estimating test coverage...');
    const testCoverage = await estimateTestCoverage(filePath, diffAnalysis.changes);

    // Step 5: Suggest edge cases
    console.log('Identifying potential edge cases...');
    const edgeCases = suggestEdgeCases(newCode, filePath);

    // Step 6: Get relevant context from the codebase
    console.log('Getting relevant code context...');
    const relevantCode = await this._getRelevantCodeContext(oldCode, newCode, filePath);

    // Step 7: Get exemplars from feedback system
    const exemplars = this.feedbackSystem.getExemplars();

    // Step 8: Build enhanced system prompt with feedback-based improvements
    let enhancedPrompt = getSystemPrompt(stack);

    if (this.promptImprovements.length > 0) {
      enhancedPrompt += '\n\nBased on previous feedback, please also:\n';
      this.promptImprovements.forEach(improvement => {
        enhancedPrompt += `- ${improvement}\n`;
      });
    }

    if (exemplars.length > 0) {
      enhancedPrompt += '\n\nExamples of well-received reviews:\n';
      exemplars.forEach((exemplar, index) => {
        enhancedPrompt += `\nExample ${index + 1}:\n${exemplar.slice(0, 500)}...\n`;
      });
    }

    // Step 9: Prepare prompt for the LLM
    const staticIssuesFormatted = staticAnalysisResults.length > 0 
      ? staticAnalysisResults.map(issue => 
          `- Line ${issue.line}: ${issue.message} (${issue.severity === 2 ? 'Error' : 'Warning'})`).join('\n')
      : 'No static analysis issues found.';

    const dependenciesFormatted = 
      `Files that this file depends on: ${dependencyAnalysis.dependencies.length > 0 
        ? '\n- ' + dependencyAnalysis.dependencies.join('\n- ') 
        : 'None'}\n\n` +
      `Files that depend on this file: ${dependencyAnalysis.dependents.length > 0 
        ? '\n- ' + dependencyAnalysis.dependents.join('\n- ') 
        : 'None'}`;

    const testCoverageFormatted = 
      `Test Coverage: ${Math.round(testCoverage.coverage * 100)}%\n` +
      `${testCoverage.suggestion}\n` +
      `Untested changes: ${testCoverage.untested.length > 0 
        ? '\n- Lines ' + testCoverage.untested.map(range => 
            range.start === range.end ? range.start : `${range.start}-${range.end}`).join('\n- Lines ') 
        : 'None'}`;

    const edgeCasesFormatted = edgeCases.length > 0 
      ? 'Consider testing these edge cases:\n- ' + edgeCases.join('\n- ') 
      : 'No specific edge cases identified.';

    const messages = [
      new SystemMessage(enhancedPrompt),
      new HumanMessage(`I need you to review changes to the file: ${filePath}

## Stack
${stack}

## Diff Analysis
${diffAnalysis.formattedDiff}

## Stats
- Lines Added: ${diffAnalysis.stats.linesAdded}
- Lines Removed: ${diffAnalysis.stats.linesRemoved}
- Total Changes: ${diffAnalysis.stats.changeCount}

## Potential Risks
${diffAnalysis.potentialRisks.length > 0 ? diffAnalysis.potentialRisks.join('\n- ') : 'No specific risks detected.'}

## Static Analysis
${staticIssuesFormatted}

## Dependency Analysis
${dependenciesFormatted}

## Test Coverage
${testCoverageFormatted}

## Edge Cases
${edgeCasesFormatted}

## OldCode
${oldCode}

## NewCode
${newCode}

## Relevant Context
${relevantCode}

Please provide a thorough code review with actionable feedback according to the standards and best practices for the ${stack} stack. Focus on the quality, correctness, and maintainability of the code changes.`)
    ];

    // Add conversation history from memory if available
    let history = [];
    try {
      const memoryResult = await this.memory.loadMemoryVariables({});
      if (memoryResult.history) {
        history = memoryResult.history;
      }
    } catch (error) {
      console.log('No memory available yet');
    }

    // Step 10: Generate the review
    console.log('Generating review...');

    const response = await this.llm.call(messages);

    // Step 11: Update memory
    try {
      await this.memory.saveContext(
        { input: messages[messages.length - 1].content },
        { output: response.content }
      );
    } catch (error) {
      console.error('Error saving to memory:', error.message);
    }

    return response.content;
  }

  /**
   * Logs feedback on a review for improvement
   * @param {string} reviewId - ID of the review
   * @param {string} feedback - User feedback
   * @param {string} outcome - Outcome (accepted, partially_helpful, not_helpful)
   * @param {string} review - The review content
   */
  logFeedback(reviewId, feedback, outcome, review) {
    const metadata = { review };

    const logEntry = this.feedbackSystem.recordFeedback(
      reviewId,
      feedback,
      outcome,
      metadata
    );

    console.log(`Feedback logged for review ${reviewId}: ${outcome}`);

    // Update prompt improvements based on new feedback
    this.promptImprovements = this.feedbackSystem.getPromptImprovements();

    return logEntry;
  }

  /**
   * Gets feedback statistics and analysis
   * @returns {Object} - Feedback analysis
   */
  getFeedbackAnalysis() {
    return this.feedbackSystem.analyzeFeedback();
  }

  /**
   * Detects the technology stack based on file extension and content
   * @param {string} filePath - Path to the file
   * @param {string} code - File content
   * @returns {string} - Detected stack (MEAN/MERN, Java, Python, or Generic)
   * @private
   */
  _detectStackFromFile(filePath, code) {
    const extension = path.extname(filePath).toLowerCase();

    // Check extension first
    if (extension === '.js' || extension === '.jsx' || extension === '.ts' || extension === '.tsx') {
      // Check for MERN/MEAN specific imports
      if (code.includes('import React') || code.includes('from "react"') || 
          code.includes('from \'react\'') || code.includes('angular') ||
          code.includes('express') || code.includes('mongoose')) {
        return 'MEAN/MERN';
      }
      return 'MEAN/MERN'; // Default for JS files
    }

    if (extension === '.java') {
      return 'Java';
    }

    if (extension === '.py') {
      return 'Python';
    }

    // Try to infer from content if extension is not definitive
    if (code.includes('function') || code.includes('const') || code.includes('let') || 
        code.includes('require(') || code.includes('import ') || code.includes('export ')) {
      return 'MEAN/MERN';
    }

    if (code.includes('public class') || code.includes('private') || code.includes('void') || 
        code.includes('extends') || code.includes('implements')) {
      return 'Java';
    }

    if (code.includes('def ') || code.includes('import ') || code.includes('class ') || 
        code.includes(':') || code.includes('if __name__ == "__main__"')) {
      return 'Python';
    }

    // Default to MEAN/MERN for JavaScript/Node.js focus
    return 'MEAN/MERN';
  }


  /**
   * Gets relevant code context from the codebase
   * @param {string} oldCode - Original code
   * @param {string} newCode - New code
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} - Relevant code context
   * @private
   */
  async _getRelevantCodeContext(oldCode, newCode, filePath) {

    // Extract function and variable names from the changed code
    const functionRegex = /function\s+(\w+)/g;
    const variableRegex = /(?:const|let|var)\s+(\w+)/g;
    const classRegex = /class\s+(\w+)/g;
    const importRegex = /(?:import|require)\s+['"](.*)['"]/g;

    const extractMatches = (regex, text) => {
      const matches = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push(match[1]);
      }
      return matches;
    };

    const functions = [
      ...extractMatches(functionRegex, oldCode),
      ...extractMatches(functionRegex, newCode)
    ];

    const variables = [
      ...extractMatches(variableRegex, oldCode),
      ...extractMatches(variableRegex, newCode)
    ];

    const classes = [
      ...extractMatches(classRegex, oldCode),
      ...extractMatches(classRegex, newCode)
    ];

    const imports = [
      ...extractMatches(importRegex, oldCode),
      ...extractMatches(importRegex, newCode)
    ];

    // Get unique identifiers
    const identifiers = [...new Set([...functions, ...variables, ...classes, ...imports])];

    // If no identifiers found, use the file path parts
    if (identifiers.length === 0) {
      console.log('No identifiers found, using file path parts as identifiers');
      const pathParts = filePath.split('/').filter(Boolean);
      identifiers.push(...pathParts.slice(-2));
    }

    // Query the vector database for each identifier
    let results = [];
    try {
      for (const identifier of identifiers) {
        if (identifier.length < 3) continue; // Skip short identifiers

        const searchResults = await searchCodebase(identifier, this.indexName, 3);
        results.push(...searchResults);
      }

      // Also search based on file name
      const fileName = path.basename(filePath, path.extname(filePath));
      if (fileName.length >= 3) {
        const fileNameResults = await searchCodebase(fileName, this.indexName, 3);
        results.push(...fileNameResults);
      }
    } catch (error) {
      console.error('Error searching codebase:', error.message);
      return "Error accessing vector database.";
    }

    // Deduplicate results based on metadata.path and sort by relevance score
    const uniqueResults = [];
    const seenPaths = new Set();

    for (const result of results) {
      if (!seenPaths.has(result.metadata.path)) {
        seenPaths.add(result.metadata.path);
        uniqueResults.push(result);
      }
    }

    // Sort by relevance score
    uniqueResults.sort((a, b) => b.score - a.score);

    // Format the results
    if (uniqueResults.length === 0) {
      return "No relevant context found in the codebase.";
    }

    // Take top 5 most relevant results
    return uniqueResults.slice(0, 5).map(result => {
      return `File: ${result.metadata.path}\nRelevance: ${Math.round(result.score * 100)}%\n\n${result.metadata.code}\n\n`;
    }).join('---\n\n');
  }
}

module.exports = {
  CodeReviewAgent
};
