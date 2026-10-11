import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        utama: resolve(import.meta.dirname, "index.html"),
        metode: resolve(import.meta.dirname, "metode.html"),
      },
    },
  },
});
