import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const apiPort = loadEnv(mode, process.cwd(), '').API_PORT || '8788';
  return {
    plugins: [react()],
    server: {
      port: 5180,
      strictPort: true,
      proxy: { '/api': `http://localhost:${apiPort}` },
    },
  };
});
