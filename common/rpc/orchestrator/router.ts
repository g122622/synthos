/**
 * Orchestrator RPC Router
 * 定义 tRPC router 工厂函数，供 orchestrator 实现、webui-backend 调用
 */
import { initTRPC, type DefaultErrorShape } from "@trpc/server";
import { observable } from "@trpc/server/observable";

import {
    ListWorkflowsOutput,
    GetWorkflowInput,
    GetWorkflowOutput,
    TriggerWorkflowInput,
    TriggerWorkflowOutput,
    CancelExecutionInput,
    CancelExecutionOutput,
    RetryExecutionInput,
    RetryExecutionOutput,
    ListExecutionsInput,
    ListExecutionsOutput,
    GetExecutionInput,
    GetExecutionOutput,
    OnExecutionUpdateInput,
    ExecutionUpdateEvent,
    GetWorkflowInputSchema,
    TriggerWorkflowInputSchema,
    CancelExecutionInputSchema,
    RetryExecutionInputSchema,
    ListExecutionsInputSchema,
    GetExecutionInputSchema,
    OnExecutionUpdateInputSchema,
    ExecutionUpdateEventSchema
} from "./schemas";

const t = initTRPC
    .context<any>()
    .meta<any>()
    .create({
        errorFormatter({ shape }): DefaultErrorShape {
            return shape;
        }
    });

/**
 * Orchestrator RPC 实现接口
 * orchestrator 需要实现这些方法
 */
export interface OrchestratorRPCImplementation {
    /**
     * 获取所有工作流定义列表
     * @returns 工作流定义列表
     */
    listWorkflows(): Promise<ListWorkflowsOutput>;

    /**
     * 获取单个工作流定义
     * @param input 工作流 ID
     * @returns 工作流定义
     */
    getWorkflow(input: GetWorkflowInput): Promise<GetWorkflowOutput>;

    /**
     * 手动触发流程执行
     * @param input 工作流 ID 和全局变量
     * @returns 触发结果
     */
    triggerWorkflow(input: TriggerWorkflowInput): Promise<TriggerWorkflowOutput>;

    /**
     * 取消正在运行的执行
     * @param input 执行 ID
     * @returns 取消结果
     */
    cancelExecution(input: CancelExecutionInput): Promise<CancelExecutionOutput>;

    /**
     * 断点续跑
     * @param input 执行 ID
     * @returns 重试结果
     */
    retryExecution(input: RetryExecutionInput): Promise<RetryExecutionOutput>;

    /**
     * 获取执行历史列表
     * @param input 工作流 ID 和分页参数
     * @returns 执行历史列表
     */
    listExecutions(input: ListExecutionsInput): Promise<ListExecutionsOutput>;

    /**
     * 获取单次执行详情
     * @param input 执行 ID
     * @returns 执行详情
     */
    getExecution(input: GetExecutionInput): Promise<GetExecutionOutput>;

    /**
     * 订阅执行状态更新
     * @param input 执行 ID
     * @param onChunk 事件回调
     */
    onExecutionUpdate(
        input: OnExecutionUpdateInput,
        onChunk: (event: ExecutionUpdateEvent) => void
    ): Promise<void>;
}

/**
 * 创建 Orchestrator tRPC Router
 * @param impl RPC 方法的具体实现
 * @returns tRPC router 实例
 */
export const createOrchestratorRouter = (impl: OrchestratorRPCImplementation) => {
    const router = t.router({
        listWorkflows: t.procedure.query(async () => {
            return impl.listWorkflows();
        }),

        getWorkflow: t.procedure.input(GetWorkflowInputSchema).query(async ({ input }) => {
            return impl.getWorkflow(input);
        }),

        triggerWorkflow: t.procedure.input(TriggerWorkflowInputSchema).mutation(async ({ input }) => {
            return impl.triggerWorkflow(input);
        }),

        cancelExecution: t.procedure.input(CancelExecutionInputSchema).mutation(async ({ input }) => {
            return impl.cancelExecution(input);
        }),

        retryExecution: t.procedure.input(RetryExecutionInputSchema).mutation(async ({ input }) => {
            return impl.retryExecution(input);
        }),

        listExecutions: t.procedure.input(ListExecutionsInputSchema).query(async ({ input }) => {
            return impl.listExecutions(input);
        }),

        getExecution: t.procedure.input(GetExecutionInputSchema).query(async ({ input }) => {
            return impl.getExecution(input);
        }),

        onExecutionUpdate: t.procedure.input(OnExecutionUpdateInputSchema).subscription(({ input }) => {
            return observable<ExecutionUpdateEvent>(emit => {
                let isStopped = false;

                (async () => {
                    try {
                        await impl.onExecutionUpdate(input, event => {
                            if (isStopped) {
                                return;
                            }
                            // Runtime check
                            try {
                                ExecutionUpdateEventSchema.parse(event);
                            } catch {
                                // ignore
                            }
                            emit.next(event);
                        });

                        if (!isStopped) {
                            emit.complete();
                        }
                    } catch (error) {
                        if (!isStopped) {
                            emit.error(error);
                        }
                    }
                })();

                return () => {
                    isStopped = true;
                };
            });
        })
    });

    return router;
};

/**
 * Orchestrator Router 类型
 */
export type OrchestratorRouter = ReturnType<typeof createOrchestratorRouter>;
