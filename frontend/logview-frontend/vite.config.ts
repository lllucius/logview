import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load frontend configuration at build time
function loadFrontendConfig() {
  try {
    // Try to load from project root frontend-config.json first
    const rootConfigPath = join(__dirname, '../../frontend-config.json')
    const configContent = readFileSync(rootConfigPath, 'utf-8')
    return JSON.parse(configContent)
  } catch (error) {
    console.warn('Could not load frontend-config.json, using default configuration')
    // Return default configuration
    return {
      frontend: {
        host: 'localhost',
        port: 3000
      },
      servers: [
        {
          id: 'default',
          name: 'Local Server',
          host: 'localhost',
          port: 8000
        }
      ]
    }
  }
}

const frontendConfig = loadFrontendConfig()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  define: {
    global: 'globalThis',
    // Inject configuration at build time
    __FRONTEND_CONFIG__: JSON.stringify(frontendConfig),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})