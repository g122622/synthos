import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { ProcessedChatMessageWithRawMessage } from "@root/common/contracts/data-provider";
import getRandomHash from "@root/common/util/math/getRandomHash";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import ErrorReasons from "@root/common/contracts/ErrorReasons";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

import { COMMON_TOKENS } from "../di/tokens";

import { ISplitter } from "./contracts/ISplitter";

/**
 * 累积式消息分割器
 * 按照消息数量或字符数量累积分组
 *
 * 容量追踪采用「内存 Map + 单次 DB 现算」方案，单一数据源为 SQLite，
 * 不再依赖外置 KVStore，从而消除了「chat_messages.sessionId 与 KVStore 两份
 * 持久化存储跨 run 失配」导致的断言失败（见原 line 93 ASSERT）。
 */
@injectable()
@mustInitBeforeUse
export class AccumulativeSplitter extends Disposable implements ISplitter {
    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService
    ) {
        super();
    }

    /**
     * 初始化分割器
     */
    public async init() {
        // 容量追踪已改为内存 Map + DB 现算，无外部资源需要初始化
    }

    /**
     * 为消息分配 sessionId
     * @param groupId 群组 ID
     * @param startTimeStamp 开始时间戳
     * @param endTimeStamp 结束时间戳
     * @returns 带有 sessionId 的消息列表
     */
    public async assignSessionId(groupId: string, startTimeStamp: number, endTimeStamp: number) {
        await this.imDbAccessService.init(); // TODO : 临时解决方案，确保数据库已初始化
        const config = (await this.configManagerService.getCurrentConfig()).preprocessors.AccumulativeSplitter;

        // 容量缓存：key=sessionId，value=当前累计容量
        // - 本轮新开的 session：assignNewSessionId 时直接写入，0 次 DB 查询
        // - 从 DB 带出的旧 session：首次遇到时现算 1 次，后续命中缓存
        // 单轮 DB 查询次数 ≈ 本轮触及的「旧 session」数量（通常仅 1 个）
        const capacityCache = new Map<string, number>();

        const getCapacity = async (sessionId: string): Promise<number> => {
            const cached = capacityCache.get(sessionId);

            if (cached !== undefined) {
                return cached;
            }
            const capacity = await this.imDbAccessService.getSessionCapacity(sessionId, config.mode);

            capacityCache.set(sessionId, capacity);

            return capacity;
        };

        const assignNewSessionId = async (msg: ProcessedChatMessageWithRawMessage) => {
            // 为其分配一个新的 sessionId
            msg.sessionId = getRandomHash(16); // 生成新的 sessionId
            const initialCapacity =
                config.mode === "charCount"
                    ? msg.messageContent!.length
                    : config.mode === "messageCount"
                      ? 1
                      : (() => {
                            throw ErrorReasons.INVALID_VALUE_ERROR;
                        })();

            capacityCache.set(msg.sessionId!, initialCapacity); // 本轮新开 session 容量已知，无需回查 DB
        };

        const appendToPreviousSession = async (
            msg: ProcessedChatMessageWithRawMessage,
            previousSessionId: string,
            previousCapacity: number
        ) => {
            msg.sessionId = previousSessionId; // 分配上一个 sessionId
            const newCapacity =
                config.mode === "charCount"
                    ? previousCapacity + msg.messageContent!.length
                    : config.mode === "messageCount"
                      ? previousCapacity + 1
                      : (() => {
                            throw ErrorReasons.INVALID_VALUE_ERROR;
                        })();

            capacityCache.set(previousSessionId, newCapacity); // 更新容量缓存
        };

        const isCapacityFull = (capacity: number) =>
            (config.mode === "charCount" && capacity >= config.maxCharCount) ||
            (config.mode === "messageCount" && capacity >= config.maxMessageCount);

        const msgs = await this.imDbAccessService.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
            groupId,
            startTimeStamp,
            endTimeStamp
        );

        for (let index = 0; index < msgs.length; index++) {
            const msg = msgs[index];

            if (!msg.sessionId) {
                if (index === 0) {
                    // 第一条消息，为其分配一个新的 sessionId
                    await assignNewSessionId(msg);
                } else {
                    const previousMsgSessionId = msgs[index - 1].sessionId!; // 上一条消息的 sessionId 一定存在
                    const capacity = await getCapacity(previousMsgSessionId); // 现算或命中缓存

                    if (isCapacityFull(capacity)) {
                        // 上一个 sessionId 的容量已满，为这条消息分配一个新的 sessionId
                        await assignNewSessionId(msg);
                    } else {
                        // 上一个 sessionId 的容量未满，续接上一个 sessionId 并更新容量
                        await appendToPreviousSession(msg, previousMsgSessionId, capacity);
                    }
                }
            }
        }

        return msgs;
    }
}
