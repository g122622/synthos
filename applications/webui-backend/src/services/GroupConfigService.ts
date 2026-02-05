/**
 * 群组配置服务
 */
import type ConfigManagerServiceType from "@root/common/services/config/ConfigManagerService";

import { injectable, inject } from "tsyringe";

import { TOKENS } from "../di/tokens";

@injectable()
export class GroupConfigService {
    constructor(
        @inject(TOKENS.ConfigManagerService)
        private configManagerService: typeof ConfigManagerServiceType
    ) {}

    /**
     * 获取所有群组详情
     */
    async getAllGroupDetails() {
        const config = await this.configManagerService.getCurrentConfig();

        return config.groupConfigs;
    }
}
