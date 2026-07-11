/**
 * 群友画像服务
 * 处理画像缓存查询、依据话题反查、画像生成（调用 ai-model RPC）
 */
import type { MemberProfileGenerateOutput } from "@root/common/rpc/ai-model/schemas";
import type { AIDigestResult } from "@root/common/contracts/ai-model";
import type { MemberProfile } from "@root/common/contracts/member-profile";

import { inject, injectable } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { MemberProfileDbAccessService } from "@root/common/services/database/MemberProfileDbAccessService";

import { RAGClient } from "../rpc/aiModelClient";
import { TOKENS } from "../di/tokens";

@injectable()
export class MemberProfileService {
    private LOGGER = Logger.withTag("MemberProfileService");

    constructor(
        @inject(TOKENS.MemberProfileDbAccessService) private memberProfileDB: MemberProfileDbAccessService,
        @inject(TOKENS.AgcDbAccessService) private agcDbAccessService: AgcDbAccessService,
        @inject(TOKENS.RAGClient) private ragClient: RAGClient
    ) {}

    /**
     * 根据 QQ号 查询缓存画像
     * @param senderId 群友 QQ号
     * @returns 命中的画像记录，未命中返回 null
     */
    public async getMemberProfile(senderId: string): Promise<MemberProfile | null> {
        return this.memberProfileDB.getMemberProfileBySenderId(senderId);
    }

    /**
     * 根据 QQ号 反查该群友参与的所有话题（画像依据）
     * @param senderId 群友 QQ号
     * @returns 该群友参与的所有 AIDigestResult
     */
    public async getContributorTopics(senderId: string): Promise<AIDigestResult[]> {
        return this.agcDbAccessService.getAIDigestResultsByContributorId(senderId);
    }

    /**
     * 发起群友画像生成（非流式）
     * 调用 ai-model 的 tRPC mutation，直接返回完整画像结果
     * @param request 请求参数（senderId + 可选 nickname）
     * @returns 生成结果（成功时携带画像内容与落库记录，失败时携带 message）
     */
    public async generateMemberProfile(request: {
        senderId: string;
        nickname?: string;
    }): Promise<MemberProfileGenerateOutput> {
        this.LOGGER.info(`群友画像生成: senderId=${request.senderId}`);

        return this.ragClient.generateMemberProfile.mutate({
            senderId: request.senderId,
            nickname: request.nickname
        });
    }
}
