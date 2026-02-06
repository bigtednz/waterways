import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "child_process";

function getBuildInfo() {
  const buildTime = new Date().toISOString();
  let gitSha = "";
  try {
    gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    gitSha = "dev";
  }
  return { buildTime, gitSha };
}

const { buildTime, gitSha } = getBuildInfo();

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
    __GIT_SHA__: JSON.stringify(gitSha),
  },
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
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
