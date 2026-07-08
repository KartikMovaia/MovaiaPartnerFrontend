import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@apps': path.resolve(__dirname, './apps'),
    },
  },
  server: {
    port: 5174, // distinct from Movaia's 5173 so both can run locally
    // Same-origin API in dev: forward /api to the backend. Auth is Bearer-token
    // (no cookies), so this is just for convenience / avoiding CORS.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
