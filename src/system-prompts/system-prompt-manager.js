const BASE_SYSTEM_PROMPT = require("./base-system-prompt");
const MEAN_MERN_STACK_REVIEW_PROMPT = require("./js-ts-stack-review-prompt");
const JAVA_STACK_REVIEW_PROMPT = require("./java-review-prompt");
const PYTHON_STACK_REVIEW_PROMPT = require("./python-review-prompt");

function getSystemPrompt(stack) {
    const systemPrompt = BASE_SYSTEM_PROMPT;
    switch (stack) {
        case 'MEAN/MERN':
            return systemPrompt + MEAN_MERN_STACK_REVIEW_PROMPT;
        case 'Java':
            return systemPrompt + JAVA_STACK_REVIEW_PROMPT;
        case 'Python':
            return systemPrompt + PYTHON_STACK_REVIEW_PROMPT;
        default:
            return BASE_SYSTEM_PROMPT;
    }
}

module.exports = {getSystemPrompt};