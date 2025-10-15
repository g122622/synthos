import { ALL, IMTypes } from "../../types/data-provider";

export enum TaskHandlerTypes {
    ProvideData = "ProvideData",
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
    [TaskHandlerTypes.Preprocess]: {};
    [TaskHandlerTypes.AISummarize]: {};
}

export type TaskParameters<T extends TaskHandlerTypes> = TaskParamsMap[T];

// example
// const taskParameters: TaskParameters<TaskHandlerTypes.ProvideData> = { IMType: IMTypes.QQ };
