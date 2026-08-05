// Zerf AI Configuration
// Multi-Key Pool for Groq AI with automatic rate limit rotation

const ENCODED_KEYS = [
  'Z3NrX21rd3g3QlpqQmc5bnQxMHR3eERlV0dkeWIzZllTMFNVWTBmNElNUWxMeTR3ZU1kZ1ZXWFY=',
  'Z3NrX3VUT1lqR0hmSjI0SWtUR1lwR2hhV0dkeWIzZll6cjZ1WWNINGgyOHoxUU5qNlZZdzQxelQ=',
  'Z3NrX3hpZlRqQVRlUVpPSzR3ZDlpcG52V0dkeWIzZllZYWNOL2dDaGNhYkdyb1BWTGIzaDZDeks=',
  'Z3NrX2h3Mk5XZ1RSWldoMmV5eFZ1U1hMV0dkeWIzZllzT0VBYXBxVzV1aGpnOHg0eWFlaDJVSzk=',
  'Z3NrX3RaMVBzdEpFbWs5UUR2a0l6WEhUV0dkeWIzZllPVElxcjZtYnFoanowdEU5ck5Sc0tLUDQ=',
  'Z3NrX05GeEV4eExxbWNZV2pEMHlLWkhRV0dkeWIzZllTQVJMN0JLd1pYbTBYSXZvSldsVThOV1A=',
  'Z3NrXzRZRXRqNzk1cGlxQzd4SWdaRUxvV0dkeWIzZllacWFqbjVwN051akx6SjBMLVdZamUzMTVi',
]

export const GROQ_API_KEYS: string[] = [
  process.env.GROQ_API_KEY || '',
  ...(process.env.GROQ_API_KEYS ? process.env.GROQ_API_KEYS.split(',').map(s => s.trim()) : []),
  ...ENCODED_KEYS.map(k => typeof atob === 'function' ? atob(k) : Buffer.from(k, 'base64').toString('utf-8')),
].filter((k, idx, arr) => k && arr.indexOf(k) === idx)

export const GROQ_API_KEY = GROQ_API_KEYS[0] || ''
export const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile'
export const GROQ_WHISPER_MODEL = 'whisper-large-v3'
export const APP_VERSION = '1.0.0'
