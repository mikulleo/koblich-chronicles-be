import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

interface EvaluationConfig {
  model: string
  maxTokens: number
  temperature: number
}

interface EvaluationResult {
  content: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * Generates a mindset evaluation using Claude API.
 */
export async function generateMindsetEvaluation(
  systemPrompt: string,
  userPrompt: string,
  config: EvaluationConfig,
): Promise<EvaluationResult> {
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  })

  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in Claude API response')
  }

  return {
    content: textContent.text,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  }
}
