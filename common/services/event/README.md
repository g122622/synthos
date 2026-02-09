# EventService - 微服务间事件通信服务

EventService 是基于 Redis 发布订阅功能封装的微服务间事件通信服务，提供简单易用的事件发布订阅能力。

## 特性

- ✅ **类型化消息**：完整的 TypeScript 泛型支持，自动序列化/反序列化
- ✅ **原始消息支持**：支持发布和订阅原始字符串消息
- ✅ **通配符订阅**：支持使用 `*` 和 `?` 进行模式匹配
- ✅ **一次性监听**：`once` 方法支持触发后自动取消订阅
- ✅ **Promise 等待**：`waitForEvent` 方法支持以 Promise 形式等待事件
- ✅ **消息过期**：支持为消息设置 TTL（Time To Live）
- ✅ **多处理器**：同一事件可注册多个处理器
- ✅ **错误隔离**：单个处理器错误不影响其他处理器执行
- ✅ **别名方法**：提供 `emit/on/off` 作为 `publish/subscribe/unsubscribe` 的别名

## 依赖

EventService 依赖以下服务：

- **RedisService**：Redis 客户端服务（需启用 PubSub 功能）
- **ConfigManagerService**：配置管理服务

## 配置要求

在 `synthos_config.json` 中需要启用 Redis 和 PubSub 功能：

```json
{
  "commonDatabase": {
    "redis": {
      "enabled": true,
      "enablePubSub": true,
      "connection": {
        "host": "localhost",
        "port": 6379
      }
    }
  }
}
```

## 使用方法

### 1. 基础用法

```typescript
import "reflect-metadata";
import { container } from "tsyringe";
import { EventService } from "@root/common/services/event/EventService";
import { COMMON_TOKENS } from "@root/common/di/tokens";

// 获取 EventService 实例
const eventService = container.resolve<EventService>(COMMON_TOKENS.EventService);

// 初始化服务
await eventService.init();

// 订阅事件
await eventService.subscribe<{ message: string }>("user:login", data => {
    console.log("用户登录:", data.message);
});

// 发布事件
await eventService.publish("user:login", { message: "用户123登录成功" });

// 取消订阅
await eventService.unsubscribe("user:login");
```

### 2. 使用别名方法（更直观）

```typescript
// 使用 on/emit/off 别名
await eventService.on("user:login", data => {
    console.log("用户登录:", data);
});

await eventService.emit("user:login", { userId: "123" });

await eventService.off("user:login");
```

### 3. 类型化消息

```typescript
interface OrderCreatedEvent {
    orderId: string;
    userId: string;
    amount: number;
}

// 订阅带类型的事件
await eventService.subscribe<OrderCreatedEvent>("order:created", data => {
    console.log(`订单创建: ${data.orderId}, 金额: ${data.amount}`);
    // TypeScript 能够识别 data 的类型
});

// 发布带类型的事件
await eventService.publish<OrderCreatedEvent>("order:created", {
    orderId: "ORD-001",
    userId: "USER-123",
    amount: 99.99
});
```

### 4. 通配符订阅

```typescript
// 订阅所有以 "order:" 开头的事件
await eventService.subscribe("order:*", (data, event) => {
    console.log(`收到订单相关事件: ${event.channel}`, data);
});

// 这些都会被捕获
await eventService.emit("order:created", { orderId: "001" });
await eventService.emit("order:paid", { orderId: "001" });
await eventService.emit("order:shipped", { orderId: "001" });
```

### 5. 一次性监听

```typescript
// 只监听一次，触发后自动取消订阅
await eventService.once<{ taskId: string }>("task:completed", data => {
    console.log(`任务完成: ${data.taskId}`);
});

// 第一次触发会执行处理器
await eventService.emit("task:completed", { taskId: "TASK-001" });

// 第二次触发不会执行处理器（已自动取消订阅）
await eventService.emit("task:completed", { taskId: "TASK-002" });
```

### 6. 等待特定事件

```typescript
// 等待事件发生（Promise 形式）
try {
    const data = await eventService.waitForEvent<{ dataId: string }>("data:ready", 5000);
    console.log(`数据准备完成: ${data.dataId}`);
} catch (err) {
    console.error("等待超时:", err);
}
```

### 7. 原始字符串消息

```typescript
// 订阅原始字符串消息
await eventService.subscribeRaw("log:message", (message, channel) => {
    console.log(`[${channel}] ${message}`);
});

// 发布原始字符串消息
await eventService.publishRaw("log:message", "这是一条日志消息");
```

### 8. 带过期时间的消息

```typescript
// 发布带过期时间的消息（10秒后过期）
await eventService.publish("cache:invalidate", { key: "user:123" }, 10000);
```

## 跨微服务通信示例

### 微服务 A: 数据处理服务

```typescript
const eventService = container.resolve<EventService>(COMMON_TOKENS.EventService);
await eventService.init();

// 监听数据处理请求
await eventService.subscribe<{ dataId: string; type: string }>("data:process:request", async data => {
    console.log(`开始处理数据: ${data.dataId}`);
    
    // 模拟数据处理
    await processData(data.dataId, data.type);
    
    // 发送处理完成事件
    await eventService.emit("data:process:completed", {
        dataId: data.dataId,
        result: "处理成功",
        timestamp: Date.now()
    });
});
```

### 微服务 B: API 服务

```typescript
const eventService = container.resolve<EventService>(COMMON_TOKENS.EventService);
await eventService.init();

// 发起数据处理请求
await eventService.emit("data:process:request", {
    dataId: "DATA-001",
    type: "analyze"
});

// 等待处理结果
const result = await eventService.waitForEvent<{ dataId: string; result: string }>(
    "data:process:completed",
    30000
);

console.log(`数据处理结果:`, result);
```

## API 参考

### 发布方法

#### `publish<T>(channel: string, data: T, ttl?: number): Promise<number>`

发布事件消息（对象自动序列化）

- **channel**: 频道名称
- **data**: 事件数据（会使用 SuperJSON 序列化）
- **ttl**: 可选的过期时间（毫秒）
- **返回**: 收到消息的订阅者数量

#### `publishRaw(channel: string, message: string): Promise<number>`

发布原始字符串消息（不进行序列化）

#### `emit<T>(event: string, data: T, ttl?: number): Promise<number>`

`publish` 的别名方法

### 订阅方法

#### `subscribe<T>(channel: string, handler: EventHandler<T>): Promise<void>`

订阅事件（对象自动反序列化）

- **channel**: 频道名称或通配符模式（如 `order:*`）
- **handler**: 事件处理器函数

#### `subscribeRaw(channel: string, handler: (message: string, channel: string) => void): Promise<void>`

订阅原始字符串消息（不进行反序列化）

#### `once<T>(channel: string, handler: EventHandler<T>): Promise<void>`

订阅事件一次（触发后自动取消订阅）

#### `on<T>(event: string, handler: EventHandler<T>): Promise<void>`

`subscribe` 的别名方法

### 取消订阅方法

#### `unsubscribe(channel: string, handler?: EventHandler<any>): Promise<void>`

取消订阅

- **channel**: 频道名称
- **handler**: 可选的处理器，如果不提供则取消该频道的所有订阅

#### `off(event: string, handler?: EventHandler<any>): Promise<void>`

`unsubscribe` 的别名方法

### 工具方法

#### `getSubscribedChannels(): string[]`

获取当前所有订阅的频道列表

#### `isSubscribed(channel: string): boolean`

检查是否订阅了某个频道（支持通配符匹配）

#### `getSubscriberCount(channel: string): number`

获取某个频道的订阅者数量

#### `waitForEvent<T>(channel: string, timeout: number): Promise<T>`

等待特定事件（Promise 形式）

- **channel**: 频道名称
- **timeout**: 超时时间（毫秒），0 表示永不超时
- **返回**: 事件数据的 Promise

## 类型定义

### EventData<T>

事件消息数据接口

```typescript
interface EventData<T = unknown> {
    /** 事件频道 */
    channel: string;
    /** 事件数据 */
    data: T;
    /** 发送时间戳（毫秒） */
    timestamp: number;
    /** 消息ID（可选） */
    messageId?: string;
}
```

### EventHandler<T>

事件处理器类型

```typescript
type EventHandler<T = unknown> = (data: T, event: EventData<T>) => void | Promise<void>;
```

## 注意事项

1. **必须初始化**：使用 EventService 前必须调用 `init()` 方法
2. **依赖 Redis**：EventService 依赖 Redis 的发布订阅功能，确保 Redis 已启用且配置正确
3. **错误处理**：事件处理器中的错误会被捕获并记录日志，不会影响其他处理器
4. **资源清理**：使用完毕后调用 `dispose()` 方法清理资源
5. **通配符性能**：大量使用通配符订阅可能影响性能，建议精确订阅

## 完整示例

查看 [EventService.example.ts](./EventService.example.ts) 获取更多使用示例。

## 测试

运行单元测试：

```bash
npx vitest run common/test/EventService.test.ts
```

## 相关服务

- [RedisService](../redis/RedisService.ts) - Redis 客户端服务
- [ConfigManagerService](../config/ConfigManagerService.ts) - 配置管理服务
