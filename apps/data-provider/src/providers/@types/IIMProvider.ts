import { RawChatMessage } from "@root/common/types/data-provider";
import { Disposable } from "@root/common/util/lifecycle/Disposable";

export interface IIMProvider extends Disposable {
    init(): Promise<void>;
    getMsgByTimeRange(
        timeStart: number,
        timeEnd: number,
        groupId?: string
    ): Promise<RawChatMessage[]>;
}
