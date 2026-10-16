import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => mode === 'library'
  ? {
      build: {
        lib: {
          entry: resolve(import.meta.dirname, 'src/index.ts'),
          formats: ['es'],
          fileName: 'index',
        },
        rollupOptions: {
          external: (id) => id === 'lit' || id.startsWith('lit/') || id === 'ol' || id.startsWith('ol/'),
        },
      },
    }
  : {
      root: resolve(import.meta.dirname, 'examples/basic'),
      server: { host: '127.0.0.1' },
    });
