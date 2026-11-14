/**
 * Optional integrated-AI architecture. SlideCraft works fully without it (Code Import);
 * providers become available when their API key is configured server-side (never in the frontend).
 */
export type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'openrouter';
export interface AiProvider { id: AiProviderId; label: string; envKey: string; configured: boolean }
export const AI_TASKS = ['generatePresentation', 'rewrite', 'improveSlide', 'imagePrompt', 'suggestLayout', 'generateChart', 'summarize', 'translate', 'expand', 'speakerNotes', 'quiz', 'alternativeDesign'] as const;

const DEFS: { id: AiProviderId; label: string; envKey: string }[] = [
  { id: 'openai', label: 'OpenAI', envKey: 'OPENAI_API_KEY' },
  { id: 'anthropic', label: 'Anthropic', envKey: 'ANTHROPIC_API_KEY' },
  { id: 'gemini', label: 'Google Gemini', envKey: 'GEMINI_API_KEY' },
  { id: 'deepseek', label: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY' },
  { id: 'openrouter', label: 'OpenRouter', envKey: 'OPENROUTER_API_KEY' },
];
export function aiProviders(): AiProvider[] {
  return DEFS.map((d) => ({ ...d, configured: !!process.env[d.envKey] }));
}
