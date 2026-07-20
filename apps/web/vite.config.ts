import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 760,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("/node_modules/three/examples/") >= 0) return "three-extras";
          if (id.indexOf("/node_modules/three/") >= 0) return "three-core";
          if (id.indexOf("/node_modules/@react-three/fiber/") >= 0) return "react-three-fiber";
          if (id.indexOf("/node_modules/@react-three/drei/") >= 0) return "react-three-drei";
        }
      }
    }
  }
});
