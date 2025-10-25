import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import { InterestScoreDBManager } from "@root/common/database/InterestScoreDBManager";
import Logger from "@root/common/util/Logger";

export class BaseHandler {
    protected agcDBManager: AGCDBManager | null = null;
    protected imDBManager: IMDBManager | null = null;
    protected interestScoreDBManager: InterestScoreDBManager | null = null;
    protected readonly LOGGER = Logger.withTag("WebUI-Backend");

    constructor(agcDBManager: AGCDBManager | null, imDBManager: IMDBManager | null, interestScoreDBManager: InterestScoreDBManager | null) {
        this.agcDBManager = agcDBManager;
        this.imDBManager = imDBManager;
        this.interestScoreDBManager = interestScoreDBManager;
    }
}
