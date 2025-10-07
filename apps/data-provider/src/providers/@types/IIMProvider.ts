import { RawChatMessage } from "@root/common/types/data-provider";

export interface IIMProvider {
    init(): Promise<void>;
    getMsgByTimeRange(timeStart: number, timeEnd: number): Promise<RawChatMessage[]>;
}
