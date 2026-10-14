import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.getElementById('racine')
if (!root) throw new Error('Élément #racine introuvable')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
