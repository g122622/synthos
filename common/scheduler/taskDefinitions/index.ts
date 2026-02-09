export { ProvideDataTaskDefinition, ProvideDataParamsSchema } from "./ProvideDataTaskDefinition";
export { PreprocessTaskDefinition, PreprocessParamsSchema } from "./PreprocessTaskDefinition";
export {
    AISummarizeTaskDefinition,
    GenerateEmbeddingTaskDefinition,
    InterestScoreTaskDefinition,
    LLMInterestEvaluationAndNotificationTaskDefinition,
    GenerateReportTaskDefinition,
    GroupedTimeRangeParamsSchema,
    GenerateReportParamsSchema
} from "./AiModelTaskDefinitions";

import type { TaskMetadata } from "../registry/types";

import { ProvideDataTaskDefinition } from "./ProvideDataTaskDefinition";
import { PreprocessTaskDefinition } from "./PreprocessTaskDefinition";
import {
    AISummarizeTaskDefinition,
    GenerateEmbeddingTaskDefinition,
    InterestScoreTaskDefinition,
    LLMInterestEvaluationAndNotificationTaskDefinition,
    GenerateReportTaskDefinition
} from "./AiModelTaskDefinitions";

/**
 * 内置任务定义列表（用于 orchestrator/webui-backend 统一注册元数据）
 */
export const BUILTIN_TASK_DEFINITIONS: TaskMetadata[] = [
    ProvideDataTaskDefinition,
    PreprocessTaskDefinition,
    AISummarizeTaskDefinition,
    GenerateEmbeddingTaskDefinition,
    InterestScoreTaskDefinition,
    LLMInterestEvaluationAndNotificationTaskDefinition,
    GenerateReportTaskDefinition
];
