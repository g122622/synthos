import "reflect-metadata";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { injectable, inject } from "tsyringe";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { RawChatMessage } from "@root/common/contracts/data-provider/index";
import Logger from "@root/common/util/Logger";
import ErrorReasons from "@root/common/contracts/ErrorReasons";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

// ESM 环境下获取当前文件所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { IIMProvider } from "../contracts/IIMProvider";
import { COMMON_TOKENS } from "../../di/tokens";

import { WorkerPool } from "./workers/WorkerPool";

import type { WorkerConfig } from "./workers/types";

/**
 * QQ 消息提供者
 * 负责从 QQNT 数据库中读取消息数据
 * 使用 Worker 线程池实现多线程并发查询
 */
@injectable()
@mustInitBeforeUse
export class QQProvider extends Disposable implements IIMProvider {
    private pool: WorkerPool | null = null;
    private LOGGER = Logger.withTag("QQProvider");

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {
        super();
    }

    /**
     * 初始化 QQ 消息提供者
     * 创建 Worker 线程池，每个 Worker 持有独立的数据库连接
     */
    public async init() {
        const config = (await this.configManagerService.getCurrentConfig()).dataProviders.QQ;
        const dbPath = config.dbBasePath + "/nt_msg.db";

        // 预计算 patchSQL
        const patchSQL = config.dbPatch.enabled ? `(${config.dbPatch.patchSQL})` : "";

        // 计算 Worker 脚本的绝对路径
        // __dirname 在编译后指向 dist/providers/QQProvider，workers 目录在其下
        const workerScriptPath = resolve(__dirname, "workers", "qqQueryWorker.js");

        // 计算 proto 文件的绝对路径
        // 优先使用 dist 目录下的 proto 文件（构建时复制），回退到源码目录
        let protoFilePath = resolve(__dirname, "parsers", "messageSegment.proto");

        if (!existsSync(protoFilePath)) {
            // 回退到源码目录
            protoFilePath = resolve(
                __dirname,
                "..",
                "..",
                "src",
                "providers",
                "QQProvider",
                "parsers",
                "messageSegment.proto"
            );
            this.LOGGER.warning(`dist 目录下未找到 proto 文件，回退到源码路径: ${protoFilePath}`);
        }

        // 构建 Worker 配置
        const workerConfig: WorkerConfig = {
            dbPath,
            dbKey: config.dbKey,
            VFSExtPath: config.VFSExtPath,
            patchSQL,
            protoFilePath,
            cipherPageSize: 4096,
            kdfIter: 4000,
            cipherHmacAlgorithm: "HMAC_SHA1",
            cipherKdfAlgorithm: "PBKDF2_HMAC_SHA512"
        };

        this.LOGGER.info(`当前的dbKey: ${config.dbKey}`);
        this.LOGGER.info(`Worker 脚本路径: ${workerScriptPath}`);
        this.LOGGER.info(`Proto 文件路径: ${protoFilePath}`);

        // 创建并初始化 Worker 线程池
        const poolSize = config.poolSize ?? 12;

        this.pool = this._registerDisposable(
            new WorkerPool({
                poolSize,
                config: workerConfig,
                workerScriptPath
            })
        );

        await this.pool.init();

        this.LOGGER.success(`QQProvider 初始化完成！Worker 线程池大小: ${poolSize}`);
    }

    /**
     * 从QQNT数据库中获取指定时间范围内的消息
     * 通过 Worker 线程池并发查询
     * @param timeStart 开始时间（毫秒级时间戳）
     * @param timeEnd 结束时间（毫秒级时间戳）
     * @param groupId 群号（可选）
     * @returns 消息数组
     */
    public async getMsgByTimeRange(
        timeStart: number,
        timeEnd: number,
        groupId: string = ""
    ): Promise<RawChatMessage[]> {
        if (!this.pool) {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }

        return this.pool.submit(timeStart, timeEnd, groupId);
    }
}
