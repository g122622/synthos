/**
 * 从 Zod Schema 生成严格类型（移除所有可选标记）
 */
export type DeepRequired<T> = {
    [K in keyof T]-?: T[K] extends object | undefined
        ? T[K] extends (...args: any[]) => any
            ? T[K]
            : DeepRequired<NonNullable<T[K]>>
        : T[K];
};
