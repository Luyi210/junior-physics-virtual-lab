import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative assets work both at localhost / and at GitHub Pages /repository-name/.
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    target: "es2022",
    // Public builds do not ship source maps. This keeps deployment artifacts
    // small and avoids publishing readable application sources by default.
    sourcemap: false,
    chunkSizeWarningLimit: 760,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("vite/preload-helper") >= 0) return "app-runtime";
          // Keep the application runtime independent from the optional 3D
          // stack. Without this explicit boundary Rollup can place React in a
          // react-three chunk, which makes the homepage preload all of Three.
          if (
            id.indexOf("/node_modules/react/") >= 0 ||
            id.indexOf("/node_modules/react-dom/") >= 0 ||
            id.indexOf("/node_modules/scheduler/") >= 0
          ) return "react-core";
          if (id.indexOf("/node_modules/three/examples/") >= 0) return "three-extras";
          if (id.indexOf("/node_modules/three/") >= 0) return "three-core";
          if (id.indexOf("/node_modules/@react-three/fiber/") >= 0) return "react-three-fiber";
          if (id.indexOf("/node_modules/@react-three/drei/") >= 0) return "react-three-drei";
        }
      }
    }
  }
});
