import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Language = 'zh' | 'en'

interface LanguageContextValue {
  lang: Language
  toggle: () => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const STORAGE_KEY = 'lexsim-lang'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'en' ? 'en' : 'zh'
  })

  const toggle = useCallback(() => {
    setLang(prev => {
      const next: Language = prev === 'zh' ? 'en' : 'zh'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ lang, toggle }), [lang, toggle])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used within LanguageProvider')
  return value
}
