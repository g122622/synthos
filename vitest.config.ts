// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@root": path.resolve(__dirname, "./")
        }
    },
    test: {
        testTimeout: 99999 * 1000,
        exclude: [
            "**/node_modules/**",
            "**/dist/**", // ← 排除 dist
            "**/build/**",
            "**/.{git,cache,output,temp}/**"
        ]
    }
});
