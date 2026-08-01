import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En local : http://localhost:4000 (défaut)
// En Docker : http://server:4000 (nom du service défini dans docker-compose.yml)
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:4000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // nécessaire pour être accessible depuis l'extérieur du conteneur Docker
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
