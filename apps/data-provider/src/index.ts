import Logger from "@root/common/util/Logger";
import { QQProvider } from "./providers/QQProvider";

(async () => {
    Logger.info("QQProvider init");
    const qqProvider = new QQProvider();
    await qqProvider.init();
    await qqProvider.getMsgByTimeRange(1760113163000, 1760113263000);
    await qqProvider.close();
})();
