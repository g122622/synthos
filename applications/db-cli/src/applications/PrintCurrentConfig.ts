import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { IApplication } from "@/contracts/IApplication";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

@mustInitBeforeUse
export class PrintCurrentConfig extends Disposable implements IApplication {
    public static readonly appName = "打印当前配置";
    public static readonly description = "打印当前系统配置信息";

    public async init() {}

    public async run() {
        const config = await ConfigManagerService.getCurrentConfig();

        console.log("当前配置：");
        console.dir(config, { depth: 10 });
        console.log(JSON.stringify(config, null, 4));
    }
}
