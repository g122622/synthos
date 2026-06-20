import { RawChatMessage } from "@root/common/contracts/data-provider/index";

// ==================== Worker 初始化配置 ====================

/**
 * 传给 Worker 的初始化配置
 */
export interface WorkerConfig {
    dbPath: string;
    dbKey: string;
    VFSExtPath: string;
    patchSQL: string;
    protoFilePath: string;
    cipherPageSize: number;
    kdfIter: number;
    cipherHmacAlgorithm: string;
    cipherKdfAlgorithm: string;
}

// ==================== 主线程 → Worker 消息 ====================

/** 初始化 Worker 的 DB 连接 */
export interface WorkerInitMessage {
    type: "init";
    config: WorkerConfig;
}

/** 执行查询任务 */
export interface WorkerQueryMessage {
    type: "query";
    taskId: string;
    timeStart: number; // 毫秒级时间戳
    timeEnd: number; // 毫秒级时间戳
    groupId: string; // 空字符串表示所有群组
}

/** 优雅关闭 Worker */
export interface WorkerShutdownMessage {
    type: "shutdown";
}

/** 主线程 → Worker 的所有消息类型 */
export type MainToWorkerMessage = WorkerInitMessage | WorkerQueryMessage | WorkerShutdownMessage;

// ==================== Worker → 主线程消息 ====================

/** Worker 初始化成功 */
export interface WorkerReadyMessage {
    type: "ready";
}

/** 查询成功返回结果 */
export interface WorkerQueryResultMessage {
    type: "query_result";
    taskId: string;
    data: RawChatMessage[];
}

/** 查询失败 */
export interface WorkerQueryErrorMessage {
    type: "query_error";
    taskId: string;
    error: string;
}

/** Worker 遇到不可恢复的错误（如初始化失败） */
export interface WorkerFatalErrorMessage {
    type: "fatal_error";
    error: string;
}

/** Worker 优雅关闭完成 */
export interface WorkerShutdownCompleteMessage {
    type: "shutdown_complete";
}

/** Worker → 主线程的所有消息类型 */
export type WorkerToMainMessage =
    | WorkerReadyMessage
    | WorkerQueryResultMessage
    | WorkerQueryErrorMessage
    | WorkerFatalErrorMessage
    | WorkerShutdownCompleteMessage;
