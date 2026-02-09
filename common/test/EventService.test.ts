import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "reflect-metadata";

// ==================== Mock 区域 ====================

const {
    mockConfigManagerService,
    mockRedisService,
    mockLogger,
    mockRedisPublish,
    mockRedisSubscribe,
    mockRedisUnsubscribe
} = vi.hoisted(() => {
    const loggerInstance: Record<string, unknown> = {
        debug: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn()
    };

    loggerInstance.withTag = vi.fn().mockReturnValue(loggerInstance);

    // Mock Redis 发布订阅方法
    const mockPublish = vi.fn().mockResolvedValue(1);
    const mockSubscribe = vi.fn().mockResolvedValue(undefined);
    const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);

    // Mock ConfigManagerService
    const mockConfigManager = {
        getCurrentConfig: vi.fn().mockResolvedValue({
            commonDatabase: {
                redis: {
                    enabled: true,
                    enablePubSub: true,
                    connection: {
                        host: "localhost",
                        port: 6379
                    }
                }
            }
        })
    };

    // Mock RedisService
    const mockRedis = {
        init: vi.fn().mockResolvedValue(undefined),
        isReady: vi.fn().mockReturnValue(true),
        waitForReady: vi.fn().mockResolvedValue(true),
        publish: mockPublish,
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        set: vi.fn().mockResolvedValue("OK")
    };

    return {
        mockConfigManagerService: mockConfigManager,
        mockRedisService: mockRedis,
        mockLogger: loggerInstance,
        mockRedisPublish: mockPublish,
        mockRedisSubscribe: mockSubscribe,
        mockRedisUnsubscribe: mockUnsubscribe
    };
});

// Mock Logger
vi.mock("@root/common/util/Logger", () => ({
    default: mockLogger
}));

// Mock ConfigManagerService
vi.mock("@root/common/services/config/ConfigManagerService", () => ({
    ConfigManagerService: vi.fn().mockImplementation(() => mockConfigManagerService)
}));

// Mock RedisService
vi.mock("@root/common/services/redis/RedisService", () => ({
    RedisService: vi.fn().mockImplementation(() => mockRedisService)
}));

// 在 mock 之后导入
import { EventService } from "../services/event/EventService";

// ==================== 测试 ====================

describe("EventService", () => {
    let eventService: EventService;
    let subscribedHandlers: Map<string, (channel: string, message: string) => void>;

    beforeEach(() => {
        // 清空 mock 调用记录
        vi.clearAllMocks();

        // 存储订阅的处理器以便模拟消息接收
        subscribedHandlers = new Map();

        // 模拟 subscribe 行为：存储处理器
        mockRedisSubscribe.mockImplementation((channel: string, handler: (ch: string, msg: string) => void) => {
            subscribedHandlers.set(channel, handler);

            return Promise.resolve();
        });

        // 模拟 unsubscribe 行为：移除处理器
        mockRedisUnsubscribe.mockImplementation((channel: string) => {
            subscribedHandlers.delete(channel);

            return Promise.resolve();
        });

        // 创建新的 EventService 实例
        eventService = new EventService(mockConfigManagerService as any, mockRedisService as any);
    });

    afterEach(async () => {
        // 清理资源
        if (eventService) {
            await eventService.dispose();
        }
    });

    describe("初始化", () => {
        it("应该成功初始化", async () => {
            await eventService.init();

            expect(mockRedisService.init).toHaveBeenCalled();
            expect(mockRedisService.waitForReady).toHaveBeenCalledWith(5000);
        });

        it("当 Redis 未启用时应该抛出错误", async () => {
            mockConfigManagerService.getCurrentConfig.mockResolvedValueOnce({
                commonDatabase: {
                    redis: {
                        enabled: false,
                        enablePubSub: true
                    }
                }
            });

            await expect(eventService.init()).rejects.toThrow("事件服务依赖 Redis，但 Redis 未启用");
        });

        it("当 Redis PubSub 未启用时应该抛出错误", async () => {
            mockConfigManagerService.getCurrentConfig.mockResolvedValueOnce({
                commonDatabase: {
                    redis: {
                        enabled: true,
                        enablePubSub: false
                    }
                }
            });

            await expect(eventService.init()).rejects.toThrow("事件服务依赖 Redis 发布订阅功能");
        });

        it("当 Redis 连接超时时应该抛出错误", async () => {
            mockRedisService.waitForReady.mockResolvedValueOnce(false);

            await expect(eventService.init()).rejects.toThrow("Redis 连接超时");
        });

        it("应该支持传入配置选项", async () => {
            await eventService.init({
                defaultTTL: 60000,
                enableAck: true
            });

            expect(mockRedisService.init).toHaveBeenCalled();
        });
    });

    describe("发布消息", () => {
        beforeEach(async () => {
            await eventService.init();
        });

        it("应该能够发布对象消息", async () => {
            const data = { userId: "123", message: "test" };
            const count = await eventService.publish("test:event", data);

            expect(count).toBe(1);
            expect(mockRedisPublish).toHaveBeenCalledWith("test:event", expect.any(String));
        });

        it("应该能够发布原始字符串消息", async () => {
            const message = "raw message";
            const count = await eventService.publishRaw("test:channel", message);

            expect(count).toBe(1);
            expect(mockRedisPublish).toHaveBeenCalledWith("test:channel", message);
        });

        it("应该能够使用 emit 别名发布消息", async () => {
            const data = { test: "data" };

            await eventService.emit("test:event", data);

            expect(mockRedisPublish).toHaveBeenCalled();
        });

        it("应该能够发布带 TTL 的消息", async () => {
            const data = { test: "data" };

            await eventService.publish("test:event", data, 10000);

            expect(mockRedisPublish).toHaveBeenCalled();
            expect(mockRedisService.set).toHaveBeenCalled();
        });
    });

    describe("订阅消息", () => {
        beforeEach(async () => {
            await eventService.init();
        });

        it("应该能够订阅消息", async () => {
            const handler = vi.fn();

            await eventService.subscribe("test:event", handler);

            expect(mockRedisSubscribe).toHaveBeenCalledWith("test:event", expect.any(Function));
            expect(eventService.isSubscribed("test:event")).toBe(true);
        });

        it("应该能够使用 on 别名订阅消息", async () => {
            const handler = vi.fn();

            await eventService.on("test:event", handler);

            expect(mockRedisSubscribe).toHaveBeenCalled();
        });

        it("应该能够接收并处理消息", async () => {
            const handler = vi.fn();

            await eventService.subscribe<{ message: string }>("test:event", handler);

            // 模拟收到消息
            const data = { message: "hello" };
            const eventData = {
                channel: "test:event",
                data,
                timestamp: Date.now()
            };
            const serialized = JSON.stringify({
                json: eventData,
                meta: {}
            });

            const redisHandler = subscribedHandlers.get("test:event");

            if (redisHandler) {
                redisHandler("test:event", serialized);
            }

            // 等待异步处理
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(handler).toHaveBeenCalledWith(data, expect.objectContaining({ channel: "test:event", data }));
        });

        it("应该能够订阅原始字符串消息", async () => {
            const handler = vi.fn();

            await eventService.subscribeRaw("test:channel", handler);

            expect(mockRedisSubscribe).toHaveBeenCalled();
        });

        it("应该能够一次性订阅消息", async () => {
            const handler = vi.fn();

            await eventService.once("test:event", handler);

            expect(eventService.isSubscribed("test:event")).toBe(true);

            // 模拟收到第一条消息
            const eventData = {
                channel: "test:event",
                data: { test: "data1" },
                timestamp: Date.now()
            };
            const serialized = JSON.stringify({
                json: eventData,
                meta: {}
            });
            const redisHandler = subscribedHandlers.get("test:event");

            if (redisHandler) {
                redisHandler("test:event", serialized);
            }

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(handler).toHaveBeenCalledTimes(1);

            // 模拟收到第二条消息（应该不会触发处理器）
            if (redisHandler) {
                redisHandler("test:event", serialized);
            }

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(handler).toHaveBeenCalledTimes(1); // 仍然是 1 次
        });
    });

    describe("取消订阅", () => {
        beforeEach(async () => {
            await eventService.init();
        });

        it("应该能够取消订阅", async () => {
            const handler = vi.fn();

            await eventService.subscribe("test:event", handler);
            await eventService.unsubscribe("test:event");

            expect(mockRedisUnsubscribe).toHaveBeenCalledWith("test:event");
            expect(eventService.isSubscribed("test:event")).toBe(false);
        });

        it("应该能够使用 off 别名取消订阅", async () => {
            const handler = vi.fn();

            await eventService.on("test:event", handler);
            await eventService.off("test:event");

            expect(mockRedisUnsubscribe).toHaveBeenCalled();
        });

        it("应该能够取消特定处理器的订阅", async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            await eventService.subscribe("test:event", handler1);
            await eventService.subscribe("test:event", handler2);

            expect(eventService.getSubscriberCount("test:event")).toBe(2);

            await eventService.unsubscribe("test:event", handler1);

            expect(eventService.getSubscriberCount("test:event")).toBe(1);
            expect(eventService.isSubscribed("test:event")).toBe(true);
        });
    });

    describe("通配符订阅", () => {
        beforeEach(async () => {
            await eventService.init();
        });

        it("应该能够订阅通配符模式", async () => {
            const handler = vi.fn();

            await eventService.subscribe("test:*", handler);

            expect(eventService.isSubscribed("test:anything")).toBe(true);
        });

        it("应该能够匹配通配符模式", async () => {
            const handler = vi.fn();

            await eventService.subscribe("order:*", handler);

            expect(eventService.isSubscribed("order:created")).toBe(true);
            expect(eventService.isSubscribed("order:paid")).toBe(true);
            expect(eventService.isSubscribed("user:login")).toBe(false);
        });

        it("应该能够取消通配符订阅", async () => {
            const handler = vi.fn();

            await eventService.subscribe("test:*", handler);
            await eventService.unsubscribe("test:*");

            expect(eventService.isSubscribed("test:anything")).toBe(false);
        });
    });

    describe("工具方法", () => {
        beforeEach(async () => {
            await eventService.init();
        });

        it("应该能够获取订阅的频道列表", async () => {
            await eventService.subscribe("event1", vi.fn());
            await eventService.subscribe("event2", vi.fn());
            await eventService.subscribe("event:*", vi.fn());

            const channels = eventService.getSubscribedChannels();

            expect(channels).toContain("event1");
            expect(channels).toContain("event2");
            expect(channels).toContain("event:*");
        });

        it("应该能够检查订阅状态", async () => {
            await eventService.subscribe("test:event", vi.fn());

            expect(eventService.isSubscribed("test:event")).toBe(true);
            expect(eventService.isSubscribed("other:event")).toBe(false);
        });

        it("应该能够获取订阅者数量", async () => {
            await eventService.subscribe("test:event", vi.fn());
            await eventService.subscribe("test:event", vi.fn());

            expect(eventService.getSubscriberCount("test:event")).toBe(2);
        });

        it("应该能够等待特定事件", async () => {
            const promise = eventService.waitForEvent<{ data: string }>("test:event", 1000);

            // 模拟在稍后触发事件
            setTimeout(async () => {
                await eventService.emit("test:event", { data: "result" });

                // 手动触发处理器
                const eventData = {
                    channel: "test:event",
                    data: { data: "result" },
                    timestamp: Date.now()
                };
                const serialized = JSON.stringify({
                    json: eventData,
                    meta: {}
                });
                const redisHandler = subscribedHandlers.get("test:event");

                if (redisHandler) {
                    redisHandler("test:event", serialized);
                }
            }, 100);

            const result = await promise;

            expect(result).toEqual({ data: "result" });
        });

        it("等待事件超时时应该抛出错误", async () => {
            await expect(eventService.waitForEvent("test:event", 100)).rejects.toThrow("等待事件");
        });
    });

    describe("错误处理", () => {
        beforeEach(async () => {
            await eventService.init();
        });

        it("处理器中的错误不应该影响其他处理器", async () => {
            const handler1 = vi.fn().mockImplementation(() => {
                throw new Error("handler1 error");
            });
            const handler2 = vi.fn();

            await eventService.subscribe("test:event", handler1);
            await eventService.subscribe("test:event", handler2);

            // 模拟收到消息
            const eventData = {
                channel: "test:event",
                data: { test: "data" },
                timestamp: Date.now()
            };
            const serialized = JSON.stringify({
                json: eventData,
                meta: {}
            });
            const redisHandler = subscribedHandlers.get("test:event");

            if (redisHandler) {
                redisHandler("test:event", serialized);
            }

            await new Promise(resolve => setTimeout(resolve, 10));

            // handler2 应该仍然被调用
            expect(handler2).toHaveBeenCalled();
        });
    });

    describe("资源清理", () => {
        beforeEach(async () => {
            await eventService.init();
        });

        it("dispose 应该取消所有订阅", async () => {
            await eventService.subscribe("event1", vi.fn());
            await eventService.subscribe("event2", vi.fn());

            expect(eventService.getSubscribedChannels().length).toBe(2);

            await eventService.dispose();

            expect(mockRedisUnsubscribe).toHaveBeenCalled();
        });
    });
});
