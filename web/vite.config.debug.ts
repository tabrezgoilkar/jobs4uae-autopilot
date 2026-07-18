import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// TEMP: unminified + sourcemaps for diagnosing the production TDZ crash.
export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': 'http://localhost:5123',
    },
  },
});
