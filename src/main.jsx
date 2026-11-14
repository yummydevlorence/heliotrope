import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './pages/floatingnav.css'
import { playOpening, installGlobalSounds } from './Sfx.js'
import App from './App.jsx'

playOpening()
installGlobalSounds()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)