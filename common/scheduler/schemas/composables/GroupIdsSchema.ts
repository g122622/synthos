import z from "zod";

export const GroupIdsSchema = z
    .object({
        /** 群组 ID 列表 */
        groupIds: z.array(z.string()).min(0)
    })
    .describe("群组 ID 列表参数");

export type GroupIdsParams = z.infer<typeof GroupIdsSchema>;
