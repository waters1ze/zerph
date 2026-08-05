// Zerf AI Configuration
// Keys are loaded from environment variables (.env.local)
// For local dev: add GROQ_API_KEY to .env.local
// For production: set as environment variable on your server

export const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
export const GROQ_CHAT_MODEL = 'openai/gpt-oss-120b'
export const GROQ_WHISPER_MODEL = 'whisper-large-v3'
export const APP_VERSION = '1.0.0'
