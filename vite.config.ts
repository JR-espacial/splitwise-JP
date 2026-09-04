/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/boyo-*.png'],
      manifest: {
        name: 'Europa 2026',
        short_name: 'Roadtrip',
        description: 'Gastos compartidos del roadtrip',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8f9ff',
        theme_color: '#f8f9ff',
        icons: [
          { src: '/icons/boyo-beige-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/boyo-beige-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
