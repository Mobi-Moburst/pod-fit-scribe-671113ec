import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const rootElement = document.getElementById("root")!

// Ensure dark is default
if (!document.documentElement.classList.contains('dark')) {
  document.documentElement.classList.add('dark')
}

// Only create root once to prevent HMR issues
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
