import "reflect-metadata";
import { container } from "tsyringe";
import Logger from "@root/common/util/Logger";
import { TaskRegistry } from "@root/common/scheduler/registry/index";
import {
    registerConfigManagerService,
    registerRedisService,
    registerEventService,
    registerTaskRegistry
} from "@root/common/di/container";
import { getEventService, getTaskRegistry } from "@root/common/di/container";
import { BUILTIN_TASK_DEFINITIONS } from "@root/common/scheduler/taskDefinitions/index";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import { sleep } from "@root/common/util/promisify/sleep";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";

import { ExecutionPersistence } from "./core/ExecutionPersistence";
import { startOrchestratorRPCServer } from "./rpc/server";
import { OrchestratorRPCImpl } from "./rpc/impl";

const LOGGER = Logger.withTag("🎭 orchestrator");

@bootstrap
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class OrchestratorApplication {
    public async main(): Promise<void> {
        // 初始化 DI 容器
        registerConfigManagerService();
        registerRedisService();
        registerEventService();
        registerTaskRegistry();

        // 初始化事件服务与任务注册中心（必须在使用前 init）
        await getEventService().init();
        await getTaskRegistry().init();

        // 将内置任务定义注册到本进程内存（含 Schema / defaultParams）
        for (const def of BUILTIN_TASK_DEFINITIONS) {
            await getTaskRegistry().registerSingleTask(def);
        }

        const config = await ConfigManagerService.getCurrentConfig();

        // 初始化执行持久化服务
        const persistence = new ExecutionPersistence(container.resolve(COMMON_TOKENS.ConfigManagerService));

        await persistence.init();

        // 从配置读取工作流定义
        let workflows = config.orchestrator.workflows || [];

        if (workflows.length === 0) {
            LOGGER.error("❌ 配置中未找到工作流定义，请在 synthos_config.json 中配置 orchestrator.workflows");
            LOGGER.info("💡 提示：可参考项目根目录的 synthos_config.json 中的默认工作流定义");

            throw new Error("配置中未找到工作流定义");
        }

        LOGGER.info(`✅ 已加载 ${workflows.length} 个工作流定义`);

        // 创建 RPC 实现
        const rpcImpl = new OrchestratorRPCImpl(
            container.resolve(COMMON_TOKENS.ConfigManagerService),
            container.resolve<TaskRegistry>(COMMON_TOKENS.TaskRegistry),
            persistence
        );

        // 启动 tRPC Server
        const rpcPort = config.orchestrator.rpcPort;

        startOrchestratorRPCServer(rpcImpl, rpcPort);

        await sleep(10 * 1000); // 等其他 apps 启动后再开始

        // TODO 可能需要在这里触发主流程的自动执行（是否自动执行应该由配置决定）

        LOGGER.success("🎭 Orchestrator 服务已完全启动");
    }
}

// 启动应用
bootstrapAll();
