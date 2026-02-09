/**
 * 事件服务
 * 基于 RedisService 封装，提供微服务间的事件发布订阅能力
 * 支持类型化消息、通配符订阅、一次性监听等功能
 */
import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import superjson from "superjson";

import Logger from "../../util/Logger";
import { RedisService } from "../redis/RedisService";
import { ConfigManagerService } from "../config/ConfigManagerService";
import { COMMON_TOKENS } from "../../di/tokens";
import { Disposable } from "../../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../../util/lifecycle/mustInitBeforeUse";

import { EventServiceOptions, EventData, EventHandler } from "./contracts/core";

/**
 * 事件处理器包装器（内部使用，不导出）
 */
interface EventHandlerWrapper {
    handler: EventHandler<any>;
    once: boolean;
    pattern?: string; // 通配符模式
}

/**
 * 事件服务类
 * 提供简单易用的微服务间事件通信能力
 */
@injectable()
@mustInitBeforeUse
export class EventService extends Disposable {
    private LOGGER = Logger.withTag("📨 EventService");
    private handlers = new Map<string, Set<EventHandlerWrapper>>();
    private patternHandlers: EventHandlerWrapper[] = [];
    private messageIdCounter = 0;
    private options: EventServiceOptions = {
        defaultTTL: 0,
        enableAck: false
    };

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     * @param redisService Redis 服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.RedisService) private redisService: RedisService
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
        try {
            // 取消所有订阅
            const channels = Array.from(this.handlers.keys());

            for (const channel of channels) {
                await this._unsubscribeChannel(channel);
            }
            this.handlers.clear();
            this.patternHandlers = [];
            this.LOGGER.info("事件服务资源已清理");
        } catch (err) {
            this.LOGGER.error(`清理资源失败: ${(err as Error).message}`);
        }
    }

    /**
     * 初始化方法
     * 在首次使用前调用
     * @param options 可选的配置选项
     */
    public async init(options?: EventServiceOptions): Promise<void> {
        const config = await this.configManagerService.getCurrentConfig();

        if (!config.commonDatabase.redis.enabled) {
            throw new Error("事件服务依赖 Redis，但 Redis 未启用。请在配置中启用 Redis");
        }

        if (!config.commonDatabase.redis.enablePubSub) {
            throw new Error(
                "事件服务依赖 Redis 发布订阅功能，但该功能未启用。请在配置中设置 redis.enablePubSub: true"
            );
        }

        // 初始化 RedisService
        await this.redisService.init();

        // 等待 Redis 连接就绪
        const isReady = await this.redisService.waitForReady(5000);

        if (!isReady) {
            throw new Error("Redis 连接超时，事件服务初始化失败");
        }

        if (options) {
            this.options = { ...this.options, ...options };
        }

        this.LOGGER.success("事件服务初始化成功");
    }

    // ==================== 核心发布订阅方法 ====================

    /**
     * 发布事件消息（对象自动序列化）
     * @param channel 频道名称
     * @param data 事件数据
     * @param ttl 可选的过期时间（毫秒）
     * @returns 收到消息的订阅者数量
     */
    public async publish<T = unknown>(channel: string, data: T, ttl?: number): Promise<number> {
        const eventData: EventData<T> = {
            channel,
            data,
            timestamp: Date.now(),
            messageId: this._generateMessageId()
        };

        const serialized = superjson.stringify(eventData);

        // 如果设置了 TTL，将消息存储到 Redis 以供后续查询
        if (ttl !== undefined && ttl > 0) {
            await this.redisService.set(`event:msg:${eventData.messageId}`, serialized, Math.floor(ttl / 1000));
        } else if (this.options.defaultTTL && this.options.defaultTTL > 0) {
            await this.redisService.set(
                `event:msg:${eventData.messageId}`,
                serialized,
                Math.floor(this.options.defaultTTL / 1000)
            );
        }

        const count = await this.redisService.publish(channel, serialized);

        this.LOGGER.debug(`发布事件到频道 "${channel}"，收到消息的订阅者: ${count}`);

        return count;
    }

    /**
     * 发布原始字符串消息（不进行序列化）
     * @param channel 频道名称
     * @param message 字符串消息
     * @returns 收到消息的订阅者数量
     */
    public async publishRaw(channel: string, message: string): Promise<number> {
        const count = await this.redisService.publish(channel, message);

        this.LOGGER.debug(`发布原始消息到频道 "${channel}"，收到消息的订阅者: ${count}`);

        return count;
    }

    /**
     * 订阅事件（对象自动反序列化）
     * @param channel 频道名称或通配符模式
     * @param handler 事件处理器
     */
    public async subscribe<T = unknown>(channel: string, handler: EventHandler<T>): Promise<void> {
        const wrapper: EventHandlerWrapper = { handler, once: false };

        // 检查是否是通配符模式
        if (this._isWildcardPattern(channel)) {
            wrapper.pattern = channel;
            this.patternHandlers.push(wrapper);
            this.LOGGER.info(`订阅通配符频道: "${channel}"`);

            return;
        }

        // 普通订阅
        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, new Set());
            await this._subscribeChannel(channel);
        }

        this.handlers.get(channel)!.add(wrapper);
        this.LOGGER.info(`订阅频道: "${channel}"`);
    }

    /**
     * 订阅原始字符串消息（不进行反序列化）
     * @param channel 频道名称
     * @param handler 消息处理器
     */
    public async subscribeRaw(
        channel: string,
        handler: (message: string, channel: string) => void | Promise<void>
    ): Promise<void> {
        const wrapper: EventHandlerWrapper = {
            handler: async (data: any, event: any) => {
                // 对于 raw 订阅，我们直接传递原始消息
                await handler(data, event.channel);
            },
            once: false
        };

        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, new Set());
            await this._subscribeChannel(channel);
        }

        this.handlers.get(channel)!.add(wrapper);
        this.LOGGER.info(`订阅原始消息频道: "${channel}"`);
    }

    /**
     * 订阅事件一次（触发后自动取消订阅）
     * @param channel 频道名称
     * @param handler 事件处理器
     */
    public async once<T = unknown>(channel: string, handler: EventHandler<T>): Promise<void> {
        const wrapper: EventHandlerWrapper = { handler, once: true };

        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, new Set());
            await this._subscribeChannel(channel);
        }

        this.handlers.get(channel)!.add(wrapper);
        this.LOGGER.info(`一次性订阅频道: "${channel}"`);
    }

    /**
     * 取消订阅
     * @param channel 频道名称（必填）
     * @param handler 可选的处理器，如果不提供则取消该频道的所有订阅
     */
    public async unsubscribe(channel: string, handler?: EventHandler<any>): Promise<void> {
        // 处理通配符取消订阅
        if (this._isWildcardPattern(channel)) {
            if (handler) {
                this.patternHandlers = this.patternHandlers.filter(
                    w => w.pattern !== channel || w.handler !== handler
                );
            } else {
                this.patternHandlers = this.patternHandlers.filter(w => w.pattern !== channel);
            }
            this.LOGGER.info(`取消订阅通配符频道: "${channel}"`);

            return;
        }

        // 普通取消订阅
        if (!this.handlers.has(channel)) {
            return;
        }

        const wrappers = this.handlers.get(channel)!;

        if (handler) {
            // 取消特定处理器
            for (const wrapper of wrappers) {
                if (wrapper.handler === handler) {
                    wrappers.delete(wrapper);
                    break;
                }
            }
        } else {
            // 取消所有处理器
            wrappers.clear();
        }

        // 如果该频道没有处理器了，取消 Redis 订阅
        if (wrappers.size === 0) {
            this.handlers.delete(channel);
            await this._unsubscribeChannel(channel);
        }

        this.LOGGER.info(`取消订阅频道: "${channel}"`);
    }

    // ==================== 别名方法（更符合直觉的命名）====================

    /**
     * emit 方法（publish 的别名）
     */
    public async emit<T = unknown>(event: string, data: T, ttl?: number): Promise<number> {
        return this.publish(event, data, ttl);
    }

    /**
     * on 方法（subscribe 的别名）
     */
    public async on<T = unknown>(event: string, handler: EventHandler<T>): Promise<void> {
        return this.subscribe(event, handler);
    }

    /**
     * off 方法（unsubscribe 的别名）
     */
    public async off(event: string, handler?: EventHandler<any>): Promise<void> {
        return this.unsubscribe(event, handler);
    }

    // ==================== 工具方法 ====================

    /**
     * 获取当前所有订阅的频道列表
     * @returns 订阅的频道名称数组
     */
    public getSubscribedChannels(): string[] {
        const channels = Array.from(this.handlers.keys());
        const patterns = this.patternHandlers.map(w => w.pattern).filter((p): p is string => p !== undefined);

        return [...channels, ...patterns];
    }

    /**
     * 检查是否订阅了某个频道
     * @param channel 频道名称
     */
    public isSubscribed(channel: string): boolean {
        if (this.handlers.has(channel)) {
            return true;
        }

        // 检查是否匹配任何通配符模式
        return this.patternHandlers.some(w => w.pattern && this._matchPattern(channel, w.pattern));
    }

    /**
     * 获取某个频道的订阅者数量
     * @param channel 频道名称
     */
    public getSubscriberCount(channel: string): number {
        const directCount = this.handlers.get(channel)?.size || 0;
        const patternCount = this.patternHandlers.filter(
            w => w.pattern && this._matchPattern(channel, w.pattern)
        ).length;

        return directCount + patternCount;
    }

    /**
     * 等待特定事件（Promise 形式）
     * @param channel 频道名称
     * @param timeout 超时时间（毫秒），0 表示永不超时
     * @returns 事件数据的 Promise
     */
    public async waitForEvent<T = unknown>(channel: string, timeout: number = 0): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let timer: NodeJS.Timeout | null = null;
            const handler: EventHandler<T> = data => {
                if (timer) {
                    clearTimeout(timer);
                }
                resolve(data);
            };

            this.once(channel, handler).catch(reject);

            if (timeout > 0) {
                timer = setTimeout(() => {
                    this.unsubscribe(channel, handler).catch(() => {
                        // 忽略取消订阅错误
                    });
                    reject(new Error(`等待事件 "${channel}" 超时 (${timeout}ms)`));
                }, timeout);
            }
        });
    }

    // ==================== 内部方法 ====================

    /**
     * 实际订阅 Redis 频道
     */
    private async _subscribeChannel(channel: string): Promise<void> {
        await this.redisService.subscribe(channel, (ch, message) => {
            this._handleMessage(ch, message);
        });
    }

    /**
     * 实际取消订阅 Redis 频道
     */
    private async _unsubscribeChannel(channel: string): Promise<void> {
        await this.redisService.unsubscribe(channel);
    }

    /**
     * 处理收到的消息
     */
    private _handleMessage(channel: string, message: string): void {
        try {
            // 尝试反序列化为 EventData
            let eventData: EventData<any>;

            try {
                eventData = superjson.parse<EventData<any>>(message);
            } catch {
                // 如果反序列化失败，说明是原始字符串消息
                eventData = {
                    channel,
                    data: message,
                    timestamp: Date.now()
                };
            }

            // 处理直接订阅的处理器
            const wrappers = this.handlers.get(channel);

            if (wrappers) {
                const toRemove: EventHandlerWrapper[] = [];

                for (const wrapper of wrappers) {
                    try {
                        const result = wrapper.handler(eventData.data, eventData);

                        if (result instanceof Promise) {
                            result.catch(err => {
                                this.LOGGER.error(
                                    `事件处理器执行失败 (频道: "${channel}"): ${(err as Error).message}`
                                );
                            });
                        }
                        if (wrapper.once) {
                            toRemove.push(wrapper);
                        }
                    } catch (err) {
                        this.LOGGER.error(`事件处理器执行失败 (频道: "${channel}"): ${(err as Error).message}`);
                    }
                }

                // 移除一次性处理器
                for (const wrapper of toRemove) {
                    wrappers.delete(wrapper);
                }

                // 如果没有处理器了，取消订阅
                if (wrappers.size === 0) {
                    this.handlers.delete(channel);
                    this._unsubscribeChannel(channel).catch(err => {
                        this.LOGGER.error(`取消订阅失败: ${err}`);
                    });
                }
            }

            // 处理通配符订阅的处理器
            const matchedPatternHandlers = this.patternHandlers.filter(
                w => w.pattern && this._matchPattern(channel, w.pattern)
            );

            for (const wrapper of matchedPatternHandlers) {
                try {
                    const result = wrapper.handler(eventData.data, eventData);

                    if (result instanceof Promise) {
                        result.catch(err => {
                            this.LOGGER.error(
                                `通配符事件处理器执行失败 (模式: "${wrapper.pattern}"): ${(err as Error).message}`
                            );
                        });
                    }
                    if (wrapper.once) {
                        const index = this.patternHandlers.indexOf(wrapper);

                        if (index > -1) {
                            this.patternHandlers.splice(index, 1);
                        }
                    }
                } catch (err) {
                    this.LOGGER.error(
                        `通配符事件处理器执行失败 (模式: "${wrapper.pattern}"): ${(err as Error).message}`
                    );
                }
            }
        } catch (err) {
            this.LOGGER.error(`处理消息失败 (频道: "${channel}"): ${(err as Error).message}`);
        }
    }

    /**
     * 检查是否是通配符模式
     */
    private _isWildcardPattern(pattern: string): boolean {
        return pattern.includes("*") || pattern.includes("?");
    }

    /**
     * 匹配通配符模式
     * 支持 * (匹配任意字符) 和 ? (匹配单个字符)
     */
    private _matchPattern(channel: string, pattern: string): boolean {
        // 将通配符模式转换为正则表达式
        const regexPattern = pattern
            .split("")
            .map(char => {
                if (char === "*") {
                    return ".*";
                }
                if (char === "?") {
                    return ".";
                }
                // 转义正则特殊字符
                if (/[.+^${}()|[\]\\]/.test(char)) {
                    return `\\${char}`;
                }

                return char;
            })
            .join("");
        const regex = new RegExp(`^${regexPattern}$`);

        return regex.test(channel);
    }

    /**
     * 生成消息 ID
     */
    private _generateMessageId(): string {
        this.messageIdCounter = (this.messageIdCounter + 1) % 1000000;

        return `${Date.now()}-${this.messageIdCounter}`;
    }
}

/**
 * EventService 实例类型
 * 用于依赖注入时的类型标注
 */
export type IEventService = EventService;
