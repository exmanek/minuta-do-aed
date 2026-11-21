import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 127.0.0.1 zamiast localhost: na macOS localhost:5000 przejmuje AirPlay Receiver.
const api = `http://127.0.0.1:${process.env.API_PORT || 5000}`

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': api } },
})
