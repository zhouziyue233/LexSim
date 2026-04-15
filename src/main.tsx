import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LLMConfigProvider } from './contexts/LLMConfigContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LLMConfigProvider>
      <App />
    </LLMConfigProvider>
  </StrictMode>,
)
