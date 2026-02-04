/**
 * 深度合并两个对象，source 中非 undefined 的值会覆盖 target 中的值
 */
export function deepMerge<T extends object>(target: T, source: Record<string, unknown>): T {
    const result = { ...target };

    for (const key in source) {
        const sourceValue = source[key];
        if (sourceValue === undefined) {
            continue;
        }

        const targetValue = (target as Record<string, unknown>)[key];
        if (
            sourceValue !== null &&
            typeof sourceValue === "object" &&
            !Array.isArray(sourceValue) &&
            targetValue !== null &&
            typeof targetValue === "object" &&
            !Array.isArray(targetValue)
        ) {
            // 递归合并嵌套对象
            (result as Record<string, unknown>)[key] = this.deepMerge(
                targetValue as object,
                sourceValue as Record<string, unknown>
            );
        } else {
            (result as Record<string, unknown>)[key] = sourceValue;
        }
    }

    return result;
}
