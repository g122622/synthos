/**
 * Data Provider RPC 实现
 * 将 ProvideDataTaskHandler 暴露为 tRPC procedure
 */
import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import Logger from "@root/common/util/Logger";
import {
    DataProviderRPCImplementation,
    ProvideDataInput,
    ProvideDataOutput
} from "@root/common/rpc/data-provider/index";

import { DATA_PROVIDER_TOKENS } from "../di/tokens";
import { ProvideDataTaskHandler } from "../tasks/ProvideDataTask";

/**
 * Data Provider RPC 实现类
 */
@injectable()
export class DataProviderRpcImpl implements DataProviderRPCImplementation {
    private LOGGER = Logger.withTag("DataProviderRpcImpl");

    public constructor(
        @inject(DATA_PROVIDER_TOKENS.ProvideDataTaskHandler) private provideDataTaskHandler: ProvideDataTaskHandler
    ) {}

    /**
     * 数据提供
     * @param input 数据提供输入
     * @returns 数据提供结果
     */
    public async provideData(input: ProvideDataInput): Promise<ProvideDataOutput> {
        this.LOGGER.info(`收到 provideData 请求: IMType=${input.IMType}, groupIds=${input.groupIds.join(",")}`);

        return this.provideDataTaskHandler.run(input);
    }
}
