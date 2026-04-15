import { useLanguage } from '../contexts/LanguageContext'
import { t, type TranslationKey } from '../i18n/translations'

export function useT() {
  const { lang } = useLanguage()
  return (key: TranslationKey, vars?: Record<string, string | number>) =>
    t(key, lang, vars)
}
