import { IMTypes } from "../../types/data-provider";

export enum TaskHandlerTypes {
    ProvideData = "ProvideData",
    DecideAndDispatchProvideData = "DecideAndDispatchProvideData",
    Preprocess = "Preprocess",
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
    };
    [TaskHandlerTypes.AISummarize]: {};
}

// example
// const taskParameters: TaskParameters<TaskHandlerTypes.ProvideData> = { IMType: IMTypes.QQ };
export type TaskParameters<T extends TaskHandlerTypes> = TaskParamsMap[T];
