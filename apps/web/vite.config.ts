import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@waterways/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  optimizeDeps: {
    include: ["@waterways/shared"],
    esbuildOptions: {
      resolveExtensions: [".ts", ".tsx", ".js", ".jsx"],
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
