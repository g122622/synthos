/**
 * LangGraph Checkpointer 服务
 * 使用 SQLite 保存 checkpoint，实现持久化/时间旅行/HITL 的底座能力。
 */
import "reflect-metadata";
import path from "path";
import { injectable, inject } from "tsyringe";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import Logger from "@root/common/util/Logger";

@injectable()
export class LangGraphCheckpointerService {
    private LOGGER = Logger.withTag("LangGraphCheckpointerService");
    private checkpointer: SqliteSaver | null = null;

    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {}

    public async getCheckpointer(): Promise<SqliteSaver> {
        if (this.checkpointer) {
            return this.checkpointer;
        }

        const config = await this.configManagerService.getCurrentConfig();
        const checkpointDBPath = path.join(config.commonDatabase.dbBasePath, "langgraph_checkpoints.sqlite");

        this.LOGGER.info(`LangGraph checkpointer 使用 SQLite: ${checkpointDBPath}`);
        this.checkpointer = SqliteSaver.fromConnString(checkpointDBPath);
        return this.checkpointer;
    }
}
