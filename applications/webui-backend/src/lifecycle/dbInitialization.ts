import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";
import { ReportDBManager } from "@root/common/database/ReportDBManager";
import Logger from "@root/common/util/Logger";

const LOGGER = Logger.withTag("📃 WebUI-Backend");

export const initializeDatabases = async (): Promise<{
    agcDBManager: AGCDBManager;
    imDBManager: IMDBManager;
    interestScoreDBManager: InterestScoreDBManager;
    reportDBManager: ReportDBManager;
}> => {
    try {
        const agcDBManager = new AGCDBManager();
        const imDBManager = new IMDBManager();
        const interestScoreDBManager = new InterestScoreDBManager();
        const reportDBManager = new ReportDBManager();

        await agcDBManager.init();
        await imDBManager.init();
        await interestScoreDBManager.init();
        await reportDBManager.init();

        LOGGER.success("数据库初始化完成");

        return { agcDBManager, imDBManager, interestScoreDBManager, reportDBManager };
    } catch (error) {
        LOGGER.error(`数据库初始化失败: ${error}`);
        process.exit(1);
    }
};

export const closeDatabases = async (
    agcDBManager: AGCDBManager | null,
    imDBManager: IMDBManager | null,
    interestScoreDBManager: InterestScoreDBManager | null,
    reportDBManager: ReportDBManager | null
): Promise<void> => {
    if (agcDBManager) await agcDBManager.dispose();
    if (imDBManager) await imDBManager.dispose();
    if (interestScoreDBManager) await interestScoreDBManager.dispose();
    if (reportDBManager) await reportDBManager.dispose();
};
