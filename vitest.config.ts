// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
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
