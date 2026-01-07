import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './geek.css'
import './index.css' // Keep for tailwind basics if needed, but geek.css overrides body
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
