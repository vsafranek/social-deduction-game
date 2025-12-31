import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // ✅ DŮLEŽITÉ - umožní přístup z jiných zařízení
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
