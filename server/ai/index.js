import { createGeminiEngine } from './gemini.js';
import { createByoKeyEngine } from './byok.js';
import { createOllamaEngine } from './ollama.js';

export function createEngine(config) {
  switch (config?.engine) {
    case 'gemini':
      return createGeminiEngine(config.gemini ?? {});
    case 'byok':
      return createByoKeyEngine(config.byok ?? {});
    case 'ollama':
      return createOllamaEngine(config.ollama ?? {});
    default:
      throw new Error(`Unknown or unset AI engine: ${config?.engine}`);
  }
}
