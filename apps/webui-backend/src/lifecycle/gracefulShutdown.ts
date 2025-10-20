import Logger from "@root/common/util/Logger";
import { WebUIServer } from "../index";

const LOGGER = Logger.withTag("WebUI-Backend");

export const setupGracefulShutdown = (server: WebUIServer): void => {
    process.on("SIGINT", () => gracefulShutdown(server));
};

export const gracefulShutdown = async (server: WebUIServer): Promise<void> => {
    LOGGER.warning("收到SIGINT信号，正在关闭服务...");

    await server.closeDatabases();

    LOGGER.success("服务已关闭");
    process.exit(0);
};
