/**
 * 依赖注入容器配置
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { TOKENS } from "./tokens";

// DBManagers
import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";

// Status Managers
import { TopicFavoriteStatusManager } from "../repositories/TopicFavoriteStatusManager";
import { TopicReadStatusManager } from "../repositories/TopicReadStatusManager";

// Services
import { AIDigestService } from "../services/AIDigestService";
import { ChatMessageService } from "../services/ChatMessageService";
import { GroupConfigService } from "../services/GroupConfigService";
import { InterestScoreService } from "../services/InterestScoreService";
import { MiscService } from "../services/MiscService";
import { TopicStatusService } from "../services/TopicStatusService";

// Controllers
import { AIDigestController } from "../controllers/AIDigestController";
import { ChatMessageController } from "../controllers/ChatMessageController";
import { GroupConfigController } from "../controllers/GroupConfigController";
import { InterestScoreController } from "../controllers/InterestScoreController";
import { MiscController } from "../controllers/MiscController";
import { TopicStatusController } from "../controllers/TopicStatusController";

/**
 * 注册所有 DBManager 实例
 */
export function registerDBManagers(
    agcDBManager: AGCDBManager,
    imDBManager: IMDBManager,
    interestScoreDBManager: InterestScoreDBManager
): void {
    container.registerInstance(TOKENS.AGCDBManager, agcDBManager);
    container.registerInstance(TOKENS.IMDBManager, imDBManager);
    container.registerInstance(TOKENS.InterestScoreDBManager, interestScoreDBManager);
}

/**
 * 注册 Status Managers
 */
export function registerStatusManagers(
    favoriteStatusManager: TopicFavoriteStatusManager,
    readStatusManager: TopicReadStatusManager
): void {
    container.registerInstance(TOKENS.TopicFavoriteStatusManager, favoriteStatusManager);
    container.registerInstance(TOKENS.TopicReadStatusManager, readStatusManager);
}

/**
 * 注册所有 Services
 */
export function registerServices(): void {
    container.registerSingleton(TOKENS.AIDigestService, AIDigestService);
    container.registerSingleton(TOKENS.ChatMessageService, ChatMessageService);
    container.registerSingleton(TOKENS.GroupConfigService, GroupConfigService);
    container.registerSingleton(TOKENS.InterestScoreService, InterestScoreService);
    container.registerSingleton(TOKENS.MiscService, MiscService);
    container.registerSingleton(TOKENS.TopicStatusService, TopicStatusService);
}

/**
 * 注册所有 Controllers
 */
export function registerControllers(): void {
    container.registerSingleton(TOKENS.AIDigestController, AIDigestController);
    container.registerSingleton(TOKENS.ChatMessageController, ChatMessageController);
    container.registerSingleton(TOKENS.GroupConfigController, GroupConfigController);
    container.registerSingleton(TOKENS.InterestScoreController, InterestScoreController);
    container.registerSingleton(TOKENS.MiscController, MiscController);
    container.registerSingleton(TOKENS.TopicStatusController, TopicStatusController);
}

/**
 * 获取容器实例
 */
export function getContainer() {
    return container;
}

export { container };

