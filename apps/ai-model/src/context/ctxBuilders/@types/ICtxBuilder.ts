import { Disposable } from "@root/common/util/lifecycle/Disposable";

export interface ICtxBuilder extends Disposable {
    init(): Promise<void>;
    /**
     * 依照给定的所有消息，构建一个上下文
     * @note 请务必确保这里的消息是按照时间顺序排序的，最新的消息在最后
     * @returns 可以直接注入大模型的上下文
     */
    buildCtx(...params: any[]): Promise<string>;
}
