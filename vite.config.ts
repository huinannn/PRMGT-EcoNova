import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function assetAssetResolver() {
  return {
    name: 'asset-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('asset:asset/')) {
        const filename = id.replace('asset:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  server: {
    port: 3000,
    allowedHosts: ['.ngrok-free.app'],
  },
  plugins: [
    assetAssetResolver(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
})
