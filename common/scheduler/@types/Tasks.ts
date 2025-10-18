import { IMTypes } from "../../types/data-provider";

export enum TaskHandlerTypes {
    ProvideData = "ProvideData",
    DecideAndDispatchProvideData = "DecideAndDispatchProvideData",
    Preprocess = "Preprocess",
    DecideAndDispatchPreprocess = "DecideAndDispatchPreprocess",
    AISummarize = "AISummarize"
}

interface TaskParamsMap {
    [TaskHandlerTypes.ProvideData]: {
        IMType: IMTypes;
        groupIds: string[];
        startTimeStamp: number;
        endTimeStamp: number;
    };
    [TaskHandlerTypes.DecideAndDispatchProvideData]: {};

    // 由于Provider抹平了各个im之间的差异，因此Preprocessor不需要指定IMType
    [TaskHandlerTypes.Preprocess]: {
        groupIds: string[];
        startTimeInMinutesFromNow: number; // 从现在开始往前多少分钟的数据，作为splitter的时间窗口
    };
    [TaskHandlerTypes.DecideAndDispatchPreprocess]: {};

    [TaskHandlerTypes.AISummarize]: {};
}

// example
// const taskParameters: TaskParameters<TaskHandlerTypes.ProvideData> = { IMType: IMTypes.QQ };
export type TaskParameters<T extends TaskHandlerTypes> = TaskParamsMap[T];
