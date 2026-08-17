// Zerf AI Configuration
// All keys MUST be set as environment variables on Railway (never hardcoded here).
// For local dev: add to .env.local file (which is git-ignored).

export const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
export const GROQ_CHAT_MODEL = 'openai/gpt-oss-120b'
export const GROQ_WHISPER_MODEL = 'whisper-large-v3'
export const APP_VERSION = '1.0.0'
