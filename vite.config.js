import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // Relativ sti ('./') gjør at alle JS/CSS-lenker fungerer uansett repository-navn på GitHub Pages
  base: './',
  build: {
    // Bygger produksjonsfilene til 'docs/' for direkte publisering via GitHub Pages
    outDir: 'docs',
    emptyOutDir: true
  }
});
