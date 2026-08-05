// Zerf AI Configuration
// Keys are loaded from environment variables on Railway
// Set GROQ_API_KEYS as comma-separated list in Railway dashboard

export const GROQ_API_KEYS: string[] = (
  process.env.GROQ_API_KEYS
    ? process.env.GROQ_API_KEYS.split(',').map((k: string) => k.trim()).filter(Boolean)
    : process.env.GROQ_API_KEY
      ? [process.env.GROQ_API_KEY]
      : []
)

export const GROQ_API_KEY = GROQ_API_KEYS[0] || process.env.GROQ_API_KEY || ''
export const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile'
export const GROQ_WHISPER_MODEL = 'whisper-large-v3'
export const APP_VERSION = '1.0.0'
