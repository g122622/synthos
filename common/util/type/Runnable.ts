/**
 * Runnable 抽象类 - 可执行任务基类
 */
export abstract class Runnable<T = unknown> {
    // ========== 抽象方法（子类必须实现） ==========

    /**
     * 任务执行主逻辑
     * @returns 任务执行结果
     */
    public abstract run(args: any): Promise<T> | T;
}
