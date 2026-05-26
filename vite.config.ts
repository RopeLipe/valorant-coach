import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Copies Overwolf packaging assets (manifest + icons) into the build output
// so `dist/` is a self-contained OPK root that ow-cli can pack directly.
function overwolfPackagePlugin(): Plugin {
  const assets = ['manifest.json', 'icon.png', 'icon_gray.png', 'desktop-icon.ico'];
  return {
    name: 'overwolf-package',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      for (const file of assets) {
        const src = path.resolve(__dirname, file);
        if (!fs.existsSync(src)) {
          this.warn(`overwolf-package: missing asset ${file}`);
          continue;
        }
        fs.copyFileSync(src, path.resolve(outDir, file));
      }
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), overwolfPackagePlugin()],
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
        emptyOutDir: true,
        rollupOptions: {
          input: {
            admin: path.resolve(__dirname, 'admin.html'),
            background: path.resolve(__dirname, 'background.html'),
            desktop: path.resolve(__dirname, 'desktop.html'),
            overlay: path.resolve(__dirname, 'overlay.html')
          },
          output: {
            // Overwolf's unpacked-app loader can keep window HTML/state around
            // between launches. Hashed Vite filenames break that flow: a rebuild
            // deletes the old hash, then a cached window tries to load a missing
            // ./assets/desktop-abc123.js and the app appears not to open.
            // Stable names make dist/ safe to reload repeatedly in OWNED/OW dev.
            entryFileNames: 'assets/[name].js',
            chunkFileNames: 'assets/[name].js',
            assetFileNames: 'assets/[name][extname]',
          }
        }
      }
    };
  });
