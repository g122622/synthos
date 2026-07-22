/**
 * Preprocessing RPC Schemas
 * 定义 preprocessing 子项目 RPC 接口的输入/输出类型
 */
import { z } from "zod";

// ========== 预处理接口 ==========

export const PreprocessInputSchema = z.object({
    groupIds: z.array(z.string()),
    startTimeStamp: z.number(),
    endTimeStamp: z.number()
});

export const PreprocessOutputSchema = z.object({
    success: z.literal(true)
});

// ========== 导出类型 ==========

export type PreprocessInput = z.infer<typeof PreprocessInputSchema>;
export type PreprocessOutput = z.infer<typeof PreprocessOutputSchema>;
