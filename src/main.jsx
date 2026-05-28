import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import './index.css'
import App from './App.jsx'
import { initSentry } from './observability/sentry.js'

initSentry();   // no-op unless VITE_SENTRY_DSN is set
inject();       // Vercel Analytics — no-op off-Vercel

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
