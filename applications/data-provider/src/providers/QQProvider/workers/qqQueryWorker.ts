/**
 * QQProvider 查询 Worker 线程脚本
 *
 * 每个 Worker 持有独立的数据库连接和 protobuf 解析器，
 * 接收主线程的查询任务并返回结果。
 *
 * 通信协议见 types.ts
 */

import type { MainToWorkerMessage, WorkerConfig, WorkerToMainMessage } from "./types";

import { parentPort } from "node:worker_threads";
import { readFile } from "fs/promises";

import sqlite3 from "@journeyapps/sqlcipher";
import { RawChatMessage } from "@root/common/contracts/data-provider/index";

import { GroupMsgColumn as GMC } from "../@types/mappers/GroupMsgColumn";
import { MsgType } from "../@types/mappers/MsgType";
import { MsgElementType } from "../@types/mappers/MsgElementType";
import { MsgElement, RawMsgContentParseResult } from "../@types/RawMsgContentParseResult";

// ==================== 内联 PromisifiedSQLite（Worker 中无法使用 DI，直接内联） ====================

class PromisifiedStatement {
    private statement: any;

    constructor(statement: any) {
        this.statement = statement;
    }

    public async get(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.statement.get((err: Error | null, row: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    public async finalize(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.statement.finalize((err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

class PromisifiedSQLite {
    private sqlite3: any;
    private db: any;

    constructor(sqlite3Module: any) {
        this.sqlite3 = sqlite3Module;
        this.db = null;
    }

    public open(DBFilePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db = new this.sqlite3.Database(DBFilePath, (err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public loadExtension(extensionPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.loadExtension(extensionPath, (err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public exec(sql: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public prepare(sql: string): Promise<PromisifiedStatement> {
        return new Promise((resolve, reject) => {
            const statement = this.db.prepare(sql, (err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(new PromisifiedStatement(statement));
                }
            });
        });
    }

    public all(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err: Error | null, rows: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    public close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close((err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

// ==================== 内联 MessagePBParser（Worker 线程中独立实例化） ====================

let messageSegment: any = undefined;
let protobuf: any = null;

async function initMessagePBParser(protoFilePath: string): Promise<void> {
    // 动态导入 protobufjs
    try {
        const protobufModule = await import("protobufjs");

        protobuf = protobufModule.default || protobufModule;
    } catch (error) {
        throw new Error(`Worker: Failed to import protobufjs: ${error}`);
    }

    // 读取 .proto 文件
    let protoContent: string | undefined;

    try {
        protoContent = await readFile(protoFilePath, "utf8");
    } catch (error) {
        throw new Error(`Worker: Failed to read proto file at ${protoFilePath}: ${error}`);
    }
    if (!protoContent) {
        throw new Error("Worker: Proto file content is empty");
    }

    // 解析 proto
    let root;

    try {
        if (typeof protobuf.parse === "function") {
            const parseResult = protobuf.parse(protoContent);

            root = parseResult.root;
        } else if (typeof protobuf.load === "function") {
            root = await new Promise((resolve, reject) => {
                protobuf.load(protoContent, (err: any, r: unknown) => {
                    if (err) reject(err);
                    else resolve(r);
                });
            });
        } else if (protobuf.Root) {
            root = new protobuf.Root();
            protobuf.parse(protoContent, root);
        } else {
            throw new Error("No available protobuf parsing method found");
        }
    } catch (error) {
        // 备选方案
        try {
            const { parse } = await import("protobufjs");
            const parseResult = parse(protoContent);

            root = parseResult.root;
        } catch (fallbackError) {
            throw new Error(`Worker: All protobuf parsing methods failed: ${fallbackError}`);
        }
    }

    messageSegment = root.lookupType("Message");
    if (!messageSegment) {
        throw new Error("Worker: Failed to lookup Message type");
    }
}

function parseMessageSegment(buffer: Buffer): RawMsgContentParseResult {
    if (!messageSegment || !protobuf) {
        throw new Error("Worker: MessagePBParser not initialized");
    }

    const errMsg = messageSegment.verify(buffer);

    if (errMsg) {
        throw new Error(`Worker: Protobuf verify error: ${errMsg}`);
    }

    const message = messageSegment.decode(buffer);
    const plain = messageSegment.toObject(message, {
        longs: String,
        enums: String,
        bytes: String,
        defaults: true,
        arrays: true,
        objects: true
    });

    return plain as RawMsgContentParseResult;
}

// ==================== 消息解析逻辑（从 QQProvider 搬入） ====================

function parseMessageContent(rawMsgElements: MsgElement[]): string {
    let result = "";

    for (const rawMsgElement of rawMsgElements) {
        switch (rawMsgElement.elementType) {
            case MsgElementType.TEXT: {
                result += rawMsgElement.messageText;
                break;
            }
            case MsgElementType.EMOJI:
            case MsgElementType.EMOJI_NEW: {
                if (rawMsgElement.emojiText) {
                    result += `[${rawMsgElement.emojiText}]`;
                }
                break;
            }
            case MsgElementType.IMAGE: {
                if (rawMsgElement.imageText) {
                    result += rawMsgElement.imageText;
                } else {
                    result += `[图片]`;
                }
                break;
            }
            case MsgElementType.VOICE: {
                result += `[语音]`;
                break;
            }
            case MsgElementType.FILE: {
                result += `[文件][文件名：${rawMsgElement.fileName}]`;
                break;
            }
            default: {
                // 忽略其他类型的消息
                break;
            }
        }
    }

    return result;
}

// ==================== Worker 状态 ====================

let db: PromisifiedSQLite | null = null;
let patchSQL = "";

// 是否有查询正在执行（用于优雅关闭：关闭流程必须等待查询完成后再关闭 DB）
let queryInProgress = false;
// 是否有待处理的关闭请求（查询完成后再执行）
let shutdownPending = false;

function post(msg: WorkerToMainMessage): void {
    if (parentPort) {
        parentPort.postMessage(msg);
    }
}

// ==================== 消息处理 ====================

async function handleInit(config: WorkerConfig): Promise<void> {
    sqlite3.verbose();

    patchSQL = config.patchSQL;

    // 1. 通过临时内存数据库加载 VFS 扩展（全局注册）
    const tempDb = new PromisifiedSQLite(sqlite3);

    await tempDb.open(":memory:");
    await tempDb.loadExtension(config.VFSExtPath);
    await tempDb.close();

    // 2. 打开实际数据库连接
    db = new PromisifiedSQLite(sqlite3);
    await db.open(config.dbPath);

    // 3. 加密配置
    await db.exec(`
        PRAGMA key = '${config.dbKey}';
        PRAGMA cipher_page_size = ${config.cipherPageSize};
        PRAGMA kdf_iter = ${config.kdfIter};
        PRAGMA cipher_hmac_algorithm = ${config.cipherHmacAlgorithm};
        PRAGMA cipher_kdf_algorithm = ${config.cipherKdfAlgorithm};
        PRAGMA busy_timeout = 5000;
    `);

    // 4. 验证解密是否成功
    const stmt = await db.prepare("SELECT count(*) FROM sqlite_master");
    const result = await stmt.get();

    await stmt.finalize();

    // 5. 初始化 protobuf 解析器
    await initMessagePBParser(config.protoFilePath);

    post({ type: "ready" });
}

async function handleQuery(msg: {
    taskId: string;
    timeStart: number;
    timeEnd: number;
    groupId: string;
}): Promise<void> {
    if (!db) {
        post({ type: "query_error", taskId: msg.taskId, error: "Worker not initialized" });

        return;
    }

    queryInProgress = true;
    try {
        // 转换为秒级时间戳
        const timeStartSec = Math.floor(msg.timeStart / 1000);
        const timeEndSec = Math.ceil(msg.timeEnd / 1000);

        // 生成 SQL
        const sql = `
            SELECT
                CAST("${GMC.msgId}" AS TEXT) AS "${GMC.msgId}",
                "${GMC.msgTime}",
                "${GMC.groupUin}",
                "${GMC.senderUin}",
                "${GMC.replyMsgSeq}",
                "${GMC.msgContent}",
                "${GMC.sendMemberName}",
                "${GMC.sendNickName}",
                "${GMC.msgType}",
                "${GMC.extraData}"
            FROM group_msg_table
            WHERE ${patchSQL}
            AND ("${GMC.msgTime}" BETWEEN ${timeStartSec} AND ${timeEndSec})
            ${msg.groupId ? `AND "${GMC.groupUin}" = ${msg.groupId}` : ""}
        `;

        const results = await db.all(sql);

        // 解析查询到的全部消息内容
        const messages: RawChatMessage[] = [];

        for (const result of results) {
            const processedMsg: RawChatMessage = {
                msgId: String(result[GMC.msgId]),
                messageContent: "",
                groupId: String(result[GMC.groupUin]),
                timestamp: result[GMC.msgTime] * 1000, // 转换为毫秒级时间戳
                senderId: String(result[GMC.senderUin]),
                senderGroupNickname: result[GMC.sendMemberName],
                senderNickname: result[GMC.sendNickName]
            };

            // 处理引用消息
            if (result[GMC.msgType] === MsgType.REPLY) {
                try {
                    const quotedMsgContent = parseMessageContent(
                        parseMessageSegment(result[GMC.extraData]).extraMessage.messages
                    );

                    if (!quotedMsgContent) {
                        // 引用消息内容为空，忽略
                    } else {
                        processedMsg.quotedMsgContent = quotedMsgContent;
                    }
                } catch (error) {
                    // protobuf 解析出错或内容为空，忽略引用部分
                }
            }

            // 获取消息正文
            try {
                processedMsg.messageContent = parseMessageContent(
                    parseMessageSegment(result[GMC.msgContent]).messages
                );
            } catch (error) {
                // protobuf 解析出错，放弃该条消息
                continue;
            }

            if (processedMsg.messageContent === "") {
                // 消息内容为空，忽略
            } else {
                messages.push(processedMsg);
            }
        }

        post({ type: "query_result", taskId: msg.taskId, data: messages });
    } catch (error: any) {
        post({ type: "query_error", taskId: msg.taskId, error: error?.message ?? String(error) });
    } finally {
        // 查询已结束，清除进行中标志
        queryInProgress = false;

        // 若关闭流程在查询期间到达，现在安全执行关闭
        if (shutdownPending) {
            shutdownPending = false;
            await handleShutdown();
        }
    }
}

async function handleShutdown(): Promise<void> {
    // 若有查询正在进行，延迟关闭到查询结束（在 handleQuery 的 finally 中触发）
    // 这样可以避免在 db.all() 仍在执行时关闭 DB 连接，导致 N-API 资源处于不一致状态
    if (queryInProgress) {
        shutdownPending = true;

        return;
    }

    if (db) {
        try {
            await db.close();
        } catch {
            // 忽略关闭错误
        }
        db = null;
    }
    messageSegment = undefined;
    protobuf = null;
    post({ type: "shutdown_complete" });

    // 主动退出 Worker 线程。
    // 关键：此时 db.close() 已完成、查询已结束，N-API 原生代码不再活跃，
    // 因此退出是安全的（不会触发 napi_fatal_error）。
    // 必须主动退出，否则 @journeyapps/sqlcipher 的原生资源会保持事件循环活跃，
    // Worker 永远不会自然退出，导致主线程的关闭流程一直等待直到超时。
    //
    // 用 setImmediate 让事件循环再走一轮，确保 postMessage 的 shutdown_complete
    // 已派发、原生模块的收尾回调已排空后再退出。
    setImmediate(() => process.exit(0));
}

// ==================== 消息监听 ====================

if (parentPort) {
    parentPort.on("message", async (msg: MainToWorkerMessage) => {
        switch (msg.type) {
            case "init": {
                try {
                    await handleInit(msg.config);
                } catch (error: any) {
                    post({ type: "fatal_error", error: error?.message ?? String(error) });
                }
                break;
            }
            case "query": {
                await handleQuery(msg);
                break;
            }
            case "shutdown": {
                await handleShutdown();
                break;
            }
        }
    });
}
