import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// iOS ignores maximum-scale for pinch zoom; Safari's gesture events are the page-zoom gesture itself
// (the maps zoom from touch events, so they keep working).
for (const type of ['gesturestart', 'gesturechange'] as const) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false })
}

const container = document.getElementById('root')
if (!container) throw new Error('#root element is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
