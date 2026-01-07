#!/usr/bin/env node

import { readdir, readFile, open } from "fs/promises";
import path, { extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

const DIR_IGNORE_SET = new Set(["node_modules", "dist", "assets", "logs", ".idea", ".vscode", ".git"]);

const FILE_NAME_IGNORE = new Set([".DS_Store", ".env.local", "synthos_config.json"]);

/**
 * 将路径转为 posix 形式，方便模式匹配
 */
function toPosix(p) {
    return p.split(path.sep).join("/");
}

/**
 * 判断是否应跳过当前路径（目录或文件）
 */
function isIgnored(relPath, isDirectory) {
    const parts = relPath.split("/");

    // 路径级别忽略：若任一片段在忽略目录集合中，直接跳过
    if (parts.some(p => DIR_IGNORE_SET.has(p))) {
        return true;
    }

    const base = parts[parts.length - 1] ?? "";

    // 目录层面的忽略
    if (isDirectory) {
        return false;
    }

    // 文件名直接匹配
    if (FILE_NAME_IGNORE.has(base)) {
        return true;
    }

    // .env.*.local
    if (/^\.env\..*\.local$/i.test(base)) {
        return true;
    }

    // 调试日志
    if (/^(npm|yarn|pnpm)-debug\.log/i.test(base)) {
        return true;
    }

    // package-lock / pnpm-lock / yarn-lock 相关的 json / yaml
    if (/(package[-_]lock|pnpm-lock|yarn-lock)\.(json|ya?ml)$/i.test(base)) {
        return true;
    }

    // 常见 IDE / 构建产物
    if (
        /\.suo$/i.test(base) ||
        /\.ntvs/i.test(base) ||
        /\.njsproj$/i.test(base) ||
        /\.sln$/i.test(base) ||
        /\.sw.$/i.test(base) ||
        /\.tsbuildinfo$/i.test(base)
    ) {
        return true;
    }

    return false;
}

/**
 * 简单的二进制文件检测：扫描头 8KB，存在 \0 或控制字符比例过高则视为二进制
 */
async function isLikelyBinary(filePath) {
    let handle;
    try {
        handle = await open(filePath, "r");
        const buffer = Buffer.alloc(8192);
        const { bytesRead } = await handle.read({ buffer, position: 0 });
        if (bytesRead === 0) return false;

        let controlChars = 0;
        for (let i = 0; i < bytesRead; i++) {
            const byte = buffer[i];
            if (byte === 0) return true; // NUL 直接视为二进制
            const isControl = byte < 7 || (byte > 13 && byte < 32);
            if (isControl) controlChars++;
        }

        const ratio = controlChars / bytesRead;
        return ratio > 0.3;
    } catch (err) {
        console.warn(`⚠️ 无法检测文件是否为二进制，已跳过: ${filePath}`);
        return true;
    } finally {
        await handle?.close();
    }
}

/**
 * 计算文件行数（保留空行）
 */
async function countLines(filePath) {
    try {
        const content = await readFile(filePath, "utf8");
        if (content === "") return 0;
        return content.split("\n").length;
    } catch (err) {
        console.warn(`⚠️ 读取文件失败，已跳过: ${filePath}`);
        return 0;
    }
}

/**
 * 按目录/包分组：applications/<name>，否则取顶级目录；根目录文件归入 root
 */
function getPackageKey(relPath) {
    const parts = relPath.split("/");
    if (parts.length === 1) {
        return "root";
    }
    if (parts[0] === "applications" && parts[1]) {
        return `applications/${parts[1]}`;
    }
    if (parts[0]) {
        return parts[0];
    }
    return "root";
}

/**
 * 深度优先遍历并统计
 */
async function walk(dir, accumulators) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = toPosix(path.relative(ROOT_DIR, fullPath));

        if (entry.isSymbolicLink()) continue;

        if (entry.isDirectory()) {
            if (isIgnored(relPath, true)) continue;
            await walk(fullPath, accumulators);
            continue;
        }

        if (!entry.isFile()) continue;
        if (isIgnored(relPath, false)) continue;
        if (await isLikelyBinary(fullPath)) continue;

        const lines = await countLines(fullPath);
        if (lines === 0) continue;

        const pkgKey = getPackageKey(relPath);
        const ext = extname(entry.name) || "<no-ext>";

        accumulators.total += lines;
        accumulators.package.set(pkgKey, (accumulators.package.get(pkgKey) ?? 0) + lines);
        accumulators.extension.set(ext, (accumulators.extension.get(ext) ?? 0) + lines);
    }
}

async function main() {
    const accumulators = {
        total: 0,
        package: new Map(),
        extension: new Map()
    };

    await walk(ROOT_DIR, accumulators);

    console.log(`📊 总行数: ${accumulators.total}`);

    const sortedPackages = [...accumulators.package.entries()].sort((a, b) => b[1] - a[1]);
    console.log("\n📁 按目录/包:");
    for (const [key, value] of sortedPackages) {
        console.log(`- ${key}: ${value}`);
    }

    const sortedExts = [...accumulators.extension.entries()].sort((a, b) => b[1] - a[1]);
    console.log("\n📝 按扩展名:");
    for (const [key, value] of sortedExts) {
        console.log(`- ${key}: ${value}`);
    }
}

main().catch(err => {
    console.error("❌ 统计行数失败:", err);
    process.exit(1);
});
