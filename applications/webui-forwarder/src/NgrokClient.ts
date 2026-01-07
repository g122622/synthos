import "reflect-metadata";
import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import Logger from "@root/common/util/Logger";
import ngrok from "ngrok";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

@mustInitBeforeUse
export class NgrokClient extends Disposable {
    private urlForFE = "";
    private urlForBE = "";
    private LOGGER = Logger.withTag("NgrokClient");

    public async init() {
        const config = await ConfigManagerService.getCurrentConfig();
        if (!config.webUI_Forwarder.enabled) {
            this.LOGGER.warning("Ngrok客户端未在配置文件中启用, 跳过初始化");
            return;
        }

        this.LOGGER.info(`Ngrok客户端（前端）正在初始化...`);
        try {
            this.urlForFE = await ngrok.connect({
                authtoken: config.webUI_Forwarder.authTokenForFE,
                proto: "http",
                addr: 5173 // TODO : Make this configurable
            });
            this.LOGGER.success(`Ngrok客户端（前端）初始化成功, urlForFE: ${this.urlForFE}`);
        } catch (e) {
            this.LOGGER.error(`Ngrok客户端初始化失败, 错误信息: ${e}`);
        }

        this.LOGGER.info(`Ngrok客户端（后端）正在初始化...`);
        try {
            this.urlForBE = await ngrok.connect({
                proto: "http",
                authtoken: config.webUI_Forwarder.authTokenForBE,
                addr: config.webUI_Backend.port
            });
            this.LOGGER.success(`Ngrok客户端（后端）初始化成功, urlForBE: ${this.urlForBE}`);
        } catch (e) {
            this.LOGGER.error(`Ngrok客户端初始化失败, 错误信息: ${e}`);
        }

        this._registerDisposableFunction(async () => {
            await ngrok.disconnect(); // 断开所有连接
            this.LOGGER.success("Ngrok客户端已关闭");
        });
    }
}
