import { isActionJournalUser } from '../utilities/actionJournal'
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
  coaching_session_summary: [
    'What landed in the session?',
    'What am I working on?',
    'What did I commit to?',
  ],
  // Gratitude practice, drawn from Robert Emmons (Thanks!: specific beats
  // general, people beat things), Martin Seligman's "Three Good Things"
  // (Flourish: name it *and* why it happened), The Five Minute Journal, the
  // Stoic "obstacle is the way" reframe and mental subtraction.
  // Keep in sync with the FE copy in journal-entry-form.tsx.
  gratitude: [
    '3 things I am grateful for today (be specific, not general)',
    'A person I am grateful for: what did they do, and what difference did it make?',
    '3 good things that happened, and why did each one happen? What was my part in it?',
    'A setback, loss or mistake I can be grateful for: what is it teaching me?',
    'Something I usually take for granted: what would my life or trading look like without it?',
  ],
  rule_violation_review: [
    'Which rule did I violate?',
    'What was the context (market, personal state)?',
    'What was I thinking/feeling at the moment?',
    'What was the financial impact?',
    'How will I prevent this from happening again?',
  ],
}

// 3-3-1 Action Journal wording for Action Journal users (see utilities/actionJournal.ts).
// Must match the prompt labels the FE writes, so mirrored entries look the same.
const ACTION_JOURNAL_PROMPTS: Record<string, string[]> = {
  post_market_reflection: [
    '3 Things I Did Well',
    '3 Things for Improvement',
    '1 Action Step Forward',
    'Market & week context',
  ],
}

/**
 * Auto-fills guided prompts based on entry type on create.
 */
export const populateJournalPrompts: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation !== 'create') return data

  const entryType = data.entryType
  const prompts =
    (isActionJournalUser(req.user) && ACTION_JOURNAL_PROMPTS[entryType]) || GUIDED_PROMPTS[entryType]
  if (!entryType || !prompts) return data

  // Only populate if guidedPrompts is empty or not set
  if (!data.guidedPrompts || data.guidedPrompts.length === 0) {
    data.guidedPrompts = prompts.map((prompt) => ({
      prompt,
      response: '',
    }))
  }

  return data
}
