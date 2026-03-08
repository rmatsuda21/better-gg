import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { authProxyPlugin } from './src/server/auth-proxy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    authProxyPlugin(),
    TanStackRouterVite({ quoteStyle: 'single' }),
    react(),
  ],
  server: {
    port: 5175,
  },
})
