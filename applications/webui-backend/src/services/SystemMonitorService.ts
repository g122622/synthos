import "reflect-metadata";
import { injectable } from "tsyringe";
import pidusage from "pidusage";
import * as fs from "fs/promises";
import * as path from "path";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import Logger from "@root/common/util/Logger";
import { findFileUpwards } from "@root/common/util/file/findFileUpwards";
import type { SystemStats } from "../types/system";

const LOGGER = Logger.withTag("SystemMonitorService");

@injectable()
export class SystemMonitorService {
    private statsHistory: SystemStats[] = [];
    private readonly MAX_HISTORY_LENGTH = 300; // 5分钟 * 60秒
    private collectionInterval: NodeJS.Timeout | null = null;
    private LOGGER = Logger.withTag("SystemMonitorService");

    constructor() {
        this.startCollection();
    }

    public getLatestStats(): SystemStats | null {
        return this.statsHistory.length > 0 ? this.statsHistory[this.statsHistory.length - 1] : null;
    }

    public getStatsHistory(): SystemStats[] {
        return this.statsHistory;
    }

    private startCollection() {
        this.collectionInterval = setInterval(async () => {
            try {
                const stats = await this.collectStats();
                this.statsHistory.push(stats);
                if (this.statsHistory.length > this.MAX_HISTORY_LENGTH) {
                    this.statsHistory.shift();
                }
            } catch (error) {
                LOGGER.error(`Failed to collect system stats: ${error}`);
            }
        }, 1000);
        this.LOGGER.info("系统信息收集服务已启动");
    }

    private async collectStats(): Promise<SystemStats> {
        const config = await ConfigManagerService.getCurrentConfig();
        const timestamp = Date.now();

        // 1. 收集存储统计信息
        const storageStats = {
            chatRecordDB: await this.getDirStats(config.commonDatabase.dbBasePath),
            imMessageFtsDB: await this.getDirStats(config.commonDatabase.ftsDatabase.imMessageDBPath),
            aiDialogueDB: await this.getDirStats(config.webUI_Backend.dbBasePath),
            vectorDB: await this.getDirStats(config.ai.embedding.vectorDBPath),
            kvStoreBackend: await this.getDirStats(config.webUI_Backend.kvStoreBasePath),
            kvStorePersistent: await this.getDirStats(
                config.preprocessors.AccumulativeSplitter.persistentKVStorePath
            ),
            logs: await this.getDirStats(config.logger.logDirectory),
            totalSize: 0
        };

        storageStats.totalSize =
            storageStats.chatRecordDB.size +
            storageStats.imMessageFtsDB.size +
            storageStats.aiDialogueDB.size +
            storageStats.vectorDB.size +
            storageStats.kvStoreBackend.size +
            storageStats.kvStorePersistent.size +
            storageStats.logs.size;

        // 2. 收集各模块CPU/内存占用 在windows下pidusage表现不佳，会有巨大资源占用，暂时注释
        // const modulesStats: Record<string, { cpu: number; memory: number }> = {};
        // try {
        //     // 从 logs/pids.json 读取各模块PID（由 launchAll.cjs 生成）
        //     // 假设日志目录为 config.logger.logDirectory，或相对于项目根目录
        //     // 可以尝试从日志目录推断根目录，或直接用固定路径 logs/pids.json
        //     // ConfigManagerService 没有直接给出根目录，假定标准结构。
        //     // config.logger.logDirectory 通常为绝对路径或工作区相对路径。
        //     // 默认假设 pids.json 就在 logs 目录下。
        //     // launchAll.cjs 生成在 `logs/pids.json`。

        //     // 如果 logDirectory 被自定义，可能会有差异，但通常指向 logs/。
        //     // 优先尝试在配置的日志目录下找 logs/pids.json。
        //     // launchAll.cjs 设置: const logDir = path.join(rootDir, "logs");

        //     let pidFilePath = await findFileUpwards("pids.json");
        //     if (!pidFilePath) {
        //         throw new Error("Cannot find pids.json file upwards from current directory");
        //     }

        //     const pidsContent = await fs.readFile(pidFilePath, "utf-8");
        //     const pidMap = JSON.parse(pidsContent) as Record<string, number>;

        //     for (const [name, pid] of Object.entries(pidMap)) {
        //         try {
        //             const stats = await pidusage(pid);
        //             modulesStats[name] = {
        //                 cpu: stats.cpu,
        //                 memory: stats.memory
        //             };
        //         } catch (e) {
        //             // 进程可能已退出
        //             modulesStats[name] = { cpu: 0, memory: 0 };
        //         }
        //     }
        // } catch (error) {
        //     this.LOGGER.error(`收集系统模块资源占用失败: ${error}`);
        // }

        return {
            timestamp,
            storage: storageStats,
            modules: {}
        };
    }

    private async getDirStats(dirPath: string): Promise<{ count: number; size: number }> {
        try {
            await fs.access(dirPath);
            const stats = await fs.stat(dirPath);
            if (!stats.isDirectory()) {
                // 如果是文件（如某些数据库可能为单文件）
                return { count: 1, size: stats.size };
            }

            const files = await fs.readdir(dirPath);
            let totalSize = 0;
            let fileCount = 0;

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                try {
                    const fileStats = await fs.stat(filePath);
                    if (fileStats.isFile()) {
                        totalSize += fileStats.size;
                        fileCount++;
                    }
                } catch {}
            }
            return { count: fileCount, size: totalSize };
        } catch (error) {
            // 目录或文件不存在
            return { count: 0, size: 0 };
        }
    }
}
