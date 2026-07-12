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
     * 每个话题按 contributorIDs↔contributors 位置对齐定位本人昵称，在参与者列表中标注「（本人）」，
     * 消除改名导致的身份歧义（同一人不同时期昵称均归为本人）
     * @param nickname 群友展示用昵称
     * @param senderId 群友 QQ号（用于在每个话题中对齐定位本人）
     * @param knownNicknames 该群友全部已知昵称（均指同一人，注入 prompt 提示 AI）
     * @param digestResults 该群友参与的所有话题摘要（由 RagRPCImpl 反查后传入）
     * @returns 可直接注入大模型的上下文
     */
    public async buildCtx(
        nickname: string,
        senderId: string,
        knownNicknames: string[],
        digestResults: AIDigestResult[]
    ): Promise<string> {
        const topicsAggregate = digestResults
            .map((r, i) => {
                // 按 contributorIDs↔contributors 对齐定位本人在该话题的昵称，标注「（本人）」
                let participantsLine = r.contributors;

                try {
                    const ids = r.contributorIDs ? (JSON.parse(r.contributorIDs) as string[]) : [];
                    const names = r.contributors ? (JSON.parse(r.contributors) as string[]) : [];
                    const selfIdx = ids.indexOf(senderId);

                    if (selfIdx >= 0 && selfIdx < names.length) {
                        participantsLine = names.map((n, j) => (j === selfIdx ? `${n}（本人）` : n)).join("、");
                    } else {
                        participantsLine = names.join("、");
                    }
                } catch {
                    // contributorIDs/contributors 非合法 JSON 数组，保留原始 contributors
                }

                return `【话题${i + 1}】${r.topic}\n参与者：${participantsLine}\n详情：${r.detail}`;
            })
            .join("\n\n");

        return (
            await MemberProfilePromptStore.getMemberProfilePrompt(nickname, knownNicknames, topicsAggregate)
        ).serializeToString();
    }

    /**
     * 构建画像汇总（merge）prompt
     * 当话题过多分片生成多份子画像后，用本方法把子画像聚合成汇总 prompt，
     * 供 LLM 交叉验证、去重、整合为一份最终画像
     * @param nickname 群友昵称（仅展示）
     * @param knownNicknames 该群友全部已知昵称（均指同一人，注入 prompt 提示 AI）
     * @param subProfiles 各分组生成的子画像对象数组
     * @returns 可直接注入大模型的上下文
     */
    public async buildMergeCtx(
        nickname: string,
        knownNicknames: string[],
        subProfiles: unknown[]
    ): Promise<string> {
        const subProfilesAggregate = subProfiles
            .map((p, i) => `【子画像${i + 1}】${JSON.stringify(p)}`)
            .join("\n\n");

        return (
            await MemberProfilePromptStore.getMemberProfileMergePrompt(
                nickname,
                knownNicknames,
                subProfilesAggregate
            )
        ).serializeToString();
    }
}
