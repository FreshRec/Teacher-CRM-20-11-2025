import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // Порт по умолчанию (5173), чтобы не конфликтовать с бэкендом (3000)
    strictPort: false,
    host: true,
  }
})
