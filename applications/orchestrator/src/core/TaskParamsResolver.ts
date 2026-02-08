import { injectable, inject } from "tsyringe";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { TaskRegistry } from "@root/common/scheduler/registry/index";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import Logger from "@root/common/util/Logger";

import { ExecutionContext } from "../core/ExecutionContext";

const LOGGER = Logger.withTag("🔧 TaskParamsResolver");

/**
 * 任务参数解析器
 * 负责将节点配置的参数与运行时动态参数合并，生成完整的任务参数
 */
@injectable()
export class TaskParamsResolver {
    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     * @param taskRegistry 任务注册中心
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService,
        @inject(COMMON_TOKENS.TaskRegistry) private taskRegistry: TaskRegistry
    ) {}

    /**
     * 解析任务参数
     * @param taskType 任务类型
     * @param nodeParams 节点配置的参数
     * @param context 执行上下文
     * @returns 完整的任务参数
     */
    public async resolveParams(
        taskType: string,
        nodeParams: Record<string, any>,
        context: ExecutionContext
    ): Promise<Record<string, any>> {
        LOGGER.debug(`解析任务 [${taskType}] 的参数`);

        // 根据任务类型生成默认参数
        const defaultParams = await this._generateDefaultParams(taskType, context);

        // 合并节点配置的参数（节点参数优先级更高）
        const mergedParams = { ...defaultParams, ...nodeParams };

        // 使用 TaskRegistry 进行参数校验
        const taskMetadata = await this.taskRegistry.getRegisteredTaskByName(taskType);

        if (taskMetadata) {
            const validation = await this.taskRegistry.validate(taskType, mergedParams);

            if (!validation.success) {
                LOGGER.error(`任务 [${taskType}] 参数校验失败: ${validation.error}`);
                throw new Error(`任务参数校验失败: ${validation.error}`);
            }

            LOGGER.debug(`任务 [${taskType}] 参数校验通过`);

            return validation.data;
        }

        LOGGER.debug(`任务 [${taskType}] 参数解析完成（未找到元数据，跳过校验）`);

        return mergedParams;
    }

    /**
     * 生成任务的默认参数
     * @param taskType 任务类型
     * @param context 执行上下文
     * @returns 默认参数
     */
    private async _generateDefaultParams(
        taskType: string,
        context: ExecutionContext
    ): Promise<Record<string, any>> {
        const config = await this.configManagerService.getCurrentConfig();

        // 优先从 TaskRegistry 获取默认参数生成函数
        const taskMetadata = await this.taskRegistry.getRegisteredTaskByName(taskType);

        if (taskMetadata && taskMetadata.generateDefaultParams) {
            LOGGER.debug(`使用任务元数据生成 [${taskType}] 的默认参数`);

            try {
                const defaultParams = await taskMetadata.generateDefaultParams(context, config);

                // 从上下文补充时间范围参数
                this._enrichParamsWithContext(defaultParams, context, config);

                return defaultParams as Record<string, any>;
            } catch (error) {
                LOGGER.error(`生成 [${taskType}] 默认参数失败: ${error}`);
                throw new Error(`无法生成任务 [${taskType}] 的默认参数`);
            }
        }

        LOGGER.error(`任务 [${taskType}] 未在 TaskRegistry 中注册`);
        throw new Error(`任务 [${taskType}] 未找到元数据，无法生成默认参数`);
    }

    /**
     * 从执行上下文补充参数（时间范围、群组列表等）
     * @param params 参数对象
     * @param context 执行上下文
     * @param config 配置对象
     */
    private _enrichParamsWithContext(params: Record<string, any>, context: ExecutionContext, config: any): void {
        // 补充时间范围
        let startTimeStamp = context.getGlobalVar("startTimeStamp") as number | undefined;
        let endTimeStamp = context.getGlobalVar("endTimeStamp") as number | undefined;

        if (!startTimeStamp || !endTimeStamp) {
            const hoursToCheck = config.orchestrator.defaultTimeRangeInHours || 24;

            endTimeStamp = Date.now();
            startTimeStamp = endTimeStamp - hoursToCheck * 60 * 60 * 1000;

            context.setGlobalVar("startTimeStamp", startTimeStamp);
            context.setGlobalVar("endTimeStamp", endTimeStamp);

            LOGGER.info(
                `自动生成时间范围: ${new Date(startTimeStamp).toLocaleString()} - ${new Date(endTimeStamp).toLocaleString()}`
            );
        }

        if (params.startTimeStamp === undefined) {
            params.startTimeStamp = startTimeStamp;
        }
        if (params.endTimeStamp === undefined) {
            params.endTimeStamp = endTimeStamp;
        }

        // 补充群组列表
        let groupIds: string[] = (context.getGlobalVar("groupIds") as string[] | undefined) || [];

        if (groupIds.length === 0) {
            groupIds = config.orchestrator.defaultGroupIds || [];
            context.setGlobalVar("groupIds", groupIds);
            LOGGER.info(`使用配置的默认群组列表: ${groupIds.length} 个群组`);
        }

        if (params.groupIds === undefined) {
            params.groupIds = groupIds;
        }
    }
}
