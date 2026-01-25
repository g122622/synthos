import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tsconfigPaths(), tailwindcss()],
    server: {
        allowedHosts: ["intimiste-patriotically-addyson.ngrok-free.dev"],
        proxy: {
            // SSE 长连接：禁用超时，避免首 token 慢或长时间无事件导致 504
            "/api/agent/ask/stream": {
                target: "http://localhost:3002",
                changeOrigin: true,
                secure: false,
                timeout: 0,
                proxyTimeout: 0
            },
            "/api": {
                target: "http://localhost:3002",
                changeOrigin: true,
                secure: false // 忽略 HTTPS 证书验证（开发用）
            },
            "/health": {
                target: "http://localhost:3002",
                changeOrigin: true,
                secure: false // 忽略 HTTPS 证书验证（开发用）
            },
            // tRPC WebSocket (subscriptions)
            "/trpc": {
                target: "http://localhost:3002",
                ws: true,
                changeOrigin: true,
                secure: false
            }
        }
    }
});
