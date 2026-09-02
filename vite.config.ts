import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// CSP 仅在生产构建生效：dev 模式下 @vitejs/plugin-react 会注入内联脚本，
// script-src 'self' 会拦截它导致开发服务器不可用，因此 dev 时移除 CSP meta。
const removeCspInDev = (): Plugin => ({
  name: 'remove-csp-in-dev',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/?>/, '')
  },
})

export default defineConfig({
  plugins: [react(), removeCspInDev()],
  base: './',
  publicDir: 'public-build',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-lucide': ['lucide-react'],
        }
      }
    }
  }
})
