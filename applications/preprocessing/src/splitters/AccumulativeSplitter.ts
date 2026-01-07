import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { ProcessedChatMessageWithRawMessage } from "@root/common/contracts/data-provider";
import { ISplitter } from "./contracts/ISplitter";
import getRandomHash from "@root/common/util/getRandomHash";
import { KVStore } from "@root/common/util/KVStore";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { getMinutesAgoTimestamp } from "@root/common/util/TimeUtils";
import { ASSERT } from "@root/common/util/ASSERT";
import ErrorReasons from "@root/common/contracts/ErrorReasons";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { PREPROCESSING_TOKENS } from "../di/tokens";

/**
 * 累积式消息分割器
 * 按照消息数量或字符数量累积分组
 */
@injectable()
@mustInitBeforeUse
export class AccumulativeSplitter extends Disposable implements ISplitter {
    private kvStore: KVStore<number> | null = null; // 用于存储 sessionId 的 KV 存储

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(PREPROCESSING_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {
        super();
    }

    /**
     * 初始化分割器
     */
    public async init() {
        const config = (await this.configManagerService.getCurrentConfig()).preprocessors.AccumulativeSplitter;
        this.kvStore = new KVStore(config.persistentKVStorePath); // 初始化 KV 存储
        this._registerDisposable(this.kvStore); // 注册 Disposable 函数，用于释放资源
    }

    /**
     * 为消息分配 sessionId
     * @param imDbAccessService IM 数据库访问服务
     * @param groupId 群组 ID
     * @param startTimeStamp 开始时间戳
     * @param endTimeStamp 结束时间戳
     * @returns 带有 sessionId 的消息列表
     */
    public async assignSessionId(
        imDbAccessService: ImDbAccessService,
        groupId: string,
        startTimeStamp: number,
        endTimeStamp: number
    ) {
        if (!this.kvStore) {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }
        const config = (await this.configManagerService.getCurrentConfig()).preprocessors.AccumulativeSplitter;

        const assignNewSessionId = async (msg: ProcessedChatMessageWithRawMessage) => {
            // 为其分配一个新的 sessionId
            msg.sessionId = getRandomHash(16); // 生成新的 sessionId
            if (config.mode === "charCount") {
                await this.kvStore!.put(msg.sessionId!, msg.messageContent!.length); // 存储新的 sessionId 及其容量
            } else if (config.mode === "messageCount") {
                await this.kvStore!.put(msg.sessionId!, 1); // 存储新的 sessionId 及其容量
            } else {
                throw ErrorReasons.INVALID_VALUE_ERROR;
            }
        };

        const msgs = await imDbAccessService.getProcessedChatMessageWithRawMessageByGroupIdAndTimeRange(
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
                    const previousMsgSessionId = msgs[index - 1].sessionId!;
                    ASSERT(previousMsgSessionId !== undefined); // 上一条消息的 sessionId 一定存在
                    const capacity = (await this.kvStore!.get(previousMsgSessionId))!; // 获取上一条消息的容量
                    ASSERT(capacity !== undefined); // capacity一定存在
                    ASSERT(capacity >= 0); // capacity一定非负

                    if (
                        (config.mode === "charCount" && capacity >= config.maxCharCount) ||
                        (config.mode === "messageCount" && capacity >= config.maxMessageCount)
                    ) {
                        // 此时上一个sessionId的容量已满，为这条消息分配一个新的 sessionId
                        await assignNewSessionId(msg);
                    } else if (
                        (config.mode === "charCount" && capacity < config.maxCharCount) ||
                        (config.mode === "messageCount" && capacity < config.maxMessageCount)
                    ) {
                        // 此时上一个sessionId的容量未满，为这条消息分配上一个sessionId，并更新其容量
                        msg.sessionId = previousMsgSessionId; // 分配上一个sessionId
                        if (config.mode === "charCount") {
                            await this.kvStore!.put(previousMsgSessionId, capacity + msg.messageContent!.length); // 更新容量
                        } else if (config.mode === "messageCount") {
                            await this.kvStore!.put(previousMsgSessionId, capacity + 1); // 更新容量
                        } else {
                            throw ErrorReasons.INVALID_VALUE_ERROR;
                        }
                    } else {
                        throw ErrorReasons.UNKNOWN_ERROR;
                    }
                }
            }
        }

        return msgs;
    }
}
