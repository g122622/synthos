import { injectable, inject } from "tsyringe";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { TaskRegistry } from "@root/common/scheduler/registry/index";
import { COMMON_TOKENS } from "@root/common/di/tokens";
import Logger from "@root/common/util/Logger";
import { ExecutionContext } from "@root/common/scheduler/helpers/ExecutionContext";

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
     * 解析任务参数。
     * @note 每次都会调用注册任务时指定的generateDefaultParams回调函数来生成任务的默认参数进行兜底
     * @param taskInternalName 任务类型
     * @param nodeParams 节点配置的参数
     * @param context 执行上下文
     * @returns 完整的任务参数
     */
    public async resolveParams(
        taskInternalName: string,
        nodeParams: Record<string, any>,
        context: ExecutionContext
    ): Promise<Record<string, any>> {
        LOGGER.debug(`解析任务 [${taskInternalName}] 的参数`);

        // 根据任务类型生成默认参数
        const defaultParams = await this._generateDefaultParams(taskInternalName, context);

        // 合并节点配置的参数（节点参数优先级更高，因此排在后面）
        const mergedParams = { ...defaultParams, ...nodeParams };

        // 使用 TaskRegistry 进行参数校验
        const taskMetadata = await this.taskRegistry.getRegisteredTaskByName(taskInternalName);

        if (taskMetadata) {
            const validation = await this.taskRegistry.validateTaskParamSchema(taskInternalName, mergedParams);

            if (!validation.success) {
                LOGGER.error(`任务 [${taskInternalName}] 参数校验失败: ${validation.error}`);
                throw new Error(`任务参数校验失败: ${validation.error}`);
            }

            LOGGER.debug(`任务 [${taskInternalName}] 参数校验通过`);

            return validation.data;
        }

        LOGGER.debug(`任务 [${taskInternalName}] 参数解析完成（未找到元数据，跳过校验）`);

        return mergedParams;
    }

    /**
     * 通过调用注册任务时指定的generateDefaultParams回调函数，生成任务的默认参数
     * @param taskInternalName 任务类型
     * @param context 执行上下文
     * @returns 默认参数
     */
    private async _generateDefaultParams(
        taskInternalName: string,
        context: ExecutionContext
    ): Promise<Record<string, any>> {
        const config = await this.configManagerService.getCurrentConfig();

        // 优先从 TaskRegistry 获取默认参数生成函数
        const taskMetadata = await this.taskRegistry.getRegisteredTaskByName(taskInternalName);

        if (taskMetadata && taskMetadata.generateDefaultParams) {
            LOGGER.debug(`使用任务元数据生成 [${taskInternalName}] 的默认参数`);

            try {
                const defaultParams = await taskMetadata.generateDefaultParams(context, config);

                return defaultParams as Record<string, any>;
            } catch (error) {
                LOGGER.error(`生成 [${taskInternalName}] 默认参数失败: ${error}`);
                throw new Error(`无法生成任务 [${taskInternalName}] 的默认参数`);
            }
        } else {
            LOGGER.error(`任务 [${taskInternalName}] 未在 TaskRegistry 中注册`);
            throw new Error(`任务 [${taskInternalName}] 未找到元数据，无法生成默认参数`);
        }
    }
}
