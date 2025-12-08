/**
 * 群组配置服务
 */
import { injectable } from "tsyringe";
import ConfigManagerService from "@root/common/config/ConfigManagerService";

@injectable()
export class GroupConfigService {
    /**
     * 获取所有群组详情
     */
    async getAllGroupDetails() {
        const config = await ConfigManagerService.getCurrentConfig();
        return config.groupConfigs;
    }
}

