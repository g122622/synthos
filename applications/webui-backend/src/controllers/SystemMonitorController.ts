import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { SystemMonitorService } from "../services/SystemMonitorService";

@injectable()
export class SystemMonitorController {
    constructor(@inject(SystemMonitorService) private systemMonitorService: SystemMonitorService) {}

    public getLatestStats = async (req: Request, res: Response): Promise<void> => {
        const stats = this.systemMonitorService.getLatestStats();
        res.json(stats || {});
    };

    public getStatsHistory = async (req: Request, res: Response): Promise<void> => {
        const history = this.systemMonitorService.getStatsHistory();
        res.json(history);
    };
}
