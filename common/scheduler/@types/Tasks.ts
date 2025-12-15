import { IMTypes } from "../../contracts/data-provider";

export enum TaskHandlerTypes {
    ProvideData = "ProvideData",
    Preprocess = "Preprocess",
    AISummarize = "AISummarize",
    InterestScore = "InterestScore",
    GenerateEmbedding = "GenerateEmbedding",
    // Pipeline 调度任务
    RunPipeline = "RunPipeline"
}

export interface TaskParamsMap {
    [TaskHandlerTypes.ProvideData]: {
        IMType: IMTypes;
        groupIds: string[];
        startTimeInHoursFromNow: number;
    };

    // 由于Provider抹平了各个im之间的差异，因此Preprocessor不需要指定IMType
    [TaskHandlerTypes.Preprocess]: {
        groupIds: string[];
        startTimeInMinutesFromNow: number; // 从现在开始往前多少分钟的数据，作为splitter的时间窗口
    };

    [TaskHandlerTypes.AISummarize]: {
        groupIds: string[];
        startTimeStamp: number;
        endTimeStamp: number;
    };
    [TaskHandlerTypes.InterestScore]: {
        startTimeStamp: number;
        endTimeStamp: number;
    };
    [TaskHandlerTypes.GenerateEmbedding]: {
        startTimeStamp: number;
        endTimeStamp: number;
    };
    // Pipeline 任务参数
    [TaskHandlerTypes.RunPipeline]: {
    };
}

// example
// const taskParameters: TaskParameters<TaskHandlerTypes.ProvideData> = { IMType: IMTypes.QQ };
export type TaskParameters<T extends TaskHandlerTypes> = TaskParamsMap[T];
