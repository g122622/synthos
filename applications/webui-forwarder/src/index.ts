import "reflect-metadata";
import { registerConfigManagerService } from "@root/common/di/container";
import { bootstrap, bootstrapAll } from "@root/common/util/lifecycle/bootstrap";

import { NgrokClient } from "./NgrokClient";

@bootstrap
class WebUIForwarderApplication {
    public async main(): Promise<void> {
        // 初始化 DI 容器
        registerConfigManagerService();

        const ngrokClient = new NgrokClient();

        await ngrokClient.init();
    }
}

// 启动应用
bootstrapAll();
