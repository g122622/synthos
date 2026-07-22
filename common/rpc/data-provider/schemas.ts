/**
 * Data Provider RPC Schemas
 * 定义 data-provider 子项目 RPC 接口的输入/输出类型
 */
import { z } from "zod";

// ========== 数据提供接口 ==========

export const ProvideDataInputSchema = z.object({
    IMType: z.enum(["QQ", "WeChat"]),
    groupIds: z.array(z.string()),
    startTimeStamp: z.number(),
    endTimeStamp: z.number()
});

export const ProvideDataOutputSchema = z.object({
    success: z.literal(true)
});

// ========== 导出类型 ==========

export type ProvideDataInput = z.infer<typeof ProvideDataInputSchema>;
export type ProvideDataOutput = z.infer<typeof ProvideDataOutputSchema>;
