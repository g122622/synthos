/**
 * 事件消息数据接口
 */
export interface EventData<T = unknown> {
    /** 事件频道 */
    channel: string;
    /** 事件数据 */
    data: T;
    /** 发送时间戳（毫秒） */
    timestamp: number;
    /** 消息ID（可选，用于追踪） */
    messageId?: string;
}

/**
 * 事件处理器类型
 */
export type EventHandler<T = unknown> = (data: T, event: EventData<T>) => void | Promise<void>;

/**
 * 事件服务配置
 */
export interface EventServiceOptions {
    /** 消息默认过期时间（毫秒），0 表示不过期 */
    defaultTTL?: number;
    /** 是否启用消息确认 */
    enableAck?: boolean;
}
