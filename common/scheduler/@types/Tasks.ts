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
    [TaskHandlerTypes.Preprocess]: {};
    [TaskHandlerTypes.AISummarize]: {};
}

// example
// const taskParameters: TaskParameters<TaskHandlerTypes.ProvideData> = { IMType: IMTypes.QQ };
export type TaskParameters<T extends TaskHandlerTypes> = TaskParamsMap[T];
