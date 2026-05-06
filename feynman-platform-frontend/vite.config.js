import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

// 使用相对基路径，确保 Electron 打包后以 file:// 协议加载资源不白屏
export default defineConfig(({ mode }) => {
  // 默认关闭 PWA，避免 Service Worker 缓存导致的白屏问题。
  // 只有在显式设置 VITE_ENABLE_PWA=true 且为生产模式时才启用。
  const enablePwa = mode === 'production' && process.env.VITE_ENABLE_PWA === 'true'
  return {
  base: mode === 'production' ? './' : '/',
  plugins: [
    react(),
    enablePwa && VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: '费曼学习平台',
        short_name: '费曼平台',
        description: '一个基于AI的个性化学习平台',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 // 5MB
      }
    })
  ].filter(Boolean),
  }
})
