import { CollectionBeforeChangeHook } from 'payload'

const GUIDED_PROMPTS: Record<string, string[]> = {
  pre_market_note: [
    'How ready am I today? Is my mind set right?',
    'What is my sense of the market environment? What am I watching?',
    'What is my game plan if the market does the opposite of what I expect?',
    'What is my maximum risk for today?',
  ],
  post_market_reflection: [
    'What trades did I take and why?',
    'What decision was I most proud of? What are 1-3 things I did well today?',
    'What would I do differently if I could replay today? What are 1-3 things I didn\'t do well?',
    'What is the one thing I need to improve most?',
  ],
  mistake_review: [
    'What was the mistake?',
    'What was I feeling when I made it?',
    'What rule did it violate?',
    'What is the specific trigger that led to this mistake?',
    'What will I do differently next time?',
  ],
  trigger_review: [
    'What was the emotional trigger?',
    'What situation caused it?',
    'How did I react?',
    'What was the outcome of my reaction?',
    'What is a healthier response I can practice?',
  ],
  weekly_review: [
    'What were my best decisions this week?',
    'What patterns do I notice in my behavior?',
    'Did I follow my trading rules consistently?',
    'What emotional traps did I fall into most?',
    'What is my #1 focus for next week?',
  ],
  rule_violation_review: [
    'Which rule did I violate?',
    'What was the context (market, personal state)?',
    'What was I thinking/feeling at the moment?',
    'What was the financial impact?',
    'How will I prevent this from happening again?',
  ],
}

/**
 * Auto-fills guided prompts based on entry type on create.
 */
export const populateJournalPrompts: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation !== 'create') return data

  const entryType = data.entryType
  if (!entryType || !GUIDED_PROMPTS[entryType]) return data

  // Only populate if guidedPrompts is empty or not set
  if (!data.guidedPrompts || data.guidedPrompts.length === 0) {
    data.guidedPrompts = GUIDED_PROMPTS[entryType].map((prompt) => ({
      prompt,
      response: '',
    }))
  }

  return data
}
