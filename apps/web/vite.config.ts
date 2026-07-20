import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const localServerUrl =
  process.env.AIW_LOCAL_SERVER_URL ?? "http://127.0.0.1:3770";
const presentationOrigin =
  process.env.AIW_PRESENTATION_PROXY_ORIGIN ?? "http://127.0.0.1:5173";
const presentationHost =
  process.env.AIW_PRESENTATION_PROXY_HOST ?? "127.0.0.1:5173";
const presentationHeaders = {
  origin: presentationOrigin,
  host: presentationHost,
};

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
        ws: true,
        headers: presentationHeaders,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: localServerUrl,
        changeOrigin: false,
        ws: true,
        headers: presentationHeaders,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
