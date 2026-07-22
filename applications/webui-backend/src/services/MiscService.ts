/**
 * 杂项服务
 */
import fs from "fs/promises";
import path from "path";

import { inject, injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";

import { NotFoundError } from "../errors/AppError";
import { downloadImage } from "../utils/httpDownloader";

const LOGGER = Logger.withTag("MiscService");

/** QQ 头像类型 */
export type QQAvatarType = "group" | "user";

/** 头像类型对应的缓存子目录 */
const CACHE_SUBDIR: Record<QQAvatarType, string> = {
    group: "groups",
    user: "users"
};

interface QQAvatarResult {
    buffer: Buffer;
    contentType: string;
}

@injectable()
export class MiscService {
    /** in-flight 请求去重：同一 type+qqId 并发回源只触发一次 */
    private readonly inflight = new Map<string, Promise<QQAvatarResult>>();

    constructor(@inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService) {}

    /**
     * 获取健康检查信息
     */
    getHealthInfo() {
        return {
            message: "WebUI后端服务运行正常",
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 获取 QQ 头像图片字节，带磁盘缓存。
     * - 命中且未过期 → 直接返回磁盘缓存
     * - 过期或缺失 → 回源腾讯，成功后写盘；回源失败但存在旧缓存 → 降级返回旧缓存
     * - 回源失败且无缓存 → 抛 NotFoundError（由前端 onError 兜底占位图）
     */
    async getQQAvatarImage(type: QQAvatarType, qqId: string): Promise<QQAvatarResult> {
        const cacheKey = `${type}:${qqId}`;
        const existing = this.inflight.get(cacheKey);

        if (existing) {
            return existing;
        }

        const promise = this.loadQQAvatarImage(type, qqId).finally(() => {
            this.inflight.delete(cacheKey);
        });

        this.inflight.set(cacheKey, promise);

        return promise;
    }

    private async loadQQAvatarImage(type: QQAvatarType, qqId: string): Promise<QQAvatarResult> {
        const config = await this.configManagerService.getCurrentConfig();
        const cachePath = path.join(config.webUI_Backend.imageCacheBasePath, CACHE_SUBDIR[type], `${qqId}.jpg`);
        const ttlMs = config.webUI_Backend.imageCacheTtlDays * 24 * 60 * 60 * 1000;

        // 1. 尝试命中未过期的磁盘缓存
        const cached = await this.readCacheIfFresh(cachePath, ttlMs);

        if (cached) {
            return cached;
        }

        // 2. 回源腾讯
        try {
            const buffer = await this.fetchFromTencent(type, qqId);
            const result: QQAvatarResult = { buffer, contentType: detectContentType(buffer) };

            // 异步写盘，不阻塞响应
            this.persistCache(cachePath, buffer).catch(err => {
                LOGGER.warning(`写入头像缓存失败 ${cachePath}: ${err.message}`);
            });

            return result;
        } catch (err) {
            // 3. 回源失败：降级返回过期旧缓存（若有）
            const stale = await this.readCache(cachePath);

            if (stale) {
                LOGGER.warning(`回源 QQ 头像失败，降级使用旧缓存 ${type}:${qqId}: ${(err as Error).message}`);

                return stale;
            }

            // 4. 既无新数据也无缓存 → 404，前端兜底占位图
            throw new NotFoundError(`无法获取 QQ 头像 ${type}:${qqId}`);
        }
    }

    /**
     * 回源腾讯官方接口下载头像字节
     */
    private fetchFromTencent(type: QQAvatarType, qqId: string): Promise<Buffer> {
        const url =
            type === "group"
                ? `https://p.qlogo.cn/gh/${qqId}/${qqId}/100`
                : `https://q1.qlogo.cn/g?b=qq&nk=${qqId}&s=100`;

        return downloadImage(url);
    }

    /**
     * 读取未过期的缓存，过期或不存在返回 null
     */
    private async readCacheIfFresh(cachePath: string, ttlMs: number): Promise<QQAvatarResult | null> {
        try {
            const stat = await fs.stat(cachePath);

            if (Date.now() - stat.mtimeMs >= ttlMs) {
                return null;
            }
            const buffer = await fs.readFile(cachePath);

            return { buffer, contentType: detectContentType(buffer) };
        } catch {
            return null;
        }
    }

    /**
     * 读取缓存（忽略过期），不存在返回 null
     */
    private async readCache(cachePath: string): Promise<QQAvatarResult | null> {
        try {
            const buffer = await fs.readFile(cachePath);

            return { buffer, contentType: detectContentType(buffer) };
        } catch {
            return null;
        }
    }

    /**
     * 写入缓存（自动创建目录）
     */
    private async persistCache(cachePath: string, buffer: Buffer): Promise<void> {
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, buffer);
    }
}

/**
 * 按魔数探测图片 Content-Type，默认 image/jpeg
 */
function detectContentType(buffer: Buffer): string {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image/jpeg";
    }
    if (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
    ) {
        return "image/png";
    }
    if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        return "image/gif";
    }
    if (
        buffer.length >= 12 &&
        buffer[4] === 0x66 &&
        buffer[5] === 0x74 &&
        buffer[6] === 0x79 &&
        buffer[7] === 0x70
    ) {
        return "image/webp";
    }

    return "image/jpeg";
}
