import "reflect-metadata";
import { registerConfigManagerService } from "@root/common/di/container";
import { NgrokClient } from "./NgrokClient";

(async () => {
    // 初始化 DI 容器
    registerConfigManagerService();

    const ngrokClient = new NgrokClient();
    await ngrokClient.init();
})();
