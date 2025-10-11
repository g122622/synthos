import Logger from "@root/common/util/Logger";
import { QQProvider } from "./providers/QQProvider";

(async () => {
    Logger.info("QQProvider init");
    const qqProvider = new QQProvider();
    await qqProvider.init();
    const results = await qqProvider.getMsgByTimeRange(1760198966000, 1760200066000);
    console.dir(results);
    await qqProvider.close();
})();
