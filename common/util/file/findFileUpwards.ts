import { access, constants } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

/**
 * 从当前目录开始逐层向上查找指定文件名的文件
 *
 * @param filename - 要查找的文件名（例如 ".gitignore", "package.json"）
 * @param startDir - 开始查找的目录，默认为当前工作目录
 * @param options - 查找选项
 * @returns 找到的文件的绝对路径，如果未找到则返回 null
 *
 * @throws {Error} 当输入参数无效时抛出错误
 */
export async function findFileUpwards(
    filename: string,
    startDir: string = process.cwd(),
    options: {
        /** 是否检查文件的可读权限，默认为 true */
        checkReadable?: boolean;
    } = {}
): Promise<string | null> {
    // 参数验证
    if (!filename || typeof filename !== "string") {
        throw new Error("Filename must be a non-empty string");
    }

    if (filename.includes(sep)) {
        throw new Error("Filename should not contain path separators");
    }

    if (!startDir || typeof startDir !== "string") {
        throw new Error("Start directory must be a non-empty string");
    }

    const { checkReadable = true } = options;

    // 解析起始目录为绝对路径
    let currentDir = resolve(startDir);

    // 用于检测是否到达文件系统根目录
    let lastDir: string | null = null;

    while (true) {
        // 构建当前目录下目标文件的完整路径
        const filePath = resolve(currentDir, filename);

        try {
            // 检查文件是否存在且可访问
            if (checkReadable) {
                await access(filePath, constants.R_OK);
            } else {
                await access(filePath);
            }

            // 文件存在且满足条件，返回绝对路径
            return filePath;
        } catch (error) {
            // 如果是权限错误或其他非"文件不存在"错误，重新抛出
            if (error.code !== "ENOENT" && error.code !== "ENOTDIR") {
                throw error;
            }
            // ENOENT: 文件不存在, ENOTDIR: 路径中的某个部分不是目录（正常情况）
        }

        // 到达根目录，停止查找
        if (lastDir === currentDir) {
            break;
        }

        // 保存当前目录，用于检测是否到达根目录
        lastDir = currentDir;

        // 移动到父目录
        const parentDir = dirname(currentDir);

        // 在 Windows 系统中，dirname("C:\\") 会返回 "C:\\"，需要特殊处理
        // 在 Unix 系统中，dirname("/") 会返回 "/"
        if (parentDir === currentDir) {
            break;
        }

        currentDir = parentDir;
    }

    // 未找到文件
    return null;
}
