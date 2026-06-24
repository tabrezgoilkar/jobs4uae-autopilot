import { createGeminiEngine } from './gemini.js';
import { createByoKeyEngine } from './byok.js';
import { createOllamaEngine } from './ollama.js';

export function createEngine(config) {
  switch (config?.engine) {
    case 'gemini':
      return createGeminiEngine(config.gemini ?? {});
    case 'openrouter': {
      // OpenRouter with free-model auto-rotation: the byok engine discovers and
      // rotates working :free models when baseUrl is OpenRouter and model='auto'.
      const or = config.openrouter ?? {};
      return createByoKeyEngine({
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: or.apiKey ?? '',
        model: or.model || 'auto',
      });
    }
    case 'byok':
      return createByoKeyEngine(config.byok ?? {});
    case 'ollama':
      return createOllamaEngine(config.ollama ?? {});
    default:
      throw new Error(`Unknown or unset AI engine: ${config?.engine}`);
  }
}
