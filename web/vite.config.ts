import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port sabit: eklentideki köprü (extension/bridge.js) bu adresi dinliyor.
// /api → "Kesit'e sor" sunucusu (server/index.mjs); API anahtarı orada durur.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
