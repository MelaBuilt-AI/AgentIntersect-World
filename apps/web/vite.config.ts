import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const localServerUrl =
  process.env.AIW_LOCAL_SERVER_URL ?? "http://127.0.0.1:3770";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: localServerUrl,
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: localServerUrl,
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
