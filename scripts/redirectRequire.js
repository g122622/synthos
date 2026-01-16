// 脚本描述：构建结束后将类似 require("@root/common/util/Logger") 的语句路径替换为 require("../../../common/dist/util/Logger")
import Logger from "./Logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

Logger.info("[Redirect] 🧐 开始处理");

// 工具函数：递归遍历指定目录下的所有文件
function traverseDirectory(basePath, callback) {
    fs.readdirSync(basePath).forEach(file => {
        const filePath = `${basePath}/${file}`;
        if (fs.statSync(filePath).isDirectory()) {
            traverseDirectory(filePath, callback);
        } else {
            callback(filePath);
        }
    });
}

// 扫描 ../applications/下的所有文件夹
const appsDir = path.join(__dirname, "../applications/");
const applications = fs.readdirSync(appsDir);

// 遍历每个文件夹
applications.forEach(app => {
    if ([".DS_Store", "thumbs.db"].includes(app)) return;
    const appDir = `${appsDir}${app}/`;
    Logger.debug(`[Redirect] 开始处理：${appDir}`);
    const files = fs.readdirSync(appDir);
    if (files.includes("dist")) {
        const distDir = `${appDir}dist`;
        traverseDirectory(distDir, filePath => {
            if (filePath.endsWith(".js")) {
                const content = fs.readFileSync(filePath, "utf8");
                let newContent = content;

                newContent = content.replace(/(['"])(@root\/common[^'"]*)\1/g, (match, quote, p1) => {
                    // 提取路径核心部分（去掉 @root/common/ 前缀）
                    const pathPart = p1.replace(/^@root\/common\//, "");
                    const projectRoot = path.join(__dirname, "..");
                    const targetPath = path.join(projectRoot, "common/dist", pathPart); // 修正：这里直接用 'common' 而不是 'common/dist'

                    // 计算相对路径（关键优化：避免重复拼接 common/dist）
                    const relativePath = path.relative(path.dirname(filePath), targetPath);
                    const posixRelativePath = relativePath.split(path.sep).join("/");

                    Logger.debug(
                        `[Redirect] 文件路径：${filePath}，匹配到的路径：${p1}，替换为：${posixRelativePath}`
                    );
                    return `${quote}${posixRelativePath}${quote}`;
                });

                // todo 新增对 "@/" 路径的处理 替换类似 require("@/util/Logger") 的语句，将其指向当前monorepo子项目的 dist 目录下的对应路径 例如 applications\ai-model\dist

                if (content !== newContent) {
                    fs.writeFileSync(filePath, newContent, "utf8");
                    Logger.debug(`[Redirect] 文件路径：${filePath} 写回成功`);
                }
            }
        });
    }
});

Logger.success("[Redirect] 🥳🥳🥳 处理完成!");
