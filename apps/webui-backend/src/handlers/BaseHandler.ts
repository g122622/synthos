import { AGCDBManager } from "@root/common/database/AGCDBManager";
import { IMDBManager } from "@root/common/database/IMDBManager";
import Logger from "@root/common/util/Logger";

export class BaseHandler {
    protected agcDBManager: AGCDBManager | null = null;
    protected imDBManager: IMDBManager | null = null;
    protected readonly LOGGER = Logger.withTag("WebUI-Backend");

    constructor(agcDBManager: AGCDBManager | null, imDBManager: IMDBManager | null) {
        this.agcDBManager = agcDBManager;
        this.imDBManager = imDBManager;
    }
}
