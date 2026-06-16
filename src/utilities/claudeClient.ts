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

// Opus 4.7+ and Fable models reject sampling params (temperature/top_p/top_k)
// with a 400. Only send `temperature` for models that still accept it (e.g. Sonnet 4.6).
const MODELS_WITHOUT_SAMPLING_PARAMS = new Set<string>([
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-fable-5',
])

/**
 * Generates a mindset evaluation using Claude API.
 */
export async function generateMindsetEvaluation(
  systemPrompt: string,
  userPrompt: string,
  config: EvaluationConfig,
  outputSchema?: Record<string, unknown>,
): Promise<EvaluationResult> {
  const anthropic = getClient()

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: config.model,
    max_tokens: config.maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  }

  if (!MODELS_WITHOUT_SAMPLING_PARAMS.has(config.model)) {
    params.temperature = config.temperature
  }

  // Structured outputs constrain the response to valid JSON matching the schema,
  // so we don't rely on the model formatting JSON correctly inside free text
  // (markdown fences, preamble, etc.).
  if (outputSchema) {
    params.output_config = {
      format: { type: 'json_schema', schema: outputSchema },
    }
  }

  const response = await anthropic.messages.create(params)

  // A truncated response yields incomplete (unparseable) JSON. Surface a clear,
  // actionable error rather than a downstream "Failed to parse AI response".
  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      `Claude response was truncated at max_tokens=${config.maxTokens}. Increase "Max Tokens" in Mindset Config.`,
    )
  }

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
