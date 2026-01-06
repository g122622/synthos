import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";
import { registerDbAccessServices } from "@root/common/di/container";
import Logger from "@root/common/util/Logger";

const LOGGER = Logger.withTag("📃 WebUI-Backend");

/**
 * 初始化所有数据库服务并注册到 DI 容器
 * @returns 包含所有已初始化数据库服务的对象
 */
export const initializeDatabases = async (): Promise<{
    agcDbAccessService: AgcDbAccessService;
    imDbAccessService: ImDbAccessService;
    interestScoreDbAccessService: InterestScoreDbAccessService;
    reportDbAccessService: ReportDbAccessService;
}> => {
    try {
        const agcDbAccessService = new AgcDbAccessService();
        const imDbAccessService = new ImDbAccessService();
        const interestScoreDbAccessService = new InterestScoreDbAccessService();
        const reportDbAccessService = new ReportDbAccessService();

        await agcDbAccessService.init();
        await imDbAccessService.init();
        await interestScoreDbAccessService.init();
        await reportDbAccessService.init();

        // 注册到 DI 容器
        registerDbAccessServices({
            agcDbAccessService,
            imDbAccessService,
            interestScoreDbAccessService,
            reportDbAccessService
        });

        LOGGER.success("数据库初始化完成并注册到 DI 容器");

        return { agcDbAccessService, imDbAccessService, interestScoreDbAccessService, reportDbAccessService };
    } catch (error) {
        LOGGER.error(`数据库初始化失败: ${error}`);
        process.exit(1);
    }
};

export const closeDatabases = async (
    agcDbAccessService: AgcDbAccessService | null,
    imDbAccessService: ImDbAccessService | null,
    interestScoreDbAccessService: InterestScoreDbAccessService | null,
    reportDbAccessService: ReportDbAccessService | null
): Promise<void> => {
    if (agcDbAccessService) await agcDbAccessService.dispose();
    if (imDbAccessService) await imDbAccessService.dispose();
    if (interestScoreDbAccessService) await interestScoreDbAccessService.dispose();
    if (reportDbAccessService) await reportDbAccessService.dispose();
};
