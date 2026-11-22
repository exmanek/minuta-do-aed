import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AccessibilityProvider } from './a11y/AccessibilityContext.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { SchemaProvider } from './auth/SchemaContext.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AccessibilityProvider>
        <AuthProvider>
          <SchemaProvider>
            <App />
          </SchemaProvider>
        </AuthProvider>
      </AccessibilityProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
