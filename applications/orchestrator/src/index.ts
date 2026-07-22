import "reflect-metadata";
import Logger from "@root/common/util/Logger";
import { registerConfigManagerService } from "@root/common/di/container";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";

import { setupClients } from "./rpc/setupClients";
import { PipelineRunner } from "./pipeline/PipelineRunner";
import { setupPipelineScheduler } from "./schedulers/pipelineScheduler";
import { setupReportScheduler } from "./schedulers/reportScheduler";

const LOGGER = Logger.withTag("🎭 orchestrator-root-script");

@bootstrap
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class OrchestratorApplication {
    public async main(): Promise<void> {
        // 1. 初始化 DI 容器
        registerConfigManagerService();

        const config = await ConfigManagerService.getCurrentConfig();

        // 2. 创建并等待各 worker 的 RPC client 就绪（替代原 sleep(10s) hack）
        const clients = await setupClients();

        // 3. 创建 Pipeline 执行器
        const pipelineRunner = new PipelineRunner(clients.dataProvider, clients.preprocessing, clients.aiModel);

        // 4. 配置 Pipeline 定时任务
        setupPipelineScheduler(pipelineRunner, config);

        // 5. 配置日报定时任务（独立于主 Pipeline）
        setupReportScheduler(clients.aiModel, config);

        LOGGER.success("✅ Orchestrator 准备就绪");

        // 6. 启动时触发一次 Pipeline（不阻塞，失败仅记日志）
        pipelineRunner.runPipeline().catch(err => {
            LOGGER.error(`启动触发的 Pipeline 执行失败: ${err}`);
        });
    }
}

// 启动应用
bootstrapAll();
