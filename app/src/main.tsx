import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../packages/ui/ui.css'
import { App } from '../../packages/ui/shell/App.tsx'
import { TOOLS } from './tools.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App tools={TOOLS} />
  </StrictMode>,
)
