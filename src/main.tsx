import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const root = document.getElementById("root")!

// Ensure dark is default
if (!document.documentElement.classList.contains('dark')) {
  document.documentElement.classList.add('dark')
}

createRoot(root).render(<App />);
