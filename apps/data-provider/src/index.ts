import Logger from "@root/common/util/Logger";
import { QQProvider } from "./providers/QQProvider";

(async () => {
    Logger.info("QQProvider init");
    const qqProvider = new QQProvider();
    await qqProvider.init();
    Logger.info("QQProvider init done");
})();
