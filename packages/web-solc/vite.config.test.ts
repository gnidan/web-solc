import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "tests/integration"),
  server: {
    port: 0, // Use any available port
  },
  resolve: {
    alias: {
      "/dist": resolve(__dirname, "dist"),
    },
  },
});
