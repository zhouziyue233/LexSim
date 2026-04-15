import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { LLMConfig } from '@shared/types'
import { DEFAULT_LLM_CONFIG } from '@shared/constants'
import { getConfig, saveConfig } from '../lib/api'

interface LLMConfigContextValue {
  config: LLMConfig
  hasKey: boolean
  save: (config: LLMConfig) => Promise<void>
}

const LLMConfigContext = createContext<LLMConfigContextValue | null>(null)

export function LLMConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG)
  const [hasKey, setHasKey] = useState(false)

  useEffect(() => {
    getConfig()
      .then(data => {
        setConfig(current => ({
          ...current,
          apiBase: data.apiBase,
          model: data.model,
        }))
        setHasKey(data.hasKey)
      })
      .catch(() => {
        // Backend may not be ready yet; keep defaults.
      })
  }, [])

  const value = useMemo<LLMConfigContextValue>(() => ({
    config,
    hasKey,
    async save(nextConfig: LLMConfig) {
      await saveConfig(nextConfig)
      setConfig(nextConfig)
      setHasKey(nextConfig.apiKey.trim().length > 0)
    },
  }), [config, hasKey])

  return (
    <LLMConfigContext.Provider value={value}>
      {children}
    </LLMConfigContext.Provider>
  )
}

export function useLLMConfig() {
  const value = useContext(LLMConfigContext)
  if (!value) {
    throw new Error('useLLMConfig must be used within LLMConfigProvider')
  }
  return value
}
