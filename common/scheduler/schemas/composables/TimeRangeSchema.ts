import z from "zod";

export const TimeRangeSchema = z
    .object({
        /** 起始时间戳（毫秒） */
        startTimeStamp: z.number().int().positive().describe("时间范围的起始时间戳（毫秒）"),
        /** 结束时间戳（毫秒） */
        endTimeStamp: z.number().int().positive().describe("时间范围的结束时间戳（毫秒）")
    })
    // zod 不支持refine后，在使用时展开对象，所以这里注释掉了
    // .refine(data => data.endTimeStamp > data.startTimeStamp, {
    //     message: "结束时间必须大于开始时间",
    //     path: ["endTimeStamp"]
    // })
    // // 必须是毫秒。通过约束数字长度来实现
    // .refine(data => data.startTimeStamp.toString().length >= 13 && data.endTimeStamp.toString().length >= 13, {
    //     message: "时间戳必须为毫秒级别",
    //     path: ["startTimeStamp", "endTimeStamp"]
    // })
    .describe("时间范围参数");

export type TimeRangeParams = z.infer<typeof TimeRangeSchema>;
