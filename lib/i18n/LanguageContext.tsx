'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { translations, Language, TranslationKey } from './translations'

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('zerf-language') as Language | null
      if (saved && saved in translations) setLanguageState(saved)
    } catch {}
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    try { localStorage.setItem('zerf-language', lang) } catch {}
  }, [])

  const t = useCallback((key: TranslationKey): string => {
    return (translations[language][key] as string) ?? (translations.en[key] as string) ?? key
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
