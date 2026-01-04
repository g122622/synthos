import { AgcDbAccessService} from "@root/common/services/database/AgcDbAccessService";
import { ImDbAccessService} from "@root/common/services/database/ImDbAccessService";
import { InterestScoreDbAccessService } from "@root/common/services/database/InterestScoreDbAccessService";
import { ReportDbAccessService} from "@root/common/services/database/ReportDbAccessService";
import Logger from "@root/common/util/Logger";

const LOGGER = Logger.withTag("📃 WebUI-Backend");

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

        LOGGER.success("数据库初始化完成");

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
