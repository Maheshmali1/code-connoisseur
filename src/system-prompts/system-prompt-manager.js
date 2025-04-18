import {MEAN_MERN_STACK_REVIEW_PROMPT} from "./js-ts-stack-review-prompt";
import {JAVA_STACK_REVIEW_PROMPT} from "./java-review-prompt";
import {BASE_SYSTEM_PROMPT} from "./base-system-prompt";
import {PYTHON_STACK_REVIEW_PROMPT} from "./python-review-prompt";

export function getSystemPrompt(stack) {
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

