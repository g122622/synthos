import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";

import { TOKENS } from "../di/tokens";
import { QueryLogsSchema } from "../schemas/index";
import { LogsService } from "../services/LogsService";

@injectable()
export class LogsController {
    constructor(@inject(TOKENS.LogsService) private logsService: LogsService) {}

    /**
     * POST /api/logs/query
     */
    public queryLogs = async (req: Request, res: Response): Promise<void> => {
        const params = QueryLogsSchema.parse(req.body);
        const result = await this.logsService.queryLogs(params);

        res.json({
            success: true,
            data: result
        });
    };
}
