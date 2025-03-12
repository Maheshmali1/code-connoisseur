const fs = require('fs-extra');
const path = require('path');

/**
 * A system for collecting, storing, and analyzing feedback to improve the agent
 */
class FeedbackSystem {
  constructor(feedbackFilePath) {
    this.feedbackFilePath = feedbackFilePath || path.join(process.cwd(), '.code-connoisseur-feedback.json');
    this.feedbackLogs = this._loadFeedback();
  }
  
  /**
   * Loads feedback from the feedback file
   * @returns {Array} - Array of feedback entries
   * @private
   */
  _loadFeedback() {
    try {
      if (fs.existsSync(this.feedbackFilePath)) {
        return fs.readJsonSync(this.feedbackFilePath);
      }
    } catch (error) {
      console.error(`Error loading feedback: ${error.message}`);
    }
    
    return [];
  }
  
  /**
   * Saves feedback to the feedback file
   * @private
   */
  _saveFeedback() {
    try {
      fs.writeJsonSync(this.feedbackFilePath, this.feedbackLogs, { spaces: 2 });
    } catch (error) {
      console.error(`Error saving feedback: ${error.message}`);
    }
  }
  
  /**
   * Records feedback for a review
   * @param {string} reviewId - ID of the review
   * @param {string} feedback - User feedback
   * @param {string} outcome - Outcome (accepted, partially_helpful, not_helpful)
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Recorded feedback
   */
  recordFeedback(reviewId, feedback, outcome, metadata = {}) {
    const feedbackEntry = {
      reviewId,
      feedback,
      outcome,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    this.feedbackLogs.push(feedbackEntry);
    this._saveFeedback();
    
    return feedbackEntry;
  }
  
  /**
   * Analyzes feedback to suggest prompt improvements
   * @returns {Object} - Analysis results
   */
  analyzeFeedback() {
    if (this.feedbackLogs.length === 0) {
      return {
        totalReviews: 0,
        acceptanceRate: 0,
        commonIssues: [],
        promptImprovements: []
      };
    }
    
    // Calculate basic stats
    const totalReviews = this.feedbackLogs.length;
    const accepted = this.feedbackLogs.filter(log => log.outcome === 'accepted').length;
    const partiallyHelpful = this.feedbackLogs.filter(log => log.outcome === 'partially_helpful').length;
    const notHelpful = this.feedbackLogs.filter(log => log.outcome === 'not_helpful').length;
    
    const acceptanceRate = accepted / totalReviews;
    
    // Extract common issues from feedback text
    const commonIssues = [];
    const keywords = {
      'false_positive': ['false positive', 'not an issue', 'incorrect'],
      'missed_bug': ['missed', 'didn\'t catch', 'overlooked'],
      'unclear': ['unclear', 'confusing', 'hard to understand'],
      'too_verbose': ['too verbose', 'too long', 'too detailed'],
      'too_brief': ['too brief', 'need more detail', 'not enough context']
    };
    
    for (const keyword in keywords) {
      let count = 0;
      for (const log of this.feedbackLogs) {
        if (log.feedback && keywords[keyword].some(k => log.feedback.toLowerCase().includes(k))) {
          count++;
        }
      }
      
      if (count > 0) {
        commonIssues.push({
          issue: keyword,
          count,
          percentage: (count / totalReviews) * 100
        });
      }
    }
    
    // Sort by count
    commonIssues.sort((a, b) => b.count - a.count);
    
    // Generate suggestions for prompt improvements
    const promptImprovements = [];
    
    if (commonIssues.find(i => i.issue === 'false_positive')) {
      promptImprovements.push('Be more careful in your analysis. Only report issues that are certain to be problems.');
    }
    
    if (commonIssues.find(i => i.issue === 'missed_bug')) {
      promptImprovements.push('Pay more attention to edge cases, error handling, and potential bugs in the code.');
    }
    
    if (commonIssues.find(i => i.issue === 'unclear')) {
      promptImprovements.push('Provide clearer explanations with concrete examples when possible.');
    }
    
    if (commonIssues.find(i => i.issue === 'too_verbose')) {
      promptImprovements.push('Be more concise in your feedback. Focus on the most important issues.');
    }
    
    if (commonIssues.find(i => i.issue === 'too_brief')) {
      promptImprovements.push('Provide more detailed explanations for complex issues.');
    }
    
    return {
      totalReviews,
      acceptanceRate,
      stats: {
        accepted,
        partiallyHelpful,
        notHelpful
      },
      commonIssues,
      promptImprovements
    };
  }
  
  /**
   * Gets examples of successful reviews for few-shot learning
   * @param {number} count - Number of examples to return
   * @returns {Array<string>} - Example reviews
   */
  getExemplars(count = 3) {
    // Get accepted reviews with feedback
    const acceptedReviews = this.feedbackLogs
      .filter(log => log.outcome === 'accepted' && log.metadata?.review)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Return the most recent ones
    return acceptedReviews.slice(0, count).map(log => log.metadata.review);
  }
  
  /**
   * Gets the latest prompt improvements
   * @returns {Array<string>} - Prompt improvements
   */
  getPromptImprovements() {
    const analysis = this.analyzeFeedback();
    return analysis.promptImprovements;
  }
}

module.exports = FeedbackSystem;