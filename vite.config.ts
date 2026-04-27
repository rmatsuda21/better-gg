import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { authProxyPlugin } from './src/server/auth-proxy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    authProxyPlugin(),
    TanStackRouterVite({
      quoteStyle: 'single',
      autoCodeSplitting: true,
      codeSplittingOptions: {
        // Keep pendingComponent in the critical path (loads instantly during navigation).
        // Only split component/errorComponent/notFoundComponent into lazy chunks.
        defaultBehavior: [['component'], ['errorComponent'], ['notFoundComponent']],
      },
    }),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/@tanstack/react-router/') || id.includes('node_modules/@tanstack/router-core/')) {
            return 'vendor-router'
          }
          if (id.includes('node_modules/@tanstack/react-query/') || id.includes('node_modules/@tanstack/query-core/')) {
            return 'vendor-query'
          }
          if (id.includes('node_modules/graphql/') || id.includes('node_modules/graphql-request/')) {
            return 'vendor-graphql'
          }
        },
      },
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api/image-proxy': {
        target: 'https://images.start.gg',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/image-proxy/, ''),
      },
    },
  },
})
