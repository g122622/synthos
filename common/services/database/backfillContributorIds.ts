import Logger from "../../util/Logger";

import { AgcDbAccessService } from "./AgcDbAccessService";
import { ImDbAccessService } from "./ImDbAccessService";

const LOGGER = Logger.withTag("BackfillContributorIds");

/** 单批最大处理行数，与 markEmbeddingGenerated 的分批粒度保持一致 */
const BATCH_SIZE = 100;

/**
 * 启动时存量补全：为 contributorIDs 为 NULL 的摘要结果反查并回填 QQ 号数组
 *
 * 设计内涵：摘要的 contributors 仅含昵称，需补全与之等长、顺序一一对应的 QQ 号数组
 * （contributorIDs，JSON 字符串），用于群友头像展示。
 *
 * 幂等性：只处理 contributorIDs IS NULL 的行；新摘要由 AISummarize 即时算好 contributorIDs，
 * 不会被本函数误触。两个 app 各启动一次、多次重启都只动 NULL 行。
 *
 * 多对一处理：复用 ImDbAccessService 的 SQL 反查（取时间最早的 senderId）。
 *
 * @param agcDbAccessService AI 摘要访问服务
 * @param imDbAccessService 聊天消息访问服务
 */
export async function backfillContributorIds(
    agcDbAccessService: AgcDbAccessService,
    imDbAccessService: ImDbAccessService
): Promise<void> {
    const rows = await agcDbAccessService.getAIDigestResultsWithoutContributorIds();

    if (rows.length === 0) {
        LOGGER.info("无需补全 contributorIDs，所有摘要均已存在该字段");

        return;
    }

    LOGGER.info(`开始补全 contributorIDs，共 ${rows.length} 条待处理`);

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // 解析 contributors 昵称数组；解析失败的行跳过，不中断整体补全
        let nicknames: string[];

        try {
            const parsed = JSON.parse(row.contributors);

            nicknames = Array.isArray(parsed) ? parsed.filter((n: unknown) => typeof n === "string") : [];
        } catch {
            LOGGER.warning(`topicId=${row.topicId} 的 contributors 解析失败，跳过：${row.contributors}`);
            skipCount++;
            continue;
        }

        if (nicknames.length === 0) {
            // 无参与者昵称，写入空数组以标记已处理，避免下次重复扫描
            await agcDbAccessService.updateContributorIds(row.topicId, JSON.stringify([]));
            successCount++;
            continue;
        }

        // 反查 昵称→QQ号 映射（取时间最早的 senderId）
        const nicknameToSenderId = await imDbAccessService.getEarliestSenderIdsBySessionIdAndNicknames(
            row.sessionId,
            nicknames
        );

        // 按 nicknames 顺序对齐成 QQ 号数组，未命中的位置填空串
        const contributorIdsArray = nicknames.map(nickname => nicknameToSenderId[nickname] ?? "");

        await agcDbAccessService.updateContributorIds(row.topicId, JSON.stringify(contributorIdsArray));
        successCount++;

        if ((i + 1) % BATCH_SIZE === 0) {
            LOGGER.info(`补全进度：${i + 1}/${rows.length}`);
        }
    }

    LOGGER.success(`contributorIDs 补全完成，成功 ${successCount} 条，跳过 ${skipCount} 条`);
}
