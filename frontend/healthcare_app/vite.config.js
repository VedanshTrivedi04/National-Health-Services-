import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Add this allowedHosts array
    allowedHosts: [
      "41e25a38aece.ngrok-free.app"
    ],
    host: true,
  },
})
