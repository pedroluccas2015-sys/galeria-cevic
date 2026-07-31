import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Aumenta o limite de aviso de 500kb (padrão) para 1600kb
    chunkSizeWarningLimit: 1600,
  },
})