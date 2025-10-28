import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.js')
        }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {}
      }
    }
  },
  renderer: {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0'
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        }
      }
    }
  }
});
