import { AgcDbAccessService } from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService } from "@root/common/services/database/ImDbAccessService";
import { ImDbFtsService } from "@root/common/services/database/fts/ImDbFtsService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { ReportDbAccessService } from "@root/common/services/database/ReportDbAccessService";
import { MemberProfileDbAccessService } from "@root/common/services/database/MemberProfileDbAccessService";
import { backfillContributorIds } from "@root/common/services/database/backfillContributorIds";
import { registerDbAccessServices, registerImDbFtsService } from "@root/common/di/container";
import Logger from "@root/common/util/Logger";

const LOGGER = Logger.withTag("📃 WebUI-Backend");

/**
 * 初始化所有数据库服务并注册到 DI 容器
 * @returns 包含所有已初始化数据库服务的对象
 */
export const initializeDatabases = async (): Promise<{
    agcDbAccessService: AgcDbAccessService;
    imDbAccessService: ImDbAccessService;
    imDbFtsService: ImDbFtsService;
    interestScoreDbAccessService: InterestScoreDbAccessService;
    reportDbAccessService: ReportDbAccessService;
    memberProfileDbAccessService: MemberProfileDbAccessService;
}> => {
    try {
        const agcDbAccessService = new AgcDbAccessService();
        const imDbAccessService = new ImDbAccessService();
        const imDbFtsService = new ImDbFtsService();
        const interestScoreDbAccessService = new InterestScoreDbAccessService();
        const reportDbAccessService = new ReportDbAccessService();
        const memberProfileDbAccessService = new MemberProfileDbAccessService();

        await agcDbAccessService.init();
        await imDbAccessService.init();
        await imDbFtsService.init();
        await interestScoreDbAccessService.init();
        await reportDbAccessService.init();
        await memberProfileDbAccessService.init();

        // 存量补全 contributorIDs（需 imDb 与 agc 均初始化完成）
        await backfillContributorIds(agcDbAccessService, imDbAccessService);

        // 注册到 DI 容器
        registerDbAccessServices({
            agcDbAccessService,
            imDbAccessService,
            interestScoreDbAccessService,
            reportDbAccessService,
            memberProfileDbAccessService
        });

        registerImDbFtsService(imDbFtsService);

        LOGGER.success("数据库初始化完成并注册到 DI 容器");

        return {
            agcDbAccessService,
            imDbAccessService,
            imDbFtsService,
            interestScoreDbAccessService,
            reportDbAccessService,
            memberProfileDbAccessService
        };
    } catch (error) {
        LOGGER.error(`数据库初始化失败: ${error}`);
        process.exit(1);
    }
};

export const closeDatabases = async (
    agcDbAccessService: AgcDbAccessService | null,
    imDbAccessService: ImDbAccessService | null,
    imDbFtsService: ImDbFtsService | null,
    interestScoreDbAccessService: InterestScoreDbAccessService | null,
    reportDbAccessService: ReportDbAccessService | null,
    memberProfileDbAccessService: MemberProfileDbAccessService | null
): Promise<void> => {
    if (agcDbAccessService) await agcDbAccessService.dispose();
    if (imDbAccessService) await imDbAccessService.dispose();
    if (imDbFtsService) await imDbFtsService.dispose();
    if (interestScoreDbAccessService) await interestScoreDbAccessService.dispose();
    if (reportDbAccessService) await reportDbAccessService.dispose();
    if (memberProfileDbAccessService) await memberProfileDbAccessService.dispose();
};
