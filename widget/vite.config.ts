import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Library build: one self-contained file per format, React bundled in.
// widget.js  -> IIFE for <script> tags (exposes window.HMISWidget)
// widget.mjs -> ESM for `npm install` + `import { init } from ...`
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index.tsx',
      name: 'HMISWidget',
      formats: ['iife', 'es'],
      fileName: (format) => (format === 'iife' ? 'widget.js' : 'widget.mjs'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Process widget.css so the ?inline import returns real CSS in tests.
    css: { include: [/widget\.css/] },
  },
});
