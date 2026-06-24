import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "/",
  test: {
    environment: "jsdom",
  },
  build: {
    // 输出到 web_v2/static/，供 FastAPI StaticFiles 服务
    outDir: "../static",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
      },
    },
  },
  server: {
    port: 5173,
    // 开发期把 /api 代理到后端 FastAPI
    proxy: {
      "/api": "http://localhost:7860",
    },
  },
});
