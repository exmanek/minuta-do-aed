import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { SchemaProvider } from './auth/SchemaContext.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SchemaProvider>
          <App />
        </SchemaProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
