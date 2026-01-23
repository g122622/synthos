/**
 * 聊天消息全文检索（FTS）服务
 */
import { injectable, inject } from "tsyringe";
import { TOKENS } from "../di/tokens";
import { ImDbFtsService } from "@root/common/services/database/fts/ImDbFtsService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";

@injectable()
export class ChatMessageFtsService {
    constructor(
        @inject(TOKENS.ImDbFtsService) private imDbFtsService: ImDbFtsService,
        @inject(TOKENS.ImDbAccessService) private imDbAccessService: ImDbAccessService
    ) {}

    public async search(params: {
        query: string;
        groupIds?: string[];
        timeStart?: number;
        timeEnd?: number;
        page: number;
        pageSize: number;
    }): Promise<{
        total: number;
        page: number;
        pageSize: number;
        groups: Array<{
            groupId: string;
            count: number;
            hits: Array<{ msgId: string; timestamp: number; snippet: string }>;
        }>;
    }> {
        const res = await this.imDbFtsService.search({
            query: params.query,
            groupIds: params.groupIds,
            timeStart: params.timeStart,
            timeEnd: params.timeEnd,
            page: params.page,
            pageSize: params.pageSize
        });

        return {
            total: res.total,
            page: res.page,
            pageSize: res.pageSize,
            groups: res.groups.map(g => ({
                groupId: g.groupId,
                count: g.total,
                hits: g.hits.map(i => ({
                    msgId: i.msgId,
                    timestamp: i.timestamp,
                    snippet: i.snippet
                }))
            }))
        };
    }

    public async getContext(params: { groupId: string; msgId: string; before: number; after: number }) {
        return await this.imDbAccessService.getProcessedChatMessagesContextByGroupIdAndMsgId(
            params.groupId,
            params.msgId,
            params.before,
            params.after
        );
    }
}
