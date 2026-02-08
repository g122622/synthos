/**
 * Redis 服务
 * 基于 ioredis 封装，支持分布式锁和发布订阅功能，与具体业务逻辑无关
 * 可以用来实现分布式锁、缓存、消息队列等
 */
import "reflect-metadata";
import Redis, { RedisOptions } from "ioredis";
import Redlock, { Lock } from "redlock";
import { injectable, inject } from "tsyringe";

import Logger from "../../util/Logger";
import { ConfigManagerService } from "../config/ConfigManagerService";
import { COMMON_TOKENS } from "../../di/tokens";
import { Disposable } from "../../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../../util/lifecycle/mustInitBeforeUse";

/**
 * Redis 服务配置接口
 */
export interface RedisServiceConfig extends RedisOptions {
    enableRedlock?: boolean; // 是否启用分布式锁
    enablePubSub?: boolean; // 是否启用发布订阅（自动初始化订阅客户端）
}

/**
 * 发布订阅回调类型
 */
export type PubSubCallback = (channel: string, message: string) => void;

/**
 * Redis 服务类
 * 负责初始化 Redis 连接，支持分布式锁和发布订阅
 * Redis 连接配置从 config.redis 读取
 */
@injectable()
@mustInitBeforeUse
class RedisService extends Disposable {
    private LOGGER = Logger.withTag("RedisService");
    private client: Redis | null = null;
    private subClient: Redis | null = null;
    private redlock: Redlock | null = null;
    private pubSubCallbacks = new Map<string, Set<PubSubCallback>>();
    private isShuttingDown = false;

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {
        super();
        this._registerDisposableFunction(async () => {
            await this._cleanup();
        });
    }

    /**
     * 清理资源
     */
    private async _cleanup(): Promise<void> {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        try {
            await Promise.allSettled([
                this.client?.quit().catch(() => null),
                this.subClient?.quit().catch(() => null)
            ]);
            this.LOGGER.info("Redis 客户端已优雅断开");
        } catch (err) {
            this.LOGGER.error(`清理资源失败: ${(err as Error).message}`);
        }
    }

    /**
     * 设置客户端监听器
     */
    private _setupClientListeners(client: Redis, label: string): void {
        client.on("error", err => {
            if (!this.isShuttingDown) {
                this.LOGGER.error(`${label} 客户端错误: ${err.message}`);
            }
        });
        client.on("connect", () => this.LOGGER.info(`${label} 客户端已连接`));
        client.on("reconnecting", () => this.LOGGER.info(`${label} 客户端正在重新连接...`));
    }

    /**
     * 初始化接收方法
     * 在首次使用前调用，初始化 Redis 连接
     */
    public async init(): Promise<void> {
        const config = await this.configManagerService.getCurrentConfig();

        if (!config.commonDatabase.redis.enabled) {
            this.LOGGER.info("Redis 功能未启用");

            return;
        }

        const redisConfig: RedisServiceConfig = {
            ...config.commonDatabase.redis.connection,
            enableRedlock: config.commonDatabase.redis.enableRedlock,
            enablePubSub: config.commonDatabase.redis.enablePubSub
        };

        // 初始化主客户端
        this.client = new Redis(redisConfig);
        this._setupClientListeners(this.client, "Command");

        // 按需初始化订阅客户端
        if (redisConfig.enablePubSub) {
            this.subClient = new Redis(redisConfig);
            this._setupClientListeners(this.subClient, "Subscriber");
            this._setupPubSubHandlers();
        }

        // 按需初始化 Redlock
        if (redisConfig.enableRedlock) {
            try {
                this.redlock = new Redlock([this.client], {
                    driftFactor: 0.01,
                    retryCount: 10,
                    retryDelay: 200,
                    retryJitter: 200
                });
                this.redlock.on("clientError", err => {
                    this.LOGGER.error(`Redlock 客户端错误: ${err.message}`);
                });
            } catch (err) {
                this.LOGGER.warning(`Redlock 初始化失败: ${(err as Error).message}`);
            }
        }

        this.LOGGER.success("Redis 服务初始化成功");
    }

    /**
     * 检查 Redis 服务是否已启用
     */
    public async isEnabled(): Promise<boolean> {
        const config = await this.configManagerService.getCurrentConfig();

        return config.commonDatabase.redis.enabled ?? false;
    }

    // ==================== 基础数据操作 ====================
    public async get(key: string): Promise<string | null> {
        return this.client!.get(key);
    }

    public async set(key: string, value: string, expireSeconds?: number): Promise<"OK" | null> {
        return expireSeconds ? this.client!.set(key, value, "EX", expireSeconds) : this.client!.set(key, value);
    }

    public async del(key: string): Promise<number> {
        return this.client!.del(key);
    }

    public async hgetall(key: string): Promise<Record<string, string>> {
        return this.client!.hgetall(key);
    }

    public async hset(key: string, fields: Record<string, string>): Promise<number> {
        return this.client!.hset(key, fields);
    }

    public async incr(key: string): Promise<number> {
        return this.client!.incr(key);
    }

    // ==================== 发布订阅 ====================
    private _setupPubSubHandlers(): void {
        if (!this.subClient) return;

        this.subClient.on("message", (channel: string, message: string) => {
            const callbacks = this.pubSubCallbacks.get(channel);

            if (callbacks) {
                callbacks.forEach(cb => {
                    try {
                        cb(channel, message);
                    } catch (err) {
                        this.LOGGER.error(`PubSub 回调错误: ${err}`);
                    }
                });
            }
        });
    }

    public async subscribe(channel: string, callback: PubSubCallback): Promise<void> {
        if (!this.subClient) {
            throw new Error("发布订阅功能未启用。请在 Redis 配置中设置 enablePubSub: true");
        }
        if (!this.pubSubCallbacks.has(channel)) {
            await this.subClient.subscribe(channel);
            this.pubSubCallbacks.set(channel, new Set());
        }
        this.pubSubCallbacks.get(channel)!.add(callback);
    }

    public async unsubscribe(channel: string, callback?: PubSubCallback): Promise<void> {
        if (!this.subClient || !this.pubSubCallbacks.has(channel)) return;

        const callbacks = this.pubSubCallbacks.get(channel)!;

        if (callback) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                await this.subClient.unsubscribe(channel);
                this.pubSubCallbacks.delete(channel);
            }
        } else {
            await this.subClient.unsubscribe(channel);
            this.pubSubCallbacks.delete(channel);
        }
    }

    public async publish(channel: string, message: string): Promise<number> {
        return this.client!.publish(channel, message);
    }

    // ==================== 分布式锁 ====================
    public async acquireLock(resource: string, ttl: number = 2000): Promise<Lock | null> {
        if (!this.redlock) {
            this.LOGGER.warning("分布式锁功能未启用。请在 Redis 配置中设置 enableRedlock: true");

            return null;
        }
        try {
            return await this.redlock.lock(resource, ttl);
        } catch (err) {
            this.LOGGER.error(`获取分布式锁失败: ${(err as Error).message}`);

            return null;
        }
    }

    public async releaseLock(lock: Lock): Promise<boolean> {
        if (!lock) return false;
        try {
            await lock.unlock();

            return true;
        } catch (err) {
            this.LOGGER.error(`释放分布式锁失败: ${(err as Error).message}`);

            return false;
        }
    }

    // ==================== 工具方法 ====================
    public getClient(): Redis {
        if (!this.client) {
            throw new Error("Redis 客户端未初始化");
        }

        return this.client;
    }

    public isReady(): boolean {
        return this.client?.status === "ready";
    }

    public async waitForReady(timeoutMs = 5000): Promise<boolean> {
        if (this.isReady()) return true;

        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.client?.off("ready", onReady);
                resolve(false);
            }, timeoutMs);
            const onReady = () => {
                clearTimeout(timer);
                resolve(true);
            };

            this.client?.once("ready", onReady);
        });
    }
}

/**
 * RedisService 实例类型
 * 用于依赖注入时的类型标注
 */
export type IRedisService = RedisService;

export { RedisService };
