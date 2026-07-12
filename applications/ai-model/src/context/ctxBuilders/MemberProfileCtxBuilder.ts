import { AIDigestResult } from "@root/common/contracts/ai-model";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

import { MemberProfilePromptStore } from "../prompts/MemberProfilePromptStore";

import { ICtxBuilder } from "./contracts/ICtxBuilder";

/**
 * 群友个人画像上下文构建器
 * 将该群友参与的所有话题摘要聚合成文本，构建画像 prompt
 * 反查由调用方（RagRPCImpl）完成，本构建器只负责把数据塞进 prompt
 */
@mustInitBeforeUse
export class MemberProfileCtxBuilder extends Disposable implements ICtxBuilder {
    public async init(): Promise<void> {}

    /**
     * 构建群友画像 prompt
     * @param nickname 群友昵称（仅展示）
     * @param digestResults 该群友参与的所有话题摘要（由 RagRPCImpl 反查后传入）
     * @returns 可直接注入大模型的上下文
     */
    public async buildCtx(nickname: string, digestResults: AIDigestResult[]): Promise<string> {
        const topicsAggregate = digestResults
            .map((r, i) => `【话题${i + 1}】${r.topic}\n参与者：${r.contributors}\n详情：${r.detail}`)
            .join("\n\n");

        return (
            await MemberProfilePromptStore.getMemberProfilePrompt(nickname, topicsAggregate)
        ).serializeToString();
    }

    /**
     * 构建画像汇总（merge）prompt
     * 当话题过多分片生成多份子画像后，用本方法把子画像聚合成汇总 prompt，
     * 供 LLM 交叉验证、去重、整合为一份最终画像
     * @param nickname 群友昵称（仅展示）
     * @param subProfiles 各分组生成的子画像对象数组
     * @returns 可直接注入大模型的上下文
     */
    public async buildMergeCtx(nickname: string, subProfiles: unknown[]): Promise<string> {
        const subProfilesAggregate = subProfiles
            .map((p, i) => `【子画像${i + 1}】${JSON.stringify(p)}`)
            .join("\n\n");

        return (
            await MemberProfilePromptStore.getMemberProfileMergePrompt(nickname, subProfilesAggregate)
        ).serializeToString();
    }
}
