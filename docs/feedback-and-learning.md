# Feedback System and Continuous Learning

This document explains how Code Connoisseur's feedback system works and how it enables continuous learning and improvement of code reviews over time.

## Overview

Code Connoisseur includes a sophisticated feedback system that:

1. Collects user feedback on code reviews
2. Analyzes feedback patterns to identify areas for improvement
3. Adjusts prompts based on feedback
4. Uses exemplars of well-received reviews for few-shot learning
5. Maintains a memory of past interactions for consistency

This feedback loop allows Code Connoisseur to continuously improve its code reviews based on user preferences and project-specific requirements.

## Feedback Collection

After each code review, Code Connoisseur prompts the user for feedback:

```
Do you have any feedback on this review? (optional)
Was this review helpful? [Accepted, Partially Helpful, Not Helpful]
```

This feedback is stored in `.code-connoisseur/feedback.json` with the following information:

- Review ID: A unique identifier for the review
- Feedback: The user's textual feedback
- Outcome: The user's assessment (accepted, partially_helpful, not_helpful)
- Metadata: Information about the review, including the file path and review content
- Timestamp: When the feedback was provided

## Feedback Analysis

Code Connoisseur analyzes the collected feedback to:

1. Identify common patterns in well-received reviews
2. Detect recurring issues in poorly-received reviews
3. Generate prompt improvements based on these patterns
4. Select exemplars (examples of good reviews) for few-shot learning

You can view the feedback analysis by running:

```bash
code-connoisseur feedback
```

This will show statistics about your feedback history and suggested improvements.

## Prompt Improvement

Based on feedback analysis, Code Connoisseur automatically adjusts its prompts to improve future reviews. For example:

- If users consistently mark reviews as "Not Helpful" when they lack code examples, the system might add a prompt improvement like "Include more concrete code examples in your reviews"
- If users prefer more concise reviews, the system might add "Be more concise and focus on critical issues"

These prompt improvements are added to the base system prompt when generating new reviews, guiding the LLM to produce more helpful feedback.

## Few-Shot Learning with Exemplars

Code Connoisseur uses exemplars (examples of well-received reviews) to improve future reviews through few-shot learning. When generating a new review, the system:

1. Selects a few exemplars from highly-rated past reviews
2. Includes these exemplars in the prompt to the LLM
3. Asks the LLM to follow a similar style and approach

This technique helps the LLM understand what constitutes a good review for your specific project and preferences.

## Conversation Memory

Code Connoisseur maintains a memory of past interactions using LangChain's `BufferMemory`. This allows the system to:

1. Remember previous reviews of the same file
2. Maintain consistency in feedback across multiple reviews
3. Avoid repeating the same suggestions
4. Build on previous discussions

The conversation memory is maintained per session and helps provide more contextual and relevant reviews.

## Implementation Details

### FeedbackSystem Class

The feedback system is implemented in `src/feedbackSystem.js` with the following key methods:

- `recordFeedback(reviewId, feedback, outcome, metadata)`: Records user feedback
- `analyzeFeedback()`: Analyzes feedback patterns
- `getPromptImprovements()`: Generates prompt improvements based on feedback
- `getExemplars()`: Selects exemplars for few-shot learning

### Integration with Agent

The `CodeReviewAgent` class in `src/agent.js` integrates with the feedback system:

1. It initializes the feedback system in its constructor
2. It retrieves prompt improvements and exemplars when building prompts
3. It logs feedback after each review
4. It maintains conversation memory for context

### Feedback Storage

Feedback is stored in a JSON file at `.code-connoisseur/feedback.json` with the following structure:

```json
{
  "reviews": [
    {
      "id": "1620145200000",
      "feedback": "Good review, but could use more examples",
      "outcome": "partially_helpful",
      "metadata": {
        "filePath": "src/components/Button.js",
        "review": "..."
      },
      "timestamp": "2023-05-04T12:00:00.000Z"
    },
    ...
  ]
}
```

## Best Practices for Providing Feedback

To get the most out of Code Connoisseur's feedback system:

1. **Be Specific**: Provide detailed feedback about what was helpful or unhelpful
2. **Be Consistent**: Use consistent criteria when evaluating reviews
3. **Provide Examples**: If possible, include examples of the kind of feedback you'd prefer
4. **Regular Feedback**: Provide feedback regularly to help the system learn your preferences
5. **Project-Specific Guidance**: Mention project-specific conventions or requirements

Example of good feedback:
> "The review was helpful, but I'd prefer more focus on performance issues and less on formatting. Our project prioritizes optimization over strict style adherence."

## Conclusion

Code Connoisseur's feedback system enables a continuous learning loop that improves code reviews over time. By providing regular feedback, you help the system adapt to your specific needs and preferences, resulting in more valuable and actionable code reviews.

The combination of prompt improvements, exemplars, and conversation memory creates a personalized code review experience that gets better with each interaction.