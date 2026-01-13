#!/usr/bin/env node

/**
 * Pre-commit 检查脚本
 * 执行以下步骤：
 * 1. 构建 common
 * 2. 在所有子项目中执行类型检查
 * 3. 如果涉及测试文件，运行测试
 * 4. 如果涉及前端页面，执行 eslint --fix
 * 5. 执行 prettier --write 格式化代码
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../..");

// 获取 staged 的文件列表
function getStagedFiles() {
    try {
        const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
            encoding: "utf-8",
            cwd: rootDir
        });
        return output
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0);
    } catch (error) {
        console.error("获取 staged 文件失败:", error.message);
        return [];
    }
}

// 获取已经更改但未stage的文件列表（工作区中已修改的已跟踪文件）
function getUnstagedFiles() {
    try {
        const output = execSync("git diff --name-only --diff-filter=ACM", {
            encoding: "utf-8",
            cwd: rootDir
        });
        return output
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0);
    } catch (error) {
        console.error("获取 unstaged 文件失败:", error.message);
        return [];
    }
}

// 检查是否涉及测试文件
function hasTestFiles(files) {
    return files.some(file => file.includes(".test.") || file.includes(".spec.") || file.includes("/test/"));
}

// 获取变更的测试文件列表
function getChangedTestFiles(files) {
    return files.filter(file => file.includes(".test.") || file.includes(".spec.") || file.includes("/test/"));
}

// 检查是否涉及前端文件
function hasFrontendFiles(files) {
    return files.some(file => file.startsWith("applications/webui-frontend/"));
}

// 执行命令并输出结果
function execCommand(command, cwd = rootDir, description) {
    console.log(`\n${description}...`);
    try {
        execSync(command, {
            cwd,
            stdio: "inherit",
            encoding: "utf-8"
        });
        console.log(`✓ ${description} 完成`);
        return true;
    } catch (error) {
        console.error(`✗ ${description} 失败`);
        return false;
    }
}

// 获取所有子项目目录
function getSubProjects() {
    const subProjects = [
        "applications/ai-model",
        "applications/data-provider",
        "applications/db-cli",
        "applications/orchestrator",
        "applications/preprocessing",
        "applications/webui-backend",
        "applications/webui-forwarder",
        "applications/webui-frontend"
    ];
    return subProjects.map(project => join(rootDir, project));
}

// 主函数
function main() {
    console.log("开始执行 pre-commit 检查...\n");

    const stagedFiles = getStagedFiles();
    console.log(`检测到 ${stagedFiles.length} 个 staged 文件`);

    if (stagedFiles.length === 0) {
        console.log("没有 staged 的文件，跳过检查");
        return 0;
    }

    let hasError = false;

    // 步骤 1: 构建 common
    if (!execCommand("npx tsc --build", join(rootDir, "common"), "构建 common")) {
        hasError = true;
    }

    if (hasError) {
        console.error("\n✗ Pre-commit 检查失败，请修复错误后重试");
        return 1;
    }

    // 步骤 2: 在所有子项目中执行类型检查
    console.log("\n开始类型检查...");
    const subProjects = getSubProjects();
    for (const projectDir of subProjects) {
        const projectName = projectDir.split(/[/\\]/).pop();
        if (!execCommand("npx tsc --noEmit 2>&1", projectDir, `类型检查: ${projectName}`)) {
            hasError = true;
        }
    }

    if (hasError) {
        console.error("\n✗ Pre-commit 检查失败，请修复错误后重试");
        return 1;
    }

    // 步骤 3: 如果涉及测试文件，运行测试
    if (hasTestFiles(stagedFiles)) {
        const changedTestFiles = getChangedTestFiles(stagedFiles);
        console.log(`\n检测到测试文件变更，共 ${changedTestFiles.length} 个测试文件:`);
        changedTestFiles.forEach(file => console.log(`  - ${file}`));

        // 提取测试文件名（不带路径）并传递给 pnpm test
        const testFileNames = changedTestFiles
            .map(file => {
                const parts = file.split(/[/\\]/);
                return parts[parts.length - 1];
            })
            .join(" ");

        if (!execCommand(`pnpm test ${testFileNames}`, rootDir, "运行测试")) {
            hasError = true;
        }
    }

    if (hasError) {
        console.error("\n✗ Pre-commit 检查失败，请修复错误后重试");
        return 1;
    }

    // 步骤 4: 如果涉及前端页面，执行 eslint --fix
    if (hasFrontendFiles(stagedFiles)) {
        console.log("\n检测到前端文件变更，执行 eslint --fix...");
        if (
            execCommand(
                "npx eslint --fix .",
                join(rootDir, "applications/webui-frontend"),
                "修复前端 eslint 格式问题"
            )
        ) {
            // eslint --fix 可能修改了文件，需要重新添加到 staging area
            try {
                execSync("git add applications/webui-frontend", {
                    cwd: rootDir,
                    stdio: "inherit"
                });
            } catch (error) {
                // 忽略错误，可能没有修改
            }
        } else {
            hasError = true;
        }
    }

    if (hasError) {
        console.error("\n✗ Pre-commit 检查失败，请修复错误后重试");
        return 1;
    }

    // 步骤 5: 执行 prettier --write 格式化代码（仅限初始的 staged 文件）
    console.log("\n格式化代码...");

    // 仅处理初始的 staged 文件（不会包含工作区未暂存的修改）
    const filesToPrettier = [...stagedFiles];

    if (filesToPrettier.length > 0) {
        console.log(`检测到 ${filesToPrettier.length} 个需要格式化的 staged 文件`);

        // 分批处理文件（避免命令行长度限制）
        const batchSize = 30;
        for (let i = 0; i < filesToPrettier.length; i += batchSize) {
            const batch = filesToPrettier.slice(i, i + batchSize);
            const command = `npx prettier --write ${batch.map(file => `"${file}"`).join(" ")}`;

            if (!execCommand(command, rootDir, `格式化代码 (批 ${Math.floor(i / batchSize) + 1})`)) {
                hasError = true;
                break;
            }
        }

        // 仅将格式化的 staged 文件重新添加到暂存区
        if (!hasError && filesToPrettier.length > 0) {
            console.log("\n将格式化后的文件重新加入暂存区...");
            try {
                // 仅添加被 prettier 修改的文件（初始 staged 文件）
                const gitAddCommand = `git add ${filesToPrettier.map(file => `"${file}"`).join(" ")}`;
                execSync(gitAddCommand, {
                    cwd: rootDir,
                    stdio: "inherit"
                });
                console.log("✓ 格式化文件已重新加入暂存区");
            } catch (error) {
                console.error("✗ 重新添加格式化文件失败:", error.message);
                hasError = true;
            }
        }
    } else {
        console.log("没有需要格式化的 staged 文件");
    }

    if (hasError) {
        console.error("\n✗ Pre-commit 检查失败，请修复错误后重试");
        return 1;
    }

    console.log("\n✓ Pre-commit 检查全部通过");
    return 0;
}

// 运行主函数
process.exit(main());
