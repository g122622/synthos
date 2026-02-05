import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import Logger from "@root/common/util/Logger";

import { IApplication } from "@/contracts/IApplication";

/**
 * 判断一个字符是否为数字（0-9）
 */
function isDigit(char: string): boolean {
    const code = char.charCodeAt(0);

    return code >= 48 && code <= 57; // '0' = 48, '9' = 57
}

/**
 * 从字符串中提取所有符合条件的QQ号
 * 条件：9-10位纯数字，且数值小于 2^32 (4294967296)
 */
function extractQQNumbers(content: string): string[] {
    const result: string[] = [];
    const maxQQValue = 4294967296; // 2^32

    let i = 0;

    while (i < content.length) {
        // 找到数字开始的位置
        if (isDigit(content[i])) {
            let numStart = i;

            // 收集连续的数字
            while (i < content.length && isDigit(content[i])) {
                i++;
            }
            const numStr = content.slice(numStart, i);
            const numLength = numStr.length;

            // 只处理9位或10位的数字
            if (numLength === 9 || numLength === 10) {
                // 检查数值是否小于 2^32
                const numValue = parseInt(numStr, 10);

                if (numValue < maxQQValue) {
                    result.push(numStr);
                }
            }
        } else {
            i++;
        }
    }

    return result;
}

@mustInitBeforeUse
export class SeekQQNumber extends Disposable implements IApplication {
    public static readonly appName = "筛选QQ号";
    public static readonly description = "从消息内容中筛选出包含9-10位QQ号的记录";

    private LOGGER = Logger.withTag("筛选QQ号");

    public async init() {}

    public async run() {
        const imDbAccessService = new ImDbAccessService();

        await imDbAccessService.init();
        // 使用SQL先过滤出messageContent不为空的记录
        // SQLite中可以用GLOB模式来初步筛选包含数字的内容
        const sql = `
            SELECT messageContent 
            FROM chat_messages 
            WHERE messageContent IS NOT NULL 
              AND messageContent != ''
              AND (
                  messageContent GLOB '*[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*'
              )
        `;

        this.LOGGER.info("正在查询数据库...");
        const rows = await imDbAccessService.execQuerySQL(sql);

        this.LOGGER.info(`初步筛选出 ${rows.length} 条记录，正在精确筛选...`);

        let matchCount = 0;

        for (const row of rows) {
            const content = row.messageContent as string;
            const qqNumbers = extractQQNumbers(content);

            if (qqNumbers.length > 0) {
                matchCount++;
                this.LOGGER.info(`原文: ${content} | QQ号: [${qqNumbers.join(", ")}]`);
            }
        }

        this.LOGGER.info(`筛选完成，共找到 ${matchCount} 条包含QQ号的记录`);
    }
}
