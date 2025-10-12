import Logger from "@root/common/util/Logger";
import { QQProvider } from "./providers/QQProvider";
import { IMDBManager } from "@root/common/database/IMDBManager";

(async () => {
    Logger.info("QQProvider init");
    const qqProvider = new QQProvider();
    await qqProvider.init();
    const imdbManager = new IMDBManager();
    await imdbManager.init();

    const results = await qqProvider.getMsgByTimeRange(1760200066000, 1760250066000);
    console.dir(results);
    await imdbManager.storeRawChatMessages(results);

    await qqProvider.close();
    await imdbManager.close();
})();
