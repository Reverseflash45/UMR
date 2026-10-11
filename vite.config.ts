import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages menyajikan situs di /UMR/; set BASE=/ untuk hosting di akar domain.
  base: process.env.BASE ?? "/",
  build: {
    rollupOptions: {
      input: {
        utama: resolve(import.meta.dirname, "index.html"),
        metode: resolve(import.meta.dirname, "metode.html"),
      },
    },
  },
});
