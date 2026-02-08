/**
 * 任务注册中心
 *
 * 提供全局任务元数据注册、查询、校验功能
 * 基于 Redis 实现分布式任务注册，支持多实例共享
 */

import "reflect-metadata";
import { injectable, inject } from "tsyringe";

import Logger from "../../util/Logger";
import { RedisService } from "../../services/redis/RedisService";
import { COMMON_TOKENS } from "../../di/tokens";

import { TaskMetadata, SerializableTaskMetadata } from "./types";
import { mustInitBeforeUse } from "../../util/lifecycle/mustInitBeforeUse";
import { Disposable } from "../../util/lifecycle/Disposable";

/**
 * 任务注册中心
 * 通过 Redis 实现分布式任务元数据存储，Zod Schema 保留在内存中用于验证
 */
@injectable()
@mustInitBeforeUse
export class TaskRegistry extends Disposable {
    private LOGGER = Logger.withTag("📋 TaskRegistry");
    private tasks: Map<string, TaskMetadata> = new Map();
    private readonly REDIS_KEY_PREFIX = "task:registry:";
    private readonly LOCK_PREFIX = "lock:task:register:";

    /**
     * 构造函数
     * @param redisService Redis 服务
     */
    public constructor(@inject(COMMON_TOKENS.RedisService) private redisService: RedisService) {
        super();
    }

    /**
     * 初始化任务注册中心
     * 从 Redis 加载已注册的任务元数据
     */
    public async init(): Promise<void> {
        this.LOGGER.info("TaskRegistry 初始化成功");
    }

    /**
     * 生成 Redis Key
     */
    private _getRedisKey(taskName: string): string {
        return `${this.REDIS_KEY_PREFIX}${taskName}`;
    }

    /**
     * 生成分布式锁 Key
     */
    private _getLockKey(taskName: string): string {
        return `${this.LOCK_PREFIX}${taskName}`;
    }

    /**
     * 将任务元数据序列化为可存储的格式
     */
    private _serializeMetadata(metadata: TaskMetadata): string {
        return JSON.stringify({
            internalName: metadata.internalName,
            displayName: metadata.displayName,
            description: metadata.description
        });
    }

    /**
     * 从 Redis 反序列化任务元数据
     */
    private _deserializeMetadata(data: string): Partial<TaskMetadata> {
        return JSON.parse(data);
    }

    /**
     * 注册任务
     * 使用分布式锁保证原子性，防止并发冲突
     * @param metadata 任务元数据
     */
    public async registerSingleTask<TParams>(metadata: TaskMetadata<TParams>): Promise<void> {
        const lockKey = this._getLockKey(metadata.internalName);
        const lock = await this.redisService.acquireLock(lockKey, 5000);

        if (!lock) {
            throw new Error(`无法获取任务 ${metadata.internalName} 的注册锁，注册失败`);
        }

        try {
            const redisKey = this._getRedisKey(metadata.internalName);
            const existingData = await this.redisService.get(redisKey);

            if (existingData) {
                throw new Error(`任务 ${metadata.internalName} 已被其他实例注册，禁止重复注册`);
            }

            // 存储到 Redis（仅存储可序列化字段）
            await this.redisService.set(redisKey, this._serializeMetadata(metadata));

            // 存储到内存（包含完整的 Schema）
            this.tasks.set(metadata.internalName, metadata);

            this.LOGGER.info(`✅ 已注册任务: ${metadata.internalName} (${metadata.displayName})`);
        } finally {
            await this.redisService.releaseLock(lock);
        }
    }

    /**
     * 获取任务元数据
     * 优先从内存获取（含 Schema），若不存在则从 Redis 加载
     * @param taskName 任务名称
     * @returns 任务元数据，若不存在则返回 undefined
     */
    public async getRegisteredTaskByName(taskName: string): Promise<TaskMetadata | undefined> {
        // 优先从内存获取（含 Schema）
        if (this.tasks.has(taskName)) {
            return this.tasks.get(taskName);
        }

        // 从 Redis 加载基础信息
        const redisKey = this._getRedisKey(taskName);
        const data = await this.redisService.get(redisKey);

        if (!data) {
            return undefined;
        }

        // Redis 中只有基础信息，Schema 缺失时无法进行完整操作
        this.LOGGER.warning(`任务 ${taskName} 仅存在于 Redis，缺少 Schema，请确保任务已在当前实例注册`);

        return undefined;
    }

    /**
     * 获取所有已注册任务
     * @returns 所有任务元数据数组
     */
    public async getAllRegisteredTasks(): Promise<TaskMetadata[]> {
        return Array.from(this.tasks.values());
    }

    /**
     * 获取所有任务名称列表
     * 从 Redis 获取完整列表（跨实例共享）
     * @returns 任务名称数组
     */
    public async getAllTaskNames(): Promise<string[]> {
        const client = this.redisService.getClient();
        const keys = await client.keys(`${this.REDIS_KEY_PREFIX}*`);

        return keys.map(key => key.replace(this.REDIS_KEY_PREFIX, ""));
    }

    /**
     * 检查任务是否已注册
     * @param taskName 任务名称
     */
    public async has(taskName: string): Promise<boolean> {
        const redisKey = this._getRedisKey(taskName);
        const exists = await this.redisService.get(redisKey);

        return exists !== null;
    }

    /**
     * 校验任务参数
     * 从内存中的 Schema 进行校验
     * @param taskName 任务名称
     * @param params 参数对象
     * @returns 校验结果
     */
    public async validate(
        taskName: string,
        params: unknown
    ): Promise<{ success: boolean; data?: any; error?: string }> {
        const metadata = await this.getRegisteredTaskByName(taskName);

        if (!metadata) {
            return { success: false, error: `未找到任务 ${taskName}` };
        }

        if (!metadata.paramsSchema) {
            return { success: false, error: `任务 ${taskName} 缺少参数 Schema，无法校验` };
        }

        try {
            const result = metadata.paramsSchema.safeParse(params);

            if (!result.success) {
                return {
                    success: false,
                    error: result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ")
                };
            }

            return { success: true, data: result.data };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * 获取可序列化的任务元数据（用于前端）
     * @param taskName 任务名称
     */
    public async getSerializable(taskName: string): Promise<SerializableTaskMetadata | null> {
        const metadata = await this.getRegisteredTaskByName(taskName);

        if (!metadata) {
            return null;
        }

        return {
            internalName: metadata.internalName,
            displayName: metadata.displayName,
            description: metadata.description,
            paramsJsonSchema: {}
        };
    }

    /**
     * 获取所有可序列化的任务元数据
     */
    public async getAllSerializable(): Promise<SerializableTaskMetadata[]> {
        const allTasks = await this.getAllRegisteredTasks();

        return allTasks.map(metadata => ({
            internalName: metadata.internalName,
            displayName: metadata.displayName,
            description: metadata.description,
            paramsJsonSchema: {}
        }));
    }
}
