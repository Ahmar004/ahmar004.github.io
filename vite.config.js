import { defineConfig } from 'vite';

// Relative base so the same build works on a GitHub Pages user site
// (ahmar004.github.io), a project site (/portfolio/), or Vercel.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          physics: ['cannon-es'],
        },
      },
    },
  },
});
