import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@code': path.resolve(__dirname, 'code'),
          '@ui': path.resolve(__dirname, 'code/components/ui'),
          '@/lib': path.resolve(__dirname, 'code/lib'),
          '@/components': path.resolve(__dirname, 'code/components'),
        }
      },
      build: {
        rollupOptions: {
          input: {
            admin: path.resolve(__dirname, 'admin.html'),
            background: path.resolve(__dirname, 'background.html'),
            desktop: path.resolve(__dirname, 'desktop.html'),
            overlay: path.resolve(__dirname, 'overlay.html')
          }
        }
      }
    };
  });
