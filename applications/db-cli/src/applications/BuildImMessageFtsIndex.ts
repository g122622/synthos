import { IApplication } from "@/contracts/IApplication";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import Logger from "@root/common/util/Logger";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ImDbFtsService } from "@root/common/services/database/fts/ImDbFtsService";

@mustInitBeforeUse
export class BuildImMessageFtsIndex extends Disposable implements IApplication {
    public static readonly appName = "构建 IM 消息 FTS 索引";
    public static readonly description = "从主库 chat_messages 全量导出并重建独立 FTS DB 索引";

    private LOGGER = Logger.withTag("BuildImMessageFtsIndex");

    private imDbAccessService: ImDbAccessService = this._registerDisposable(new ImDbAccessService());
    private imDbFtsService: ImDbFtsService = this._registerDisposable(new ImDbFtsService());

    public async init(): Promise<void> {
        await this.imDbAccessService.init();
        await this.imDbFtsService.init();
        this.LOGGER.success("初始化完成");
        this.LOGGER.info(`FTS DB 路径: ${this.imDbFtsService.getDBPath()}`);
    }

    public async run(): Promise<void> {
        this.LOGGER.info("开始从主库导出 chat_messages 全量数据...");
        const allMessages = await this.imDbAccessService.selectAll();
        this.LOGGER.info(`已导出 ${allMessages.length} 条消息，准备重建 FTS 索引...`);

        await this.imDbFtsService.rebuildIndex(
            allMessages.map(m => ({
                msgId: m.msgId,
                groupId: m.groupId,
                timestamp: m.timestamp,
                messageContent: m.messageContent,
                quotedMsgContent: m.quotedMsgContent,
                preProcessedContent: m.preProcessedContent,
                senderGroupNickname: m.senderGroupNickname,
                senderNickname: m.senderNickname,
                senderId: m.senderId
            }))
        );

        this.LOGGER.success("FTS 索引重建完成");
    }
}
