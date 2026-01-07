// scripts/fixESMExtensions.mjs
import { readdir, readFile, writeFile, stat } from "fs/promises";
import { join } from "path";
import { parse } from "acorn";
import { walk } from "estree-walker";
import MagicString from "magic-string";

const DIST_DIR = "./dist";
const COMMON_DIR = "../../common/dist";

function hasExtension(path) {
    return /\.\w+$/.test(path);
}

function isRelativePath(path) {
    return path.startsWith(".");
}

async function fixImportsInFile(filePath) {
    const code = await readFile(filePath, "utf8");
    let updated = false;

    // 使用 Acorn 解析为 ESTree AST（支持 ESM）
    let ast;
    try {
        ast = parse(code, {
            sourceType: "module",
            ecmaVersion: "latest"
        });
    } catch (err) {
        console.warn(`⚠️ Skipping ${filePath}: failed to parse as ESM`);
        return;
    }

    const magic = new MagicString(code);

    // 遍历 AST
    walk(ast, {
        enter(node) {
            // 处理 import ... from '...'
            if (node.type === "ImportDeclaration") {
                const source = node.source;
                let value = source.value;
                if (isRelativePath(value) && !hasExtension(value)) {
                    const newValue = value + ".js";
                    magic.overwrite(source.start, source.end, JSON.stringify(newValue));
                    updated = true;
                }
            }
            // 处理 export ... from '...'
            else if (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") {
                if (node.source) {
                    const source = node.source;
                    let value = source.value;
                    if (isRelativePath(value) && !hasExtension(value)) {
                        const newValue = value + ".js";
                        magic.overwrite(source.start, source.end, JSON.stringify(newValue));
                        updated = true;
                    }
                }
            }
        }
    });

    if (updated) {
        const result = magic.toString();
        await writeFile(filePath, result, "utf8");
        // console.log(`🔧 Patched imports in ${filePath}`);
    }
}

async function walkDir(dir) {
    const files = await readdir(dir);
    for (const file of files) {
        const fullPath = join(dir, file);
        const stats = await stat(fullPath);
        if (file.endsWith(".js") && stats.isFile()) {
            await fixImportsInFile(fullPath);
        } else if (stats.isDirectory()) {
            await walkDir(fullPath);
        }
    }
}

await walkDir(DIST_DIR);
await walkDir(COMMON_DIR);
console.log("✅ ESM import extensions fixed using AST");
