import { injectable, inject } from "tsyringe";
import { TaskHandlerTypes, TaskParamsMap } from "@root/common/scheduler/@types/Tasks";
import { IMTypes } from "@root/common/contracts/data-provider/index";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
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
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {}

    /**
     * 解析任务参数
     * @param taskType 任务类型
     * @param nodeParams 节点配置的参数
     * @param context 执行上下文
     * @returns 完整的任务参数
     */
    public async resolveParams<T extends TaskHandlerTypes>(
        taskType: T,
        nodeParams: Record<string, any>,
        context: ExecutionContext
    ): Promise<TaskParamsMap[T]> {
        LOGGER.debug(`解析任务 [${taskType}] 的参数`);

        // 根据任务类型生成默认参数
        const defaultParams = await this._generateDefaultParams(taskType, context);

        // 合并节点配置的参数（节点参数优先级更高）
        const mergedParams = { ...defaultParams, ...nodeParams };

        LOGGER.debug(`任务 [${taskType}] 参数解析完成`);

        return mergedParams as TaskParamsMap[T];
    }

    /**
     * 生成任务的默认参数
     * @param taskType 任务类型
     * @param context 执行上下文
     * @returns 默认参数
     */
    private async _generateDefaultParams(
        taskType: TaskHandlerTypes,
        context: ExecutionContext
    ): Promise<Record<string, any>> {
        const config = await this.configManagerService.getCurrentConfig();

        // 从上下文获取或生成时间范围
        let startTimeStamp = context.getGlobalVar("startTimeStamp") as number | undefined;
        let endTimeStamp = context.getGlobalVar("endTimeStamp") as number | undefined;

        if (!startTimeStamp || !endTimeStamp) {
            // 如果上下文中没有时间范围，则从配置生成（最近 N 小时）
            const hoursToCheck = config.orchestrator.defaultTimeRangeInHours || 24;

            endTimeStamp = Date.now();
            startTimeStamp = endTimeStamp - hoursToCheck * 60 * 60 * 1000;

            // 保存到上下文供后续节点使用
            context.setGlobalVar("startTimeStamp", startTimeStamp);
            context.setGlobalVar("endTimeStamp", endTimeStamp);

            LOGGER.info(
                `自动生成时间范围: ${new Date(startTimeStamp).toLocaleString()} - ${new Date(endTimeStamp).toLocaleString()}`
            );
        }

        // 从上下文获取或生成 groupIds
        let groupIds = context.getGlobalVar("groupIds") as string[] | undefined;

        if (!groupIds) {
            // 如果上下文中没有 groupIds，则从配置读取
            groupIds = config.orchestrator.defaultGroupIds || [];

            // 保存到上下文
            context.setGlobalVar("groupIds", groupIds);

            LOGGER.info(`使用配置的默认群组列表: ${groupIds.length} 个群组`);
        }

        // 根据任务类型生成默认参数
        switch (taskType) {
            case TaskHandlerTypes.ProvideData:
                return {
                    IMType: config.orchestrator.defaultIMType || IMTypes.QQ,
                    groupIds,
                    startTimeStamp,
                    endTimeStamp
                };

            case TaskHandlerTypes.Preprocess:
                return {
                    groupIds,
                    startTimeStamp,
                    endTimeStamp
                };

            case TaskHandlerTypes.AISummarize:
                return {
                    groupIds,
                    startTimeStamp,
                    endTimeStamp
                };

            case TaskHandlerTypes.InterestScore:
                return {
                    startTimeStamp,
                    endTimeStamp
                };

            case TaskHandlerTypes.LLMInterestEvaluationAndNotification:
                return {
                    startTimeStamp,
                    endTimeStamp
                };

            case TaskHandlerTypes.GenerateEmbedding:
                return {
                    startTimeStamp,
                    endTimeStamp
                };

            case TaskHandlerTypes.GenerateReport:
                // 报告任务的参数由节点配置提供（reportType、timeStart、timeEnd）
                return {};

            default:
                LOGGER.warning(`未知任务类型 [${taskType}]，返回空参数`);

                return {};
        }
    }
}
